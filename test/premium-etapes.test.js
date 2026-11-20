import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests, STEPS } from "../server/services/premium-requests.js";

function setup({ paid = false, status = "PENDING" } = {}) {
  const steps = [];
  const audit = [];
  const notes = [];
  let request = { id: "r1", user_id: "u1", status, paid, months: 1 };
  const q = async (sql, args = []) => {
    if (/select \* from ika_premium_requests where id/.test(sql)) return [request];
    if (/insert into ika_premium_request_steps/.test(sql)) { if (steps.some((s) => s.step === args[1])) return []; steps.push({ step: args[1], done_by: args[2], note: args[3] }); return [{ step: args[1] }]; }
    if (/select p.full_name from ika_premium_request_steps/.test(sql)) return [{ full_name: "Awa Admin" }];
    if (/select count\(\*\)::int as n from ika_premium_request_steps/.test(sql)) return [{ n: steps.length }];
    if (/delete from ika_premium_request_steps/.test(sql)) { const i = steps.findIndex((s) => s.step === args[1]); return i < 0 ? [] : [{ done_by: steps.splice(i, 1)[0].done_by }]; }
    if (/select step, done_by from ika_premium_request_steps/.test(sql)) return steps.map((s) => ({ step: s.step, done_by: s.done_by }));
    if (/update ika_premium_requests set status = 'APPROVED'/.test(sql)) { request = { ...request, status: "APPROVED" }; return []; }
    if (/update ika_profiles set premium_until/.test(sql)) return [{ premium_until: new Date(Date.now() + 30 * 864e5) }];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const svc = createPremiumRequests({ db, accounts: {}, notify: async (u, n) => notes.push(n), superadminSettings: null, moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) }, payments: {} });
  return { svc, steps, audit, notes };
}

test("étapes : indépendantes, tracées à la personne, déjà validée refusée", async () => {
  const { svc, steps, audit } = setup();
  await svc.completeStep("a1", "r1", 3, { note: "Identité vue" });
  await svc.completeStep("a2", "r1", 1);
  assert.deepEqual(steps.map((s) => [s.step, s.done_by]), [[3, "a1"], [1, "a2"]]);
  assert.equal(audit[0].action, "PREMIUM_STEP_DONE");
  assert.equal(audit[0].details.label, STEPS[3]);
  await assert.rejects(svc.completeStep("a3", "r1", 1), /déjà validée par Awa Admin/);
  await assert.rejects(svc.completeStep("a1", "r1", 4), /Étape inconnue/);
});

test("approbation impossible tant que les 3 étapes ne sont pas validées, puis possible", async () => {
  const { svc, audit } = setup();
  await svc.completeStep("a1", "r1", 1);
  await assert.rejects(svc.decide("a1", "r1", { action: "APPROVE", months: 1 }), /Vérification, Confirmation/);
  await svc.completeStep("a2", "r1", 2);
  const last = await svc.completeStep("a3", "r1", 3);
  assert.equal(last.complete, true);
  const out = await svc.decide("a3", "r1", { action: "APPROVE", months: 1 });
  assert.equal(out.status, "APPROVED");
  const done = audit.find((a) => a.action === "PREMIUM_REQUEST_APPROVE");
  assert.deepEqual(done.details.steps.map((s) => s.by), ["a1", "a2", "a3"]);
});

test("retrait d'une validation : motif obligatoire et trace de la personne précédente", async () => {
  const { svc, steps, audit } = setup();
  await svc.completeStep("a1", "r1", 2);
  await assert.rejects(svc.undoStep("a2", "r1", 2, {}), /pourquoi/);
  await svc.undoStep("a2", "r1", 2, { note: "Pièce illisible" });
  assert.equal(steps.length, 0);
  assert.equal(audit.at(-1).details.previousBy, "a1");
  await assert.rejects(svc.undoStep("a2", "r1", 2, { note: "encore" }), /n'était pas validée/);
});

test("dossier payé : l'approbation certifie sans accorder de mois supplémentaires", async () => {
  const { svc, notes } = setup({ paid: true });
  for (const n of [1, 2, 3]) await svc.completeStep("a1", "r1", n);
  const out = await svc.decide("a2", "r1", { action: "APPROVE" });
  assert.equal(out.paid, true);
  assert.match(notes[0].title, /certifié/);
});

test("demande déjà traitée : plus d'étape possible", async () => {
  const { svc } = setup({ status: "APPROVED" });
  await assert.rejects(svc.completeStep("a1", "r1", 1), /déjà été traitée/);
});

test("création : paiement ouvert sans Premium actif → refus ; Premium payé → dossier marqué payé avec délai", async () => {
  const inserts = [];
  const mk = (active) => createPremiumRequests({
    db: { query: async (sql, args = []) => { if (/select premium_until/.test(sql)) return [{ premium_until: active ? new Date(Date.now() + 864e5) : null }]; if (/insert into ika_premium_requests/.test(sql)) inserts.push(args); return []; } },
    accounts: { requireActive: async () => ({}), requireVerifiedPhone: async () => ({}) }, notify: null, superadminSettings: { get: async () => ({ reviewDelayDays: 5 }) }, payments: { onlineOpen: async () => true },
  });
  const body = { accountType: "AGENCY", phone: "76 00 00 00", acceptTerms: true };
  await assert.rejects(mk(false).create("u1", body), /payez d'abord/);
  const out = await mk(true).create("u1", body);
  assert.equal(out.reviewDelayDays, 5);
  assert.equal(inserts[0][6], true);
  assert.equal(inserts[0][7], "5");
});
