// Critères de certification du centre de contrôle : réglage officiel (superadmin) + exception tracée « certification ».
// Règle pure, enregistrement validé, accès réel du centre avec le service de règles de main, et compatibilité avec l'ancien comportement.
import test from "node:test";
import assert from "node:assert/strict";
import { CRITERIA, DEFAULT_GROUPS, describeGroups, evaluateGroups, factsFromRow, normalizeGroups, sameGroups } from "../server/lib/certification-criteria.js";
import { DEFAULT_RULES, EXCEPTION_RULES, normalizeRules } from "../server/lib/account-rules.js";
import { premiumAccess } from "../server/lib/advertiser-ranking.js";
import { createRuleExceptions } from "../server/services/rule-exceptions.js";
import { createAdvertiserCenter } from "../server/services/advertiser-center.js";

const future = new Date(Date.now() + 30 * 864e5).toISOString();

test("critères : connus seulement, forme canonique, doublons retirés, refus des entrées invalides", () => {
  assert.deepEqual(normalizeGroups([["TITRE_FONCIER", "AGENCY_RCCM", "AGENCY_RCCM"], ["PHONE_VERIFIED"]]), [["AGENCY_RCCM", "TITRE_FONCIER"], ["PHONE_VERIFIED"]]);
  assert.deepEqual(normalizeGroups([["PHONE_VERIFIED"], ["PHONE_VERIFIED"]]), [["PHONE_VERIFIED"]]);
  for (const bad of [[], null, "x", [[]], [["INCONNU"]], [["PHONE_VERIFIED"], "x"], Array.from({ length: 6 }, () => ["PHONE_VERIFIED"])]) {
    assert.throws(() => normalizeGroups(bad), (e) => e.status === 400, JSON.stringify(bad));
  }
  assert.equal(sameGroups([["AGENCY_RCCM", "TITRE_FONCIER"]], [["TITRE_FONCIER", "AGENCY_RCCM"]]), true);
  assert.equal(sameGroups([["AGENCY_RCCM"]], [["TITRE_FONCIER"]]), false);
});

test("règle : OU dans une condition, ET entre les conditions, critère absent ou inconnu = non rempli", () => {
  const rccmOuTitre = [["AGENCY_RCCM", "TITRE_FONCIER"]];
  assert.equal(evaluateGroups(rccmOuTitre, { AGENCY_RCCM: true }).satisfied, true);
  assert.equal(evaluateGroups(rccmOuTitre, { TITRE_FONCIER: true }).satisfied, true);
  assert.equal(evaluateGroups(rccmOuTitre, { PHONE_VERIFIED: true }).satisfied, false);
  const telEtPreuve = [["PHONE_VERIFIED"], ["AGENCY_RCCM", "TITRE_FONCIER"]];
  assert.equal(evaluateGroups(telEtPreuve, { PHONE_VERIFIED: true }).satisfied, false);
  assert.equal(evaluateGroups(telEtPreuve, { PHONE_VERIFIED: true, TITRE_FONCIER: true }).satisfied, true);
  assert.equal(evaluateGroups([["CRITERE_RETIRE_DU_CODE"]], { CRITERE_RETIRE_DU_CODE: true }).groups[0].criteria[0].label, "CRITERE_RETIRE_DU_CODE");
  assert.equal(evaluateGroups([], {}).satisfied, false, "une règle vide n'ouvre jamais l'accès");
  assert.equal(describeGroups(telEtPreuve), `${CRITERIA.PHONE_VERIFIED} ET (${CRITERIA.AGENCY_RCCM} OU ${CRITERIA.TITRE_FONCIER})`);
  assert.deepEqual(factsFromRow({ phone_verified_at: new Date(), agency_verified_at: null, title_checked: 2 }), { PHONE_VERIFIED: true, AGENCY_RCCM: false, TITRE_FONCIER: true });
});

