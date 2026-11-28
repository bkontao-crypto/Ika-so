import test from "node:test";
import assert from "node:assert/strict";
import { createListingExpiry } from "../server/services/listing-expiry.js";

const NOW = Date.UTC(2026, 10, 27, 15, 0, 0);
const DAY = 86_400_000;

/** Base factice : réponses par motif SQL, journal des requêtes, unicité des avertissements comme en base. */
function fakeDb(state = {}) {
  const seen = new Set();
  const log = [];
  const run = async (sql, params = []) => {
    log.push({ sql, params });
    if (/pg_try_advisory_xact_lock/.test(sql)) return [{ ok: state.lock !== false }];
    if (/set status = 'PUBLISHED', published_at/.test(sql)) return state.started ?? [];
    if (/set status = 'EXPIRED'/.test(sql)) return state.expired ?? [];
    if (/archived_mode = 'AUTO'/.test(sql)) return state.archived ?? [];
    if (/from ika_listings\s+where status = 'PUBLISHED' and expires_at > now\(\)/.test(sql)) return state.due ?? [];
    if (/insert into ika_expiry_warnings/.test(sql)) {
      const k = /'DAY_0'/.test(sql) ? `${params[0]}|DAY_0|${params[2]}` : `${params[0]}|${params[2]}|${params[3]}`;
      if (seen.has(k)) return [];
      seen.add(k);
      return [{ kind: "x" }];
    }
    if (/for update/.test(sql)) return state.row ? [state.row] : [];
    return [];
  };
  return { log, query: run, transaction: async (fn) => fn({ query: run }) };
}
const make = (state, extra = {}) => {
  const db = fakeDb(state);
  const notes = [];
  const svc = createListingExpiry({
    db, now: () => NOW,
    accounts: { requireActive: async () => ({}), requireStaff: async () => ({}) },
    settings: { get: async () => null, set: async () => ({}) },
    engagement: { notify: async (u, n) => { notes.push({ u, ...n }); return true; }, onPublished: async () => ({}) },
    ...extra,
  });
  return { db, svc, notes };
};
const events = (db) => db.log.filter((q) => /insert into ika_listing_events/.test(q.sql)).map((q) => q.params[3]);

test("avertissement : un seul message (le plus proche) puis plus rien au passage suivant (idempotence)", async () => {
  const { svc, notes } = make({ due: [{ id: "L1", owner_id: "U1", title: "Villa", expires_at: new Date(NOW + 2 * DAY) }] });
  const first = await svc.runDue();
  assert.equal(first.warned, 1);
  assert.equal(notes.length, 1);
  assert.match(notes[0].title, /expire dans 3 jours/); // paliers J-7 et J-3 franchis : un seul message, le plus proche
  const second = await svc.runDue();
  assert.equal(second.warned, 0);
  assert.equal(notes.length, 1);
});

test("expiration : annonce masquée par statut, historique automatique, message du jour J envoyé une seule fois", async () => {
  const { db, svc, notes } = make({ expired: [{ id: "L2", owner_id: "U2", title: "Terrain", expires_at: new Date(NOW - 1000) }] });
  const r = await svc.runDue();
  assert.equal(r.expired, 1);
  assert.ok(events(db).includes("EXPIRE"));
  assert.equal(notes.filter((n) => n.kind === "LISTING_EXPIRED").length, 1);
  await svc.runDue(); // même ligne renvoyée : l'avertissement du jour J existe déjà
  assert.equal(notes.filter((n) => n.kind === "LISTING_EXPIRED").length, 1);
});

test("archivage automatique : événement distingué de l'archivage manuel, jamais de suppression", async () => {
  const { db, svc } = make({ archived: [{ id: "L3", owner_id: "U3", title: "Maison" }] });
  assert.equal((await svc.runDue()).archived, 1);
  assert.ok(events(db).includes("ARCHIVE_AUTO"));
  assert.ok(!db.log.some((q) => /delete from ika_listings/i.test(q.sql)));
});

test("verrou non obtenu : aucun traitement (instance concurrente)", async () => {
  const { db, svc } = make({ lock: false, expired: [{ id: "L4", owner_id: "U4", title: "x", expires_at: new Date(NOW) }] });
  const r = await svc.runDue();
  assert.deepEqual(r, { started: 0, expired: 0, archived: 0, warned: 0 });
  assert.equal(events(db).length, 0);
});

test("propriétaire : annonce d'un autre refusée (404), sans modification", async () => {
  const { db, svc } = make({ row: null });
  await assert.rejects(svc.outcome("intrus", "L1", { outcome: "RENEW", days: 5 }), (e) => e.status === 404);
  assert.ok(!db.log.some((q) => /update ika_listings/.test(q.sql)));
});

