// Owner Control Center v2 : journal unifié des mouvements, traçage, export, journal de connexions.
// Fausse base : on vérifie le SQL produit (paramètres, filtres, garde-fous) et la logique de fusion, sans PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_KEYS, DEFAULT_CATEGORIES, SOURCES, buildSourceQuery, csvCell, describeCode, eventsToCsv, mergeEvents, selectSources, shapeEvent } from "../server/lib/activity-feed.js";
import { createOwnerCenter } from "../server/services/owner-center.js";
import { forbidden } from "../server/lib/errors.js";

const TABLES = [...new Set(SOURCES.flatMap((s) => s.from.match(/\bika_[a-z_]+/g)))];
const range = { from: "2026-01-01T00:00:00.000Z", before: "2026-12-31T00:00:00.000Z", limit: 20 };

function fakeDb(handlers = []) {
  const calls = [];
  const run = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/to_regclass/.test(sql)) return params[0].map((name) => ({ name, ok: true }));
    for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params);
    return [];
  };
  return { calls, query: run, transaction: async (fn) => fn({ query: run }) };
}
const fakeAccounts = () => {
  const audits = [];
  return { audits, requireStaff: async (id) => { if (id !== "root") throw forbidden("Réservé."); return { staff_role: "SUPERADMIN" }; }, audit: async (...args) => { audits.push(args); } };
};

test("chaque source produit un SQL cohérent : paramètres numérotés, pas de valeur saisie dans le texte", () => {
  for (const s of SOURCES) {
    const q = buildSourceQuery(s, {}, range);
    assert.ok(q.sql.includes("limit $3"), s.key);
    assert.equal(q.params.length, 3, s.key);
    assert.ok(!q.sql.includes("undefined"), s.key);
    assert.equal((q.sql.match(/\(/g) ?? []).length, (q.sql.match(/\)/g) ?? []).length, `parenthèses ${s.key}`);
    for (const t of s.from.match(/\bika_[a-z_]+/g)) assert.ok(TABLES.includes(t));
  }
});

test("filtres : acteur, recherche (jokers neutralisés), annonce, compte ; source incapable = ignorée", () => {
  const audit = SOURCES.find((s) => s.key === "audit");
  const q = buildSourceQuery(audit, { actor: "u1", q: "50%_x\\", listingId: "l1", userId: "u2" }, range);
  assert.deepEqual(q.params.slice(3), ["u1", "l1", "u2", "%50\\%\\_x\\\\%"]);
  assert.match(q.sql, /a\.actor_id = \$4/);
  assert.match(q.sql, /strpos\(coalesce\(a\.note, ''\), \$6\) > 0/);
  const incident = SOURCES.find((s) => s.key === "incident");
  assert.equal(buildSourceQuery(incident, { actor: "u1" }, range), null);
  assert.equal(buildSourceQuery(incident, { listingId: "l1" }, range), null);
  assert.equal(buildSourceQuery(incident, { userId: "u1" }, range), null);
  assert.ok(buildSourceQuery(incident, { q: "disque" }, range));
});

test("le contenu des messages privés n'est jamais lu ; la fréquentation est masquée par défaut", () => {
  const msg = SOURCES.find((s) => s.key === "message");
  assert.ok(!/m\.body/.test(buildSourceQuery(msg, { q: "x" }, range).sql));
  assert.ok(!DEFAULT_CATEGORIES.includes("traffic"));
  assert.ok(CATEGORY_KEYS.includes("traffic"));
  assert.ok(!selectSources({}).some((s) => s.cat === "traffic"));
  assert.ok(selectSources({ categories: ["traffic"] }).every((s) => s.cat === "traffic"));
  assert.deepEqual(selectSources({ sources: ["audit", "inconnue"] }).map((s) => s.key), ["audit"]);
});

test("fusion : ordre décroissant à la microseconde, limite respectée", () => {
  const ev = (key, cursor) => ({ uid: `${key}:${cursor}`, cursor });
  const merged = mergeEvents([[ev("a", "2026-11-08T10:00:00.000300Z"), ev("a", "2026-11-08T09:00:00.000000Z")], [ev("b", "2026-11-08T10:00:00.000200Z"), ev("b", "2026-11-08T10:00:00.000100Z")]], 3);
  assert.deepEqual(merged.map((e) => e.cursor), ["2026-11-08T10:00:00.000300Z", "2026-11-08T10:00:00.000200Z", "2026-11-08T10:00:00.000100Z"]);
});