test("conditions officielles : défaut = comportement d'avant (numéro confirmé), valeur invalide relue sans casser le site", () => {
  assert.deepEqual(normalizeRules(null).certificationGroups, [["PHONE_VERIFIED"]]);
  assert.deepEqual(DEFAULT_RULES.certificationGroups, DEFAULT_GROUPS);
  assert.deepEqual(normalizeRules({ certificationGroups: [["TITRE_FONCIER", "AGENCY_RCCM"]] }).certificationGroups, [["AGENCY_RCCM", "TITRE_FONCIER"]]);
  assert.deepEqual(normalizeRules({ certificationGroups: [["X"]] }).certificationGroups, [["PHONE_VERIFIED"]], "réglage corrompu en base : retour au défaut");
  assert.equal(Object.hasOwn(EXCEPTION_RULES, "certification"), true);
});

test("accès du centre : sans verdict, comportement historique ; avec verdict, il décide ; jamais sans Premium", () => {
  const base = { premiumUntil: future, phoneVerified: true };
  assert.equal(premiumAccess(base).eligible, true);
  assert.equal(premiumAccess({ ...base, phoneVerified: false }).eligible, false);
  assert.equal(premiumAccess({ ...base, certificationOk: false }).eligible, false, "numéro confirmé mais règle non remplie");
  assert.equal(premiumAccess({ ...base, phoneVerified: false, certificationOk: true }).eligible, true);
  assert.equal(premiumAccess({ premiumUntil: null, certificationOk: true }).eligible, false);
});

// ---------- enregistrement et exception avec le vrai service de main ----------
function rulesWorld({ role = "SUPERADMIN", settings = null, exceptions = [] } = {}) {
  const store = { account_rules: settings };
  const audit = [];
  const db = { query: async (sql, args = []) => (/select rule from ika_rule_exceptions/.test(sql) ? exceptions.filter((e) => e.user_id === args[0]).map((e) => ({ rule: e.rule })) : []) };
  const accounts = { requireStaff: async (_u, min) => { const rank = { MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 }; if (rank[role] < rank[min]) throw Object.assign(new Error("Réservé"), { status: 403 }); } };
  const superadminSettings = { get: async (k) => store[k] ?? null, set: async (a, k, v) => { store[k] = v; } };
  const moderationAudit = { log: async (who, e) => audit.push({ who, ...e }) };
  return { rules: createRuleExceptions({ db, superadminSettings, accounts, moderationAudit }), store, audit };
}

test("enregistrer les critères : superadmin seul, critère inconnu ou vide refusé (400), avant/après tracés", async () => {
  const w = rulesWorld();
  const saved = await w.rules.saveOfficial("boss", { certificationGroups: [["TITRE_FONCIER", "AGENCY_RCCM"]] });
  assert.deepEqual(saved.certificationGroups, [["AGENCY_RCCM", "TITRE_FONCIER"]]);
  assert.deepEqual((await w.rules.official()).certificationGroups, [["AGENCY_RCCM", "TITRE_FONCIER"]]);
  assert.deepEqual(w.audit[0].details.before.certificationGroups, [["PHONE_VERIFIED"]]);
  assert.deepEqual(w.audit[0].details.after.certificationGroups, [["AGENCY_RCCM", "TITRE_FONCIER"]]);
  await assert.rejects(w.rules.saveOfficial("boss", { certificationGroups: [["INCONNU"]] }), (e) => e.status === 400);
  await assert.rejects(w.rules.saveOfficial("boss", { certificationGroups: [] }), (e) => e.status === 400);
  assert.deepEqual((await w.rules.official()).certificationGroups, [["AGENCY_RCCM", "TITRE_FONCIER"]], "un refus ne change rien");
  await assert.rejects(rulesWorld({ role: "ADMIN" }).rules.saveOfficial("adm", { certificationGroups: [["PHONE_VERIFIED"]] }), (e) => e.status === 403);
  // une sauvegarde qui ne parle pas des critères les conserve
  const w2 = rulesWorld({ settings: { certificationGroups: [["AGENCY_RCCM"]] } });
  assert.deepEqual((await w2.rules.saveOfficial("boss", { discoverMaxPhotos: 2 })).certificationGroups, [["AGENCY_RCCM"]]);
});