test("vendu seulement pour une vente, louée seulement pour une location", async () => {
  const loc = make({ row: { id: "L5", status: "PUBLISHED", transaction_type: "Location", expires_at: null } });
  await assert.rejects(loc.svc.outcome("U", "L5", { outcome: "SOLD" }), (e) => e.status === 409);
  const ok = await loc.svc.outcome("U", "L5", { outcome: "RENTED" });
  assert.equal(ok.status, "RENTED");
  assert.ok(events(loc.db).includes("RENTED"));
  const vente = make({ row: { id: "L6", status: "EXPIRED", transaction_type: "Vente", expires_at: null } });
  assert.equal((await vente.svc.outcome("U", "L6", { outcome: "SOLD" })).status, "SOLD");
  await assert.rejects(vente.svc.outcome("U", "L6", { outcome: "RENTED" }), (e) => e.status === 409);
});

test("prolongation : 30 jours acceptés, 31 refusés, annonce expirée remise en ligne, ancienne et nouvelle date tracées", async () => {
  const row = { id: "L7", status: "EXPIRED", transaction_type: "Vente", expires_at: new Date(NOW - DAY) };
  const a = make({ row });
  await assert.rejects(a.svc.outcome("U", "L7", { outcome: "RENEW", days: 31 }), (e) => e.status === 400);
  const b = make({ row });
  const r = await b.svc.outcome("U", "L7", { outcome: "RENEW", days: 30 });
  assert.equal(r.status, "PUBLISHED");
  assert.equal(r.expiresAt, "2026-12-27T23:59:59.999Z");
  const ev = b.db.log.find((q) => /insert into ika_listing_events/.test(q.sql) && q.params[3] === "EXTEND");
  assert.ok(ev && ev.params[4] && ev.params[5] === "2026-12-27T23:59:59.999Z");
  const c = make({ row: { ...row, status: "ARCHIVED" } });
  await assert.rejects(c.svc.outcome("U", "L7", { outcome: "RENEW", days: 5 }), (e) => e.status === 409);
});

test("archivage manuel tracé comme manuel", async () => {
  const { db, svc } = make({ row: { id: "L8", status: "PUBLISHED", transaction_type: "Vente", expires_at: null } });
  assert.equal((await svc.outcome("U", "L8", { outcome: "ARCHIVED" })).status, "ARCHIVED");
  assert.ok(events(db).includes("ARCHIVE_MANUAL"));
  assert.ok(db.log.some((q) => /archived_mode = 'MANUAL'/.test(q.sql)));
});

test("dates d'une annonce en ligne : pas de contournement du plafond de 30 jours, ni de suppression de la date de fin", async () => {
  const row = { id: "L9", status: "PUBLISHED", starts_at: null, expires_at: new Date(NOW + 10 * DAY) };
  const far = new Date(NOW + 90 * DAY).toISOString();
  await assert.rejects(make({ row }).svc.setDates("U", "L9", { expiresAt: far }), (e) => e.status === 400);
  await assert.rejects(make({ row }).svc.setDates("U", "L9", { expiresAt: null }), (e) => e.status === 400);
  const ok = await make({ row }).svc.setDates("U", "L9", { expiresAt: new Date(NOW + 20 * DAY).toISOString() });
  assert.ok(ok.ok);
});

test("dates avant modération : fin postérieure au début exigée", async () => {
  const row = { id: "L10", status: "PENDING", starts_at: null, expires_at: null };
  await assert.rejects(make({ row }).svc.setDates("U", "L10", { startsAt: new Date(NOW + 9 * DAY).toISOString(), expiresAt: new Date(NOW + 5 * DAY).toISOString() }), (e) => e.status === 400);
  const ok = await make({ row }).svc.setDates("U", "L10", { startsAt: new Date(NOW + 2 * DAY).toISOString(), expiresAt: new Date(NOW + 20 * DAY).toISOString() });
  assert.ok(ok.ok);
});

test("alerte à la connexion : la liste vient du serveur, annonce échue marquée expirée avec archivage prévu", async () => {
  const rows = [{ id: "A", title: "Villa", transaction_type: "Location", image_url: "/m/a", status: "EXPIRED", expires_at: new Date(NOW - 3 * DAY), expired_at: new Date(NOW - 2 * DAY) }];
  const db = { query: async () => rows, transaction: async () => {} };
  const svc = createListingExpiry({ db, now: () => NOW, accounts: { requireActive: async () => ({}) }, settings: { get: async () => null } });
  const [a] = await svc.ownerAlerts("U");
  assert.equal(a.state, "EXPIRED");
  assert.deepEqual(a.actions, ["RENTED", "ARCHIVED", "RENEW"]);
  assert.equal(a.autoArchiveAt, new Date(NOW - 2 * DAY + 30 * DAY).toISOString());
});