test("événement : date en millisecondes pour l'affichage, curseur exact, libellé et ton", () => {
  const src = SOURCES.find((s) => s.key === "audit");
  const e = shapeEvent({ id: "aud-1", at_us: "2026-11-08T10:42:03.123456Z", actor_id: "u1", actor_name: "M. Traoré", object_type: "listing", object_id: "l1", object_label: "Villa", code: "APPROVE", detail: "", sev: null }, src);
  assert.equal(e.at, "2026-11-08T10:42:03.123Z");
  assert.equal(e.cursor, "2026-11-08T10:42:03.123456Z");
  assert.equal(e.label, "Annonce approuvée");
  assert.equal(e.tone, "ok");
  assert.equal(e.uid, "audit:aud-1");
  assert.equal(shapeEvent({ id: "i", at_us: "2026-11-08T10:42:03.000001Z", code: "INCIDENT_OPENED", sev: "bad" }, SOURCES.find((s) => s.key === "incident")).tone, "bad");
  assert.deepEqual(describeCode("CAMPAIGN_PAUSED"), { label: "Campagne · mise en pause", tone: "info" });
  assert.equal(describeCode("QUELQUE_CHOSE_DE_NEUF").label, "Quelque chose de neuf");
});

test("CSV : formules de tableur neutralisées, guillemets doublés, BOM", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell('dit "oui"'), `"dit ""oui"""`);
  assert.equal(csvCell(null), `""`);
  const csv = eventsToCsv([{ at: "2026-11-08T10:00:00.000Z", category: "admin", source: "audit", label: "x", code: "X", actor: { id: "u", name: "+33" }, object: null, detail: null }]);
  assert.ok(csv.startsWith("\uFEFFdate_utc,"));
  assert.match(csv, /"'\+33"/);
});

test("accès : tout est réservé au SUPERADMIN", async () => {
  const oc = createOwnerCenter({ db: fakeDb(), accounts: fakeAccounts() });
  for (const call of [() => oc.feed("x"), () => oc.catalog("x"), () => oc.summary("x"), () => oc.trace("x", { type: "user", id: "u" }), () => oc.exportCsv("x"), () => oc.dashboard("x"), () => oc.securityLogStatus("x"), () => oc.setSecurityLog("x", true)]) {
    await assert.rejects(call, (e) => e.status === 403);
  }
});

test("journal : validations (curseur, dates), pagination, sources indisponibles signalées", async () => {
  const accounts = fakeAccounts();
  const db = fakeDb([
    [/from ika_audit a/, () => [{ id: "a1", at_us: "2026-11-08T10:00:00.000002Z", actor_id: "root", actor_name: "Owner", code: "SETTINGS_UPDATE", detail: "x" }, { id: "a2", at_us: "2026-11-08T09:00:00.000000Z", actor_id: "root", actor_name: "Owner", code: "APPROVE" }]],
  ]);
  const oc = createOwnerCenter({ db, accounts });
  await assert.rejects(() => oc.feed("root", { before: "n'importe quoi" }), (e) => e.status === 400);
  await assert.rejects(() => oc.feed("root", { from: "pas une date" }), (e) => e.status === 400);
  const page = await oc.feed("root", { sources: "audit", limit: 2 });
  assert.equal(page.events.length, 2);
  assert.equal(page.events[0].code, "SETTINGS_UPDATE");
  assert.equal(page.nextCursor, "2026-11-08T09:00:00.000000Z");
  const last = await oc.feed("root", { sources: "audit", limit: 50 });
  assert.equal(last.nextCursor, null);
  const q = db.calls.filter((c) => /from ika_audit a/.test(c.sql)).at(-1);
  assert.equal(q.params[2], 50);
});

test("traçage : la consultation est inscrite au journal d'audit ; compte inconnu = 404", async () => {
  const accounts = fakeAccounts();
  const db = fakeDb([
    [/from ika_listings l left join ika_profiles pr/, () => [{ id: "l1", title: "Villa", status: "PUBLISHED", category: "Maison", transaction_type: "Vente", neighborhood: "ACI 2000", price: 1000, owner_id: "u9", owner_name: "Awa", created_at: new Date("2026-10-01"), published_at: null }]],
  ]);
  const oc = createOwnerCenter({ db, accounts });
  const out = await oc.trace("root", { type: "listing", id: "l1" });
  assert.equal(out.entity.title, "Villa");
  assert.deepEqual(accounts.audits[0].slice(0, 3), ["root", "OWNER_TRACE", "l1"]);
  await assert.rejects(() => oc.trace("root", { type: "user", id: "inconnu" }), (e) => e.status === 404);
  await assert.rejects(() => oc.trace("root", { type: "autre", id: "x" }), (e) => e.status === 400);
  // la trace d'annonce interroge toutes les catégories (fréquentation comprise) avec le filtre annonce
  assert.ok(db.calls.some((c) => /ika_analytics_events/.test(c.sql) && c.params.includes("l1")));
});

