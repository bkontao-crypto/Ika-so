// Conditions officielles (superadmin) + exceptions tracées par compte : le code applique la décision, sans règle figée.
import test from "node:test";
import assert from "node:assert/strict";
import { createPremiumRequests } from "../server/services/premium-requests.js";
import { createRuleExceptions } from "../server/services/rule-exceptions.js";
import { normalizeRules, DEFAULT_RULES } from "../server/lib/account-rules.js";

function world({ settings = null, exceptions = [], role = "SUPERADMIN" } = {}) {
  const store = { account_rules: settings };
  const rows = [...exceptions];
  const audit = [], steps = [], sets = [];
  const request = { id: "r1", user_id: "u1", status: "PENDING", paid: false, months: 1 };
  const q = async (sql, args = []) => {
    if (/select rule from ika_rule_exceptions/.test(sql)) return rows.filter((e) => e.user_id === args[0] && !e.revoked_at).map((e) => ({ rule: e.rule }));
    if (/select user_id from ika_profiles where user_id/.test(sql)) return args[0] === "u1" ? [{ user_id: "u1" }] : [];
    if (/insert into ika_rule_exceptions/.test(sql)) { if (rows.some((e) => e.user_id === args[1] && e.rule === args[2] && !e.revoked_at)) return []; rows.push({ id: args[0], user_id: args[1], rule: args[2], reason: args[3], granted_by: args[4] }); return [{ id: args[0] }]; }
    if (/update ika_rule_exceptions set revoked_at/.test(sql)) { const e = rows.find((x) => x.id === args[0] && !x.revoked_at); if (!e) return []; e.revoked_at = new Date(); return [{ user_id: e.user_id, rule: e.rule }]; }
    if (/select \* from ika_premium_requests where id/.test(sql)) return [request];
    if (/insert into ika_premium_request_steps/.test(sql)) { steps.push({ step: args[1], done_by: args[2] }); return [{ step: args[1] }]; }
    if (/select step, done_by from ika_premium_request_steps/.test(sql)) return steps.map((s) => ({ ...s }));
    if (/select count\(\*\)::int as n from ika_premium_request_steps/.test(sql)) return [{ n: steps.length }];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ premium_until: new Date(Date.now() + 30 * 864e5) }];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const superadminSettings = { get: async (k) => store[k] ?? null, set: async (a, k, v) => { store[k] = v; sets.push({ a, k, v }); } };
  const accounts = { requireStaff: async (_u, min) => { const rank = { MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 }; if (rank[role] < rank[min]) throw new Error("Réservé"); }, requireActive: async () => ({}), requireVerifiedPhone: async () => { throw new Error("PHONE"); } };
  const moderationAudit = { log: async (who, e) => audit.push({ who, ...e }) };
  const rules = createRuleExceptions({ db, superadminSettings, accounts, moderationAudit });
  const svc = createPremiumRequests({ db, accounts, notify: null, superadminSettings, moderationAudit, payments: { onlineOpen: async () => false }, rules });
  return { rules, svc, rows, audit, steps, sets, store };
}

test("conditions officielles : valeurs par défaut sûres, entrées invalides corrigées", () => {
  assert.deepEqual(normalizeRules(null), { ...DEFAULT_RULES, requiredSteps: [1, 2, 3] });
  const v = normalizeRules({ requiredSteps: [3, 3, 9, "1"], exceptionGrantedBy: "ROOT", phoneConfirmedForPremium: false });
  assert.deepEqual(v.requiredSteps, [1, 3]);
  assert.equal(v.exceptionGrantedBy, "SUPERADMIN");
  assert.equal(v.phoneConfirmedForPremium, false);
});

test("le superadmin change les conditions officielles : avant/après tracés ; un administrateur ne le peut pas", async () => {
  const w = world();
  await w.rules.saveOfficial("sa", { requiredSteps: [1, 2], phoneConfirmedForPremium: true });
  assert.deepEqual(w.store.account_rules.requiredSteps, [1, 2]);
  const log = w.audit.find((a) => a.action === "RULES_UPDATE");
  assert.deepEqual(log.details.before.requiredSteps, [1, 2, 3]);
  assert.deepEqual(log.details.after.requiredSteps, [1, 2]);
  await assert.rejects(world({ role: "ADMIN" }).rules.saveOfficial("ad", {}), /Réservé/);
});

