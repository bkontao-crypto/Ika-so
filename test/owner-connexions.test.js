// Habitudes de connexion du Super Administrateur : fonctions pures + service sur fausse base (le SQL est vérifié, pas exécuté).
import test from "node:test";
import assert from "node:assert/strict";
import { bucketHours, peakHour, weekSplit, countDayTypes, HOUR_BUCKETS } from "../server/lib/connection-stats.js";
import { createOwnerCenter } from "../server/services/owner-center.js";
import { forbidden } from "../server/lib/errors.js";

test("tranches horaires : les 7 tranches de la spécification couvrent 24 h sans trou ni recouvrement", () => {
  assert.deepEqual(HOUR_BUCKETS, [[0, 6], [6, 9], [9, 12], [12, 14], [14, 18], [18, 21], [21, 24]]);
  const byHour = Array(24).fill(1);
  const b = bucketHours(byHour);
  assert.equal(b.reduce((a, x) => a + x.count, 0), 24);
  assert.equal(b[0].label, "00 h – 06 h");
  assert.equal(b[6].label, "21 h – 00 h");
  assert.equal(b[0].count, 6);
});

test("tranches horaires : parts en pourcentage ; aucune connexion = part nulle, jamais 0 inventé", () => {
  const byHour = Array(24).fill(0); byHour[8] = 3; byHour[19] = 1;
  const b = bucketHours(byHour);
  assert.equal(b[1].sharePct, 75);
  assert.equal(b[5].sharePct, 25);
  assert.equal(bucketHours(Array(24).fill(0))[0].sharePct, null);
  assert.equal(peakHour(byHour), 8);
  assert.equal(peakHour(Array(24).fill(0)), null);
});

test("semaine et week-end : totaux, moyenne par jour selon le nombre de jours de chaque type, jour le plus fréquenté", () => {
  const w = weekSplit({ 1: 4, 2: 2, 3: 2, 4: 2, 5: 2, 6: 6, 7: 2 }, 10, 4);
  assert.equal(w.weekday, 12);
  assert.equal(w.weekend, 8);
  assert.equal(w.weekdayAvgPerDay, 1.2);
  assert.equal(w.weekendAvgPerDay, 2);
  assert.equal(w.busiestDay, "samedi");
  assert.equal(weekSplit({}, 0, 0).busiestDay, null);
  assert.equal(weekSplit({}, 0, 0).weekdayAvgPerDay, null);
});

test("types de jours : 2026-11-16 (lundi) à 2026-11-22 (dimanche) = 5 jours ouvrés et 2 de week-end", () => {
  const keys = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
  assert.deepEqual(countDayTypes(keys), { weekday: 5, weekend: 2 });
});

function fakeDb(handlers) {
  const calls = [];
  const run = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params);
    return [];
  };
  return { calls, query: run, transaction: async (fn) => fn({ query: run }) };
}
const accounts = { requireStaff: async (id) => { if (id !== "root") throw forbidden("Réservé."); return { staff_role: "SUPERADMIN" }; } };
const NOW = new Date("2026-11-19T10:30:00Z");

test("service : réservé au Super Administrateur", async () => {
  const oc = createOwnerCenter({ db: fakeDb([]), accounts, clock: () => NOW });
  await assert.rejects(() => oc.connections("simple-admin"), /Réservé/);
});

test("service : agrège le journal de connexions réel, sans rien inventer", async () => {
  const db = fakeDb([
    [/to_char\(occurred_at/, () => [{ d: "2026-11-18", n: 5, u: 3 }, { d: "2026-11-19", n: 2, u: 2 }]],
    [/extract\(hour/, () => [{ h: 8, n: 4 }, { h: 19, n: 3 }]],
    [/extract\(isodow/, () => [{ d: 3, n: 5 }, { d: 4, n: 2 }]],
    [/coalesce\(device_type/, () => [{ t: "mobile", n: 6 }, { t: "desktop", n: 1 }]],
    [/filter \(where occurred_at >= \$1\)/, () => [{ d1: 2, d7: 4, d30: 6 }]],
    [/max\(occurred_at\) as last/, () => [{ i30: 2, i60: 1, i90: 0, known: 6 }]],
    [/min\(occurred_at\) as since/, () => [{ since: new Date("2026-11-02T00:00:00Z") }]],
    [/not exists/, () => [{ never: 9, users: 15 }]],
  ]);
  const oc = createOwnerCenter({ db, accounts, clock: () => NOW });
  const r = await oc.connections("root", { days: 7 });
  assert.equal(r.available, true);
  assert.equal(r.days, 7);
  assert.equal(r.perDay.length, 7);
  assert.equal(r.perDay.at(-1).day, "2026-11-19");
  assert.equal(r.perDay.at(-1).logins, 2);
  assert.equal(r.perDay[0].logins, 0, "un jour sans connexion vaut 0, il n'est pas omis");
  assert.equal(r.totals.logins, 7);
  assert.equal(r.peakHour, 8);
  assert.equal(r.buckets.reduce((a, b) => a + b.count, 0), 7);
  assert.deepEqual(r.active, { last24h: 2, last7d: 4, last30d: 6 });
  assert.deepEqual(r.inactive, { since30d: 2, since60d: 1, since90d: 0, accountsWithLogin: 6 });
  assert.equal(r.neverLoggedIn, 9);
  assert.equal(r.accounts, 15);
  assert.equal(r.since, "2026-11-02T00:00:00.000Z");
  assert.deepEqual(r.devices, { mobile: 6, desktop: 1 });
  assert.equal(r.week.busiestDay, "mercredi");
  assert.ok(r.notes.length >= 3);
});

test("service : SQL paramétré, seulement les connexions réussies ; aucune donnée personnelle sélectionnée", async () => {
  const db = fakeDb([]);
  const oc = createOwnerCenter({ db, accounts, clock: () => NOW });
  await oc.connections("root", { days: 30 });
  assert.ok(db.calls.length >= 8);
  for (const c of db.calls) {
    assert.match(c.sql, /ika_(security_log|users)/);
    assert.doesNotMatch(c.sql, /\bdetail\b|\bip\b|email|user_agent/i);
    assert.ok(!c.sql.includes("2026-"), "aucune date écrite dans le texte SQL");
  }
  for (const c of db.calls.filter((x) => /ika_security_log/.test(x.sql))) assert.match(c.sql, /event = 'LOGIN' and (\w+\.)?outcome = 'OK'/);
});

test("service : table du journal absente = indisponible, pas de chiffres inventés", async () => {
  const db = { query: async () => { throw new Error('relation "ika_security_log" does not exist'); }, transaction: async (fn) => fn({ query: async () => [] }) };
  const oc = createOwnerCenter({ db, accounts, clock: () => NOW });
  assert.deepEqual(await oc.connections("root"), { available: false, days: 30 });
});

test("service : la période est bornée à 90 jours", async () => {
  const oc = createOwnerCenter({ db: fakeDb([]), accounts, clock: () => NOW });
  assert.equal((await oc.connections("root", { days: 500 })).days, 90);
  assert.equal((await oc.connections("root", { days: 0 })).days, 1);
});