// ---------- accès réel du centre ----------
const profile = (over = {}) => [/from ika_profiles p where p\.user_id/, () => [{ premium_until: future, phone_verified_at: null, agency_verified_at: null, title_checked: 0, account_status: "ACTIVE", full_name: "A", ...over }]];
const fakeDb = (...handlers) => ({ query: async (sql) => { for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql); return []; } });
const center = (profileOver, settings, exceptions = []) => createAdvertiserCenter({ db: fakeDb(profile(profileOver)), accounts: { requireStaff: async () => ({}) }, ruleExceptions: rulesWorld({ settings, exceptions }).rules });

test("centre Premium : la règle officielle ouvre ou ferme l'accès sans toucher au code", async () => {
  // défaut : numéro confirmé
  await assert.rejects(center({}, null).overview("u1"), (e) => e.status === 403 && e.code === "NOT_CERTIFIED");
  assert.deepEqual(await center({ phone_verified_at: new Date() }, null).mapPins("u1"), []);
  // règle « agence vérifiée OU titre foncier » : le numéro seul ne suffit plus, la preuve suffit sans numéro
  const rccm = { certificationGroups: [["AGENCY_RCCM", "TITRE_FONCIER"]] };
  await assert.rejects(center({ phone_verified_at: new Date() }, rccm).mapPins("u1"), (e) => e.status === 403);
  assert.deepEqual(await center({ title_checked: 1 }, rccm).mapPins("u1"), []);
  assert.deepEqual(await center({ agency_verified_at: new Date() }, rccm).mapPins("u1"), []);
});

test("centre Premium : le refus cite la règle en vigueur et l'exception ; l'exception tracée ouvre l'accès à ce compte seulement", async () => {
  const rccm = { certificationGroups: [["AGENCY_RCCM", "TITRE_FONCIER"]] };
  await assert.rejects(center({}, rccm).overview("u1"), (e) => e.status === 403 && e.code === "NOT_CERTIFIED" && /Agence vérifiée/.test(e.message) && /exception/.test(e.message));
  assert.deepEqual(await center({}, rccm, [{ user_id: "u1", rule: "certification" }]).mapPins("u1"), []);
  await assert.rejects(center({}, rccm, [{ user_id: "u2", rule: "certification" }]).mapPins("u1"), (e) => e.status === 403, "l'exception d'un autre compte ne compte pas");
  await assert.rejects(center({}, rccm, [{ user_id: "u1", rule: "phone" }]).mapPins("u1"), (e) => e.status === 403, "une exception sur une autre condition n'ouvre pas le centre");
  await assert.rejects(createAdvertiserCenter({ db: fakeDb([/from ika_profiles p where p\.user_id/, () => [{ premium_until: null, account_status: "ACTIVE" }]]), accounts: {}, ruleExceptions: rulesWorld().rules }).mapPins("u1"), (e) => e.status === 403, "jamais sans Premium, même avec une exception");
  await assert.rejects(createAdvertiserCenter({ db: fakeDb([/from ika_profiles p where p\.user_id/, () => [{ premium_until: null, account_status: "ACTIVE" }]]), accounts: {}, ruleExceptions: rulesWorld({ exceptions: [{ user_id: "u1", rule: "certification" }] }).rules }).overview("u1"), (e) => e.code === "NOT_PREMIUM");
});

test("centre Premium : sans service de règles, l'ancien comportement (numéro confirmé) est inchangé", async () => {
  const legacy = (over) => createAdvertiserCenter({ db: fakeDb(profile(over)), accounts: { requireStaff: async () => ({}) } });
  assert.deepEqual(await legacy({ phone_verified_at: new Date() }).mapPins("u1"), []);
  await assert.rejects(legacy({}).mapPins("u1"), (e) => e.status === 403);
});
