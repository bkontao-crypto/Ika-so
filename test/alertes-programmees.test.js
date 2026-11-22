import test from "node:test";
import assert from "node:assert/strict";
import { createAlerts, effectiveStatus } from "../server/services/alerts.js";

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
test("statut affiché : expirée d'après la date de fin, programmée avant le début, pause conservée", () => {
  assert.equal(effectiveStatus({ status: "ACTIVE", starts_on: day(-5), ends_on: day(-1) }), "EXPIRED");
  assert.equal(effectiveStatus({ status: "ACTIVE", starts_on: day(2), ends_on: day(9) }), "SCHEDULED");
  assert.equal(effectiveStatus({ status: "ACTIVE", starts_on: day(-1), ends_on: day(3) }), "ACTIVE");
  assert.equal(effectiveStatus({ status: "PAUSED", starts_on: null, ends_on: null }), "PAUSED");
  assert.equal(effectiveStatus({ status: "ACTIVE", starts_on: null, ends_on: null }), "ACTIVE");
});

function mk({ rules = {}, existing = 0 } = {}) {
  const inserts = [], hist = [];
  const db = { query: async (sql, a = []) => {
    if (/count\(\*\)::int as n from ika_saved_searches/.test(sql)) return [{ n: existing }];
    if (/insert into ika_saved_searches/.test(sql)) { inserts.push(a); return []; }
    if (/insert into ika_alert_history/.test(sql)) { hist.push(a[4]); return []; }
    return [];
  } };
  const svc = createAlerts({ db, accounts: { requireActive: async () => ({}) }, rules: { official: async () => ({ alertsEnabled: true, alertsMaxPerUser: 10, alertsMaxDays: 90, ...rules }) }, moderationAudit: null, engagement: {} });
  return { svc, inserts, hist };
}
test("création : dates obligatoires ensemble, fin après début, durée max, prix cohérents", async () => {
  const { svc } = mk();
  await assert.rejects(svc.create("u", { startsOn: day(0), filters: { category: "Maison" } }), /date de fin/);
  await assert.rejects(svc.create("u", { endsOn: day(5), filters: { category: "Maison" } }), /date de début/);
  await assert.rejects(svc.create("u", { startsOn: day(5), endsOn: day(2), filters: {} }), /après la date de début/);
  await assert.rejects(svc.create("u", { startsOn: day(0), endsOn: day(120), filters: {} }), /90 jours/);
  await assert.rejects(svc.create("u", { startsOn: day(0), endsOn: day(5), filters: { minPrice: 300, maxPrice: 100 } }), /minimum dépasse/);
});
test("création valide : critères vides = sans restriction, historique tracé ; plafond et interrupteur respectés", async () => {
  const { svc, inserts, hist } = mk();
  const out = await svc.create("u", { startsOn: day(0), endsOn: day(30), filters: {} });
  assert.equal(out.label, "Toutes les annonces"); assert.equal(inserts.length, 1); assert.deepEqual(hist, ["CREATED"]);
  await assert.rejects(mk({ existing: 10 }).svc.create("u", { startsOn: day(0), endsOn: day(5), filters: {} }), /déjà 10 alertes/);
  await assert.rejects(mk({ rules: { alertsEnabled: false } }).svc.create("u", { startsOn: day(0), endsOn: day(5), filters: {} }), /indisponibles/);
});