test("export : inscrit au journal d'audit, plafonné à 5 000 lignes par source", async () => {
  const accounts = fakeAccounts();
  const db = fakeDb();
  const oc = createOwnerCenter({ db, accounts });
  const csv = await oc.exportCsv("root", { categories: "admin" });
  assert.ok(csv.startsWith("\uFEFFdate_utc"));
  assert.equal(accounts.audits[0][1], "OWNER_ACTIVITY_EXPORT");
  assert.ok(db.calls.filter((c) => /limit \$3/.test(c.sql)).every((c) => c.params[2] === 5000));
});

test("journal de connexions : respecte l'interrupteur, n'enregistre ni IP ni agent brut, ne lève jamais", async () => {
  let enabled = "true";
  const db = fakeDb([[/from ika_settings/, () => [{ value: enabled }]], [/insert into ika_security_log/, () => []]]);
  const oc = createOwnerCenter({ db, accounts: fakeAccounts(), clock: (() => { let t = 1_000_000; return () => new Date((t += 120_000)); })() });
  await oc.recordSecurity("LOGIN", { userId: "u1" }, { headers: { "user-agent": "Mozilla/5.0 (iPhone) Mobile", "x-forwarded-for": "1.2.3.4" }, ip: "1.2.3.4" });
  const ins = db.calls.find((c) => /insert into ika_security_log/.test(c.sql));
  assert.equal(ins.params[1], "LOGIN");
  assert.equal(ins.params[3], "mobile");
  assert.ok(!JSON.stringify(ins.params).includes("1.2.3.4"));
  assert.ok(!JSON.stringify(ins.params).includes("Mozilla"));
  await oc.recordSecurity("LOGIN_FAILED", {}, null);
  assert.equal(db.calls.filter((c) => /insert into ika_security_log/.test(c.sql)).at(-1).params[4], "FAILED");
  enabled = "false";
  const before = db.calls.length;
  await oc.recordSecurity("LOGOUT", { userId: "u1" }, null);
  assert.ok(!db.calls.slice(before).some((c) => /insert into ika_security_log/.test(c.sql)));
  await oc.recordSecurity("INCONNU", {}, null); // type refusé, sans erreur
  const broken = createOwnerCenter({ db: { query: async () => { throw new Error("base coupée"); } }, accounts: fakeAccounts() });
  await broken.recordSecurity("LOGIN", { userId: "u1" }, null); // ne lève pas
});

test("tableau de bord : un bloc illisible n'empêche pas le reste ; alertes triées par gravité", async () => {
  const db = fakeDb([
    [/as listings_published/, () => [{ listings_published: 1284, listings_new: 10, listings_prev: 5, listings_pending: 12, users_active: 3672, users_new: 4, users_prev: 0, contacts_7: 426, contacts_prev_7: 379, pay_pending: 9, pay_stale: 2, complaints_open: 6, complaints_priority: 2 }]],
    [/from ika_incidents where resolved/, () => { throw new Error("table absente"); }],
    [/from ika_backup_log order by/, () => [{ status: "OK", created_at: new Date(), last_ok: new Date(Date.now() - 3_600_000) }]],
  ]);
  const oc = createOwnerCenter({ db, accounts: fakeAccounts(), logger: { warn() {} } });
  const d = await oc.dashboard("root", { days: 30 });
  assert.equal(d.kpis.listingsPublished.change, 100);
  assert.equal(d.kpis.usersActive.change, null); // précédent = 0 : pas de pourcentage inventé
  assert.equal(d.kpis.contacts7d.change, 12.4);
  assert.equal(d.series.days.length, 30);
  assert.equal(d.alerts[0].tone, "bad");
  assert.ok(d.alerts.some((a) => a.module === "payments"));
  assert.equal(d.health.items.find((x) => x.key === "incidents").text, "—");
  assert.equal(d.health.items.find((x) => x.key === "backup").tone, "ok");
  assert.equal(d.counts.pendingProofs, null);
});
