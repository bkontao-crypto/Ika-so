import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests } from "../server/services/premium-requests.js";

function build({ certified, sms = true }) {
  const notes = [];
  const q = async (sql) => {
    if (/select \* from ika_premium_requests where id/.test(sql)) return [{ id: "r1", user_id: "u1", status: "PENDING" }];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ premium_until: new Date(Date.now() + 86400000 * 30) }];
    if (/agency_verified_at is not null as agency/.test(sql)) return [{ agency: certified, titles: 0 }];
    if (/select phone_verified_at, phone_channel/.test(sql)) return [{ phone_verified_at: sms ? new Date() : null, phone_channel: sms ? "SMS" : null }];
    if (/ika_superadmin_settings|select value/.test(sql)) return [];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const superadminSettings = { get: async () => null };
  const svc = createPremiumRequests({ db, accounts: { requireActive: async () => {}, requireSmsPhone: async () => {}, requireStaff: async () => ({}) }, notify: async (u, n) => notes.push(n), superadminSettings, moderationAudit: null, payments: { onlineOpen: async () => false }, requestsHub: null });
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

test("demande Premium et achat : refusés sans numéro vérifié par SMS (code PHONE_REQUIRED)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../server/services/accounts.js", import.meta.url), "utf8");
  assert.match(src, /requireSmsPhone/);
  assert.match(src, /PHONE_REQUIRED/);
  const pr = (await import("node:fs")).readFileSync(new URL("../server/services/premium-requests.js", import.meta.url), "utf8");
  const pay = (await import("node:fs")).readFileSync(new URL("../server/services/payments.js", import.meta.url), "utf8");
  assert.match(pr, /async create[\s\S]{0,200}requireSmsPhone/);
  assert.match(pay, /kind === "PREMIUM"\) \{ await accounts\.requireSmsPhone/);
});

test("approbation Premium : numéro non confirmé par SMS → le message le dit en premier", async () => {
  const { svc, notes } = build({ certified: true, sms: false });
  await svc.decide("staff", "r1", { action: "APPROVE", months: 1 });
  assert.match(notes[0].body, /numéro de téléphone n'est pas confirmé par SMS/);
  assert.equal(notes[0].link, "#/devenir-premium");
});
