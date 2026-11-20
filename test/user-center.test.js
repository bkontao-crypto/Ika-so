import test from "node:test";
import assert from "node:assert/strict";
import { createUserCenter } from "../server/services/user-center.js";

function setup() {
  const calls = [];
  const db = { query: async (sql, args = []) => { calls.push({ sql, args }); return /count\(\*\)::int as n/.test(sql) ? [{ n: 0 }] : []; } };
  const accounts = { requireStaff: async () => ({}), audit: async () => {} };
  return { calls, uc: createUserCenter({ db, config: {} }, accounts) };
}

test("annuaire : la recherche passe en paramètre (jamais dans le SQL) et le tri est une liste blanche", async () => {
  const { calls, uc } = setup();
  await uc.directory("a", { q: "x'; drop table ika_users;--", sort: "1; drop table x", dir: "asc;--", segment: "active" });
  const list = calls.find((c) => /limit/.test(c.sql));
  assert.ok(!list.sql.includes("drop table"));
  assert.ok(list.args.includes("x'; drop table ika_users;--".toLowerCase().slice(0, 80)));
  assert.match(list.sql, /order by created_at desc/);
});

test("annuaire : filtres de dates bornés, pagination plafonnée", async () => {
  const { calls, uc } = setup();
  const r = await uc.directory("a", { from: "2026-01-01", to: "bad", dateField: "login", pageSize: 5000, page: -3 });
  assert.equal(r.pageSize, 100);
  assert.equal(r.page, 1);
  const list = calls.find((c) => /limit/.test(c.sql));
  assert.match(list.sql, /last_login_at >= \$1::date/);
  assert.ok(!/< \(\$\d::date \+ 1\)/.test(list.sql), "date invalide ignorée");
});

test("export CSV : neutralise les formules et trace l'export", async () => {
  const calls = [];
  const db = { query: async () => [{ user_id: "u1", email: "a@b.ml", full_name: "=cmd()", staff_role: "USER", account_status: "ACTIVE", segment: "active", advertiser: "none", listings: 0, logins_30d: 0 }] };
  const accounts = { requireStaff: async () => ({}), audit: async (...a) => calls.push(a) };
  const csv = await createUserCenter({ db, config: {} }, accounts).exportCsv("a", {});
  assert.ok(csv.includes(`"'=cmd()"`));
  assert.equal(calls[0][1], "OWNER_USERS_EXPORT");
});

test("analyse : compte inconnu → 404", async () => {
  const db = { query: async () => [] };
  await assert.rejects(createUserCenter({ db, config: {} }, { requireStaff: async () => ({}) }).analysis("a", "zz"), /introuvable/i);
});

test("inscription : le choix de données est enregistré (all → accepté, sinon refusé) et la collecte est active par défaut", async () => {
  const { createAccounts } = await import("../server/services/accounts.js");
  const { getConfig } = await import("../server/config.js");
  const writes = [];
  const db = { query: async (sql, args = []) => { if (/ika_analytics_consent/.test(sql)) writes.push(args); if (/insert into ika_users/.test(sql)) return [{ id: args[0] }]; if (/select \* from ika_profiles/.test(sql)) return [{ user_id: "x", account_status: "ACTIVE", staff_role: "USER" }]; if (/select email, name/.test(sql)) return [{ email: "a@b.ml", name: "A" }]; if (/insert into ika_profiles/.test(sql)) return [{ user_id: "x", account_status: "ACTIVE", staff_role: "USER" }]; return []; }, transaction: async (fn) => fn(db) };
  const acc = createAccounts({ db, config: { bootstrapAdmin: false } });
  await acc.register({ name: "Awa Traoré", email: "a@b.ml", password: "motdepasse1", acceptTerms: true, dataConsent: "all" });
  await acc.register({ name: "Awa Traoré", email: "c@b.ml", password: "motdepasse1", acceptTerms: true, dataConsent: "essential" });
  assert.equal(writes[0][1], true);
  assert.equal(writes[1][1], false);
  await assert.rejects(acc.register({ name: "Awa", email: "d@b.ml", password: "motdepasse1", acceptTerms: false, dataConsent: "all" }), /conditions/i);
  assert.equal(getConfig({}).analytics?.enabled ?? getConfig().analytics.enabled, true);
});

test("durée de visionnage : type autorisé, secondes bornées, liste identique à la contrainte de la migration 074", async () => {
  const { buildEvent, EVENT_TYPES } = await import("../server/lib/analytics-events.js");
  const fs = await import("node:fs");
  const ev = (seconds) => buildEvent("listing_dwell", { listingId: "l1", metadata: { seconds, autre: "x" } }, { eventId: "e1" });
  assert.deepEqual(ev(47).metadata, { seconds: 47 });
  assert.deepEqual(ev(0).metadata, {});
  assert.deepEqual(ev(99999).metadata, {});
  const sql = fs.readFileSync(new URL("../migrations/074_duree_visionnage.sql", import.meta.url), "utf8");
  const listed = [...sql.match(/check \(event_type in \(([\s\S]*?)\)\);/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...EVENT_TYPES].sort());
});

test("services du profil : plafond de 20, doublons refusés, titre obligatoire", async () => {
  const { createReviews, MAX_SERVICES } = await import("../server/services/reviews.js");
  let rows = [];
  const db = { query: async (sql, args = []) => { if (/select lower\(title\)/.test(sql)) return rows; if (/insert into ika_services/.test(sql)) { rows.push({ title: args[2].toLowerCase() }); return []; } return []; } };
  const r = createReviews({ db, config: {} }, { requireActive: async () => ({}) });
  assert.equal(MAX_SERVICES, 20);
  await assert.rejects(r.addService("u1", { title: "x" }), /Titre/);
  await r.addService("u1", { title: "Gestion locative" });
  await assert.rejects(r.addService("u1", { title: "gestion LOCATIVE" }), /déjà/);
  for (let i = 0; i < 19; i += 1) await r.addService("u1", { title: `Service ${i}` });
  await assert.rejects(r.addService("u1", { title: "Un de trop" }), /20 services/);
});

test("historique des pièces : lecture seule, filtre de statut en liste blanche, réservé au personnel", async () => {
  const { createTrust } = await import("../server/services/trust.js");
  const seen = [];
  const db = { query: async (sql, args = []) => { seen.push({ sql, args }); return []; } };
  const denied = new Error("interdit");
  const t = createTrust({ db, config: {} }, { requireStaff: async (id) => { if (id === "visiteur") throw denied; return {}; } });
  await t.proofHistory("mod", { status: "REFUSED" });
  await t.proofHistory("mod", { status: "x'; drop table ika_proofs;--" });
  assert.equal(seen[0].args[0], "REFUSED");
  assert.equal(seen[1].args[0], null);
  assert.ok(!/insert|update|delete/i.test(seen[0].sql));
  await assert.rejects(t.proofHistory("visiteur"), /interdit/);
});