test("approbation : suit les étapes exigées par le superadmin (2 sur 3), sans toucher au code", async () => {
  const w = world({ settings: { requiredSteps: [1, 2] } });
  await w.svc.completeStep("a1", "r1", 1);
  await assert.rejects(w.svc.decide("a1", "r1", { action: "APPROVE", months: 1 }), /Vérification/);
  const r = await w.svc.completeStep("a2", "r1", 2);
  assert.equal(r.complete, true);
  assert.equal((await w.svc.decide("a2", "r1", { action: "APPROVE", months: 1 })).status, "APPROVED");
});

test("exception : lève l'étape 3 pour ce compte seulement, motif obligatoire, tracée dans l'audit d'approbation", async () => {
  const w = world();
  await assert.rejects(w.rules.grant("sa", "u1", { rule: "step3", reason: "ok" }), /motif/);
  await assert.rejects(w.rules.grant("sa", "u1", { rule: "inconnue", reason: "motif valable" }), /inconnue/);
  await assert.rejects(w.rules.grant("sa", "zz", { rule: "step3", reason: "motif valable" }), /introuvable/);
  await w.rules.grant("sa", "u1", { rule: "step3", reason: "Agence connue, dossier déjà contrôlé en 2025" });
  assert.equal(w.audit.find((a) => a.action === "RULE_EXCEPTION_GRANT").details.reason, "Agence connue, dossier déjà contrôlé en 2025");
  await w.svc.completeStep("a1", "r1", 1);
  const r = await w.svc.completeStep("a1", "r1", 2);
  assert.equal(r.complete, true);
  await w.svc.decide("a1", "r1", { action: "APPROVE", months: 1 });
  const ap = w.audit.find((a) => a.action === "PREMIUM_REQUEST_APPROVE");
  assert.deepEqual(ap.details.rules.waivedSteps, [3]);
  assert.deepEqual(ap.details.rules.exceptions, ["step3"]);
});

test("exception unique active par condition ; révocation avec motif ; après révocation, la condition s'applique à nouveau", async () => {
  const w = world();
  const g = await w.rules.grant("sa", "u1", { rule: "step1", reason: "Cas particulier validé" });
  await assert.rejects(w.rules.grant("sa", "u1", { rule: "step1", reason: "Cas particulier bis" }), /déjà active/);
  await assert.rejects(w.rules.revoke("sa", g.id, {}), /pourquoi/);
  await w.rules.revoke("sa", g.id, { reason: "Délai écoulé" });
  assert.equal((await w.rules.activeKeys("u1")).size, 0);
  assert.ok(w.audit.some((a) => a.action === "RULE_EXCEPTION_REVOKE"));
  await assert.rejects(w.svc.decide("a1", "r1", { action: "APPROVE", months: 1 }), /Étude/);
});

test("qui accorde une exception est décidé par le superadmin : défaut superadmin seul, puis administrateurs si autorisé", async () => {
  const strict = world({ role: "ADMIN" });
  await assert.rejects(strict.rules.grant("ad", "u1", { rule: "phone", reason: "motif valable" }), /Réservé/);
  const open = world({ role: "ADMIN", settings: { exceptionGrantedBy: "ADMIN" } });
  await open.rules.grant("ad", "u1", { rule: "phone", reason: "motif valable" });
  assert.equal(open.rows[0].granted_by, "ad");
});

test("numéro : exigé par défaut ; levé par la condition officielle ou par une exception sur le compte", async () => {
  const body = { accountType: "AGENCY", phone: "76 00 00 00", acceptTerms: true, months: 1 };
  await assert.rejects(world().svc.create("u1", body), /PHONE/);
  const off = world({ settings: { phoneConfirmedForPremium: false } });
  assert.equal((await off.svc.create("u1", body)).ok, true);
  const ex = world();
  await ex.rules.grant("sa", "u1", { rule: "phone", reason: "Réseau SMS indisponible chez son opérateur" });
  assert.equal((await ex.svc.create("u1", body)).ok, true);
});
