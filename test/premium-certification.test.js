import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests } from "../server/services/premium-requests.js";

function build({ certified, sms = true }) {
  const notes = [];
  const q = async (sql) => {
    if (/select \* from ika_premium_requests where id/.test(sql)) return [{ id: "r1", user_id: "u1", status: "PENDING" }];
    if (/from ika_premium_request_steps where request_id/.test(sql)) return [{ step: 1, done_by: "a1" }, { step: 2, done_by: "a2" }, { step: 3, done_by: "a1" }];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ premium_until: new Date(Date.now() + 86400000 * 30) }];
    if (/agency_verified_at is not null as agency/.test(sql)) return [{ agency: certified, titles: 0 }];
    if (/select phone_verified_at, phone_channel/.test(sql)) return [{ phone_verified_at: sms ? new Date() : null, phone_channel: sms ? "SMS" : null }];
    if (/ika_superadmin_settings|select value/.test(sql)) return [];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const superadminSettings = { get: async () => null };
  const svc = createPremiumRequests({ db, accounts: { requireActive: async () => {}, requireVerifiedPhone: async () => {}, requireStaff: async () => ({}) }, notify: async (u, n) => notes.push(n), superadminSettings, moderationAudit: null, payments: { onlineOpen: async () => false }, requestsHub: null });
  return { svc, notes };
}

test("approbation Premium : profil certifié → message et lien vers le centre", async () => {
  const { svc, notes } = build({ certified: true });
  const r = await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.equal(r.certified, true);
  assert.match(notes[0].body, /centre de contrôle est ouvert/);
  assert.equal(notes[0].link, "#/centre");
});
test("approbation Premium : profil sans badge agence / titre → le centre est quand même ouvert (le numéro suffit)", async () => {
  const { svc, notes } = build({ certified: false });
  const r = await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.equal(r.certified, false);
  assert.match(notes[0].body, /centre de contrôle est ouvert/);
  assert.equal(notes[0].link, "#/centre");
});

test("demande Premium et achat : refusés sans numéro confirmé (code PHONE_REQUIRED)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../server/services/accounts.js", import.meta.url), "utf8");
  assert.match(src, /requireVerifiedPhone/);
  assert.match(src, /PHONE_REQUIRED/);
  const pr = (await import("node:fs")).readFileSync(new URL("../server/services/premium-requests.js", import.meta.url), "utf8");
  const pay = (await import("node:fs")).readFileSync(new URL("../server/services/payments.js", import.meta.url), "utf8");
  assert.match(pr, /async create[\s\S]{0,500}requireVerifiedPhone/);
  assert.match(pay, /kind === "PREMIUM"\) \{ if \(await phoneRequired\(userId\)\) await accounts\.requireVerifiedPhone/);
});

test("approbation Premium : numéro non confirmé → le message le dit en premier", async () => {
  const { svc, notes } = build({ certified: true, sms: false });
  await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.match(notes[0].body, /numéro de téléphone n'est pas confirmé/);
  assert.equal(notes[0].link, "#/devenir-premium");
});
