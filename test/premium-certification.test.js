import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests } from "../server/services/premium-requests.js";

function build({ certified }) {
  const notes = [];
  const q = async (sql) => {
    if (/select \* from ika_premium_requests where id/.test(sql)) return [{ id: "r1", user_id: "u1", status: "PENDING" }];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ premium_until: new Date(Date.now() + 86400000 * 30) }];
    if (/agency_verified_at is not null as agency/.test(sql)) return [{ agency: certified, titles: 0 }];
    if (/ika_superadmin_settings|select value/.test(sql)) return [];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const superadminSettings = { get: async () => null };
  const svc = createPremiumRequests({ db, accounts: { requireActive: async () => {}, requireStaff: async () => ({}) }, notify: async (u, n) => notes.push(n), superadminSettings, moderationAudit: null, payments: { onlineOpen: async () => false }, requestsHub: null });
  return { svc, notes };
}

test("approbation Premium : profil certifié → message et lien vers le centre", async () => {
  const { svc, notes } = build({ certified: true });
  const r = await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.equal(r.certified, true);
  assert.match(notes[0].body, /centre de contrôle est ouvert/);
  assert.equal(notes[0].link, "#/centre");
});
test("approbation Premium : profil non certifié → le message dit quoi faire", async () => {
  const { svc, notes } = build({ certified: false });
  const r = await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.equal(r.certified, false);
  assert.match(notes[0].body, /Dernière étape : faire certifier/);
  assert.equal(notes[0].link, "#/devenir-premium");
});
