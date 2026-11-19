import test from "node:test";
import assert from "node:assert/strict";
import { createRequestsHub } from "../server/services/requests-hub.js";

const old = new Date(Date.now() - 72 * 3600_000).toISOString();
const fresh = new Date().toISOString();
function db() {
  return { async query(sql) {
    if (/count\(\*\)/.test(sql)) return [{ n: 2 }];
    if (/from ika_advertiser_applications/.test(sql)) return [{ id: "a1", type: "AGENCE", status: "PENDING", created_at: old, full_name: "Mali Immo", email: "x@y.z" }];
    if (/from ika_listings l/.test(sql)) return [{ id: "l1", title: "Villa", neighborhood: "ACI", created_at: fresh, full_name: "Baba" }];
    if (/ika_featured_requests/.test(sql)) return [];
    if (/ika_premium_requests/.test(sql)) return [{ id: "p1", months: 2, account_type: "AGENCY", created_at: fresh, full_name: "Baba" }];
    if (/staff_role in/.test(sql)) return [{ user_id: "s1" }, { user_id: "s2" }];
    return [];
  } };
}

test("hub : un superadmin voit les 4 types, avec retard signalé après 48 h", async () => {
  const hub = createRequestsHub({ db: db(), ownerDelegations: { gate: async () => true }, notify: null });
  const r = await hub.summary("su");
  assert.deepEqual(r.sections.map((s) => s.key), ["advertisers", "listings", "featured", "premium"]);
  assert.equal(r.sections[0].items[0].late, true);
  assert.equal(r.sections[1].items[0].late, false);
  assert.equal(r.pending, 8);
});

test("hub : un administrateur sans délégation ne voit que ce qui lui est délégué", async () => {
  const hub = createRequestsHub({ db: db(), ownerDelegations: { gate: async (_u, m) => m === "payments" }, notify: null });
  const r = await hub.summary("ad");
  assert.deepEqual(r.sections.map((s) => s.key), ["premium"]);
});

test("notification de l'équipe : seuls les habilités reçoivent, un échec ne bloque pas", async () => {
  const got = [];
  const hub = createRequestsHub({ db: db(), ownerDelegations: { gate: async (u) => u === "s1" }, notify: async (u, n) => { got.push([u, n.kind]); } });
  await hub.notifyStaff({ kind: "PREMIUM_REQUEST", title: "t", link: "/owner#/requests", module: "payments" });
  assert.deepEqual(got, [["s1", "PREMIUM_REQUEST"]]);
  const bad = createRequestsHub({ db: { query: async () => { throw new Error("boom"); } }, ownerDelegations: {}, notify: async () => {} });
  await bad.notifyStaff({ kind: "X", title: "t" });
});
