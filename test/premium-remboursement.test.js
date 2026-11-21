import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests, REFUND_STEPS } from "../server/services/premium-requests.js";

function setup({ paid = true, refundStatus = "OPEN" } = {}) {
  const steps = [], audit = [], notes = [], refunds = [];
  let refund = { id: "rf1", request_id: "r1", user_id: "u1", status: refundStatus };
  const request = { id: "r1", user_id: "u1", status: "PENDING", paid, months: 1 };
  const q = async (sql, args = []) => {
    if (/select \* from ika_premium_requests where id/.test(sql)) return [request];
    if (/insert into ika_premium_refunds/.test(sql)) { refunds.push(args); return []; }
    if (/select \* from ika_premium_refunds where id/.test(sql)) return [refund];
    if (/insert into ika_premium_refund_steps/.test(sql)) { if (steps.some((s) => s.step === args[1])) return []; steps.push({ step: args[1], done_by: args[2] }); return [{ step: args[1] }]; }
    if (/select count\(\*\)::int as n from ika_premium_refund_steps/.test(sql)) return [{ n: steps.length }];
    if (/delete from ika_premium_refund_steps/.test(sql)) { const i = steps.findIndex((s) => s.step === args[1]); return i < 0 ? [] : [{ done_by: steps.splice(i, 1)[0].done_by }]; }
    if (/update ika_premium_refunds set status = 'DONE'/.test(sql)) { refund = { ...refund, status: "DONE" }; return []; }
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const svc = createPremiumRequests({ db, accounts: {}, notify: async (u, n) => notes.push({ u, ...n }), superadminSettings: null, moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) }, payments: {} });
  return { svc, steps, audit, notes, refunds };
}

test("refus d'un dossier payé : un suivi de remboursement est ouvert ; refus d'un dossier non payé : aucun", async () => {
  const a = setup({ paid: true });
  await a.svc.decide("s1", "r1", { action: "REJECT", note: "Pièces non conformes" });
  assert.equal(a.refunds.length, 1);
  assert.equal(a.refunds[0][1], "r1");
  const b = setup({ paid: false });
  await b.svc.decide("s1", "r1", { action: "REJECT", note: "Pièces non conformes" });
  assert.equal(b.refunds.length, 0);
});

test("remboursement : étapes tracées, pas de notification avant la dernière, clôture et notification à la 3e", async () => {
  const { svc, steps, audit, notes } = setup();
  await svc.completeRefundStep("a1", "rf1", 2, { note: "Réf. fournisseur 123" });
  await svc.completeRefundStep("a1", "rf1", 1);
  assert.equal(notes.length, 0);
  assert.equal(audit[0].action, "PREMIUM_REFUND_STEP_DONE");
  await assert.rejects(svc.completeRefundStep("a2", "rf1", 1), /déjà validée/);
  await assert.rejects(svc.completeRefundStep("a1", "rf1", 4), /Étape inconnue/);
  const last = await svc.completeRefundStep("a3", "rf1", 3);
  assert.equal(last.complete, true);
  assert.equal(steps.length, 3);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].u, "u1");
  assert.equal(notes[0].kind, "PREMIUM");
  assert.equal(REFUND_STEPS[3], "Annonceur informé");
});

test("remboursement : retrait avec motif obligatoire ; suivi clôturé = plus de modification", async () => {
  const { svc, steps } = setup();
  await svc.completeRefundStep("a1", "rf1", 1);
  await assert.rejects(svc.undoRefundStep("a2", "rf1", 1, {}), /pourquoi/);
  await svc.undoRefundStep("a2", "rf1", 1, { note: "Mauvais paiement" });
  assert.equal(steps.length, 0);
  const closed = setup({ refundStatus: "DONE" });
  await assert.rejects(closed.svc.completeRefundStep("a1", "rf1", 1), /déjà clôturé/);
});
