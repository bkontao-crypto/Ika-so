import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests } from "../server/services/premium-requests.js";

function build(rows = []) {
  const calls = [];
  const db = { async query(sql, params) { calls.push({ sql, params }); if (/select id from ika_premium_requests/.test(sql)) return []; if (/returning id/.test(sql)) return rows; return []; } };
  const svc = createPremiumRequests({ db, accounts: { requireActive: async () => {}, requireSmsPhone: async () => {} }, notify: null, superadminSettings: null, moderationAudit: null, payments: { onlineOpen: async () => false } });
  return { svc, calls };
}
const ok = { months: 1, accountType: "AGENCY", phone: "76 00 00 00", message: " Bonjour ", acceptTerms: true };

test("demande Premium : champs obligatoires contrôlés côté serveur", async () => {
  const { svc } = build();
  await assert.rejects(svc.create("u1", { ...ok, accountType: "X" }), /type de compte/);
  await assert.rejects(svc.create("u1", { ...ok, phone: "12" }), /téléphone/);
  await assert.rejects(svc.create("u1", { ...ok, acceptTerms: false }), /accepter les conditions/);
  await assert.rejects(svc.create("u1", { ...ok, months: 9 }), /Durée invalide/);
});

test("demande Premium : enregistrement nettoyé (téléphone, message tronqué, acceptation datée)", async () => {
  const { svc, calls } = build();
  const r = await svc.create("u1", { ...ok, message: "  " + "a".repeat(600) });
  assert.equal(r.ok, true);
  const ins = calls.find((c) => /insert into ika_premium_requests/.test(c.sql));
  assert.equal(ins.params[4], "76000000");
  assert.equal(ins.params[5].length, 500);
  assert.match(ins.sql, /accepted_terms_at/);
});

test("annulation : seulement une demande en attente de l'annonceur", async () => {
  await assert.rejects(build([]).svc.cancel("u1", "pr_1"), /Aucune demande/);
  assert.deepEqual(await build([{ id: "pr_1" }]).svc.cancel("u1", "pr_1"), { ok: true });
});

test("refus : le motif est obligatoire", async () => {
  const db = { async query() { return []; }, async transaction(fn) { return fn({ query: async () => [{ id: "pr_1", status: "PENDING", user_id: "u1" }] }); } };
  const svc = createPremiumRequests({ db, accounts: {}, notify: null, superadminSettings: null, moderationAudit: null, payments: {} });
  await assert.rejects(svc.decide("s1", "pr_1", { action: "REJECT", note: "" }), /motif/);
});
