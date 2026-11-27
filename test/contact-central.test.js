// Gestion centralisée des contacts : règles pures (défauts, interrupteurs, catégories, modes, replis).
import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_KEYS, DEFAULT_CONFIG, isCentralActive, normalizeConfig, normalizePhone, resolveContact, validateConfigInput } from "../server/lib/contact-central.js";

const on = (cats, extra = {}) => ({ enabled: true, categories: Object.fromEntries(cats.map((k) => [k, true])), central: { phone: "+22370000000", whatsapp: "" }, ...extra });
const ANNONCE = { contactMode: null, customPhone: "", customWhatsapp: "" };

test("scénario 1 : réglage initial et valeurs de secours entièrement désactivés", () => {
  for (const raw of [undefined, null, {}, [], "x", 42, { enabled: "true" }, { enabled: 1 }, { categories: { AGENCY: "true" } }]) {
    const c = normalizeConfig(raw);
    assert.equal(c.enabled, false);
    assert.deepEqual(Object.values(c.categories), [false, false, false, false]);
  }
  assert.equal(DEFAULT_CONFIG.enabled, false);
  assert.deepEqual(Object.keys(DEFAULT_CONFIG.categories), CATEGORY_KEYS);
});

test("scénario 2 : général désactivé, catégorie cochée en base : aucun routage centralisé", () => {
  const cfg = { enabled: false, categories: { AGENCY: true }, central: { phone: "+22370000000" } };
  assert.equal(isCentralActive(cfg, "AGENCY"), false);
  const r = resolveContact({ config: cfg, category: "AGENCY", listing: ANNONCE, ownerPhone: "+22377000000" });
  assert.deepEqual([r.active, r.routing, r.phone], [false, "OWNER", "+22377000000"]);
});

test("scénarios 3 à 6 : chaque catégorie est indépendante des trois autres", () => {
  for (const k of CATEGORY_KEYS) {
    const cfg = on([k]);
    for (const other of CATEGORY_KEYS) assert.equal(isCentralActive(cfg, other), other === k, `${k} activé, ${other}`);
  }
  assert.equal(isCentralActive(on(["STANDARD"]), "ADVERTISER"), false);
});

test("catégorie inconnue ou absente : fonctionnement normal vers le propriétaire", () => {
  for (const cat of [undefined, null, "", "VIP", "agency"]) {
    const r = resolveContact({ config: on(CATEGORY_KEYS), category: cat, listing: ANNONCE, ownerPhone: "+22377000000" });
    assert.deepEqual([r.active, r.routing, r.phone], [false, "OWNER", "+22377000000"]);
  }
});

test("scénarios 7, 8 et 9 : désactiver puis réactiver restaure les choix précédents sans rien activer", () => {
  const saved = normalizeConfig(on(["AGENCY", "PREMIUM"]));
  const generalOff = { ...saved, enabled: false };
  for (const k of CATEGORY_KEYS) assert.equal(isCentralActive(generalOff, k), false);
  const generalBack = { ...generalOff, enabled: true };
  assert.deepEqual(CATEGORY_KEYS.filter((k) => isCentralActive(generalBack, k)), ["AGENCY", "PREMIUM"]);
  const categoryOff = { ...saved, categories: { ...saved.categories, AGENCY: false } };
  assert.equal(isCentralActive(categoryOff, "AGENCY"), false);
  assert.equal(isCentralActive(categoryOff, "PREMIUM"), true);
});

test("scénario 10 : mode propriétaire (A) : numéro et messagerie du propriétaire", () => {
  const r = resolveContact({ config: on(["AGENCY"]), category: "AGENCY", listing: { ...ANNONCE, contactMode: "OWNER" }, ownerPhone: "+22377000000" });
  assert.deepEqual([r.mode, r.routing, r.phone, r.whatsapp], ["OWNER", "OWNER", "+22377000000", "+22377000000"]);
});

test("scénario 11 : mode centralisé (B) : coordonnées d'IKA SÔ, le numéro du propriétaire n'apparaît pas", () => {
  const r = resolveContact({ config: on(["AGENCY"], { central: { phone: "+22370000000", whatsapp: "+22371111111" } }), category: "AGENCY", listing: ANNONCE, ownerPhone: "+22377000000" });
  assert.deepEqual([r.mode, r.routing, r.phone, r.whatsapp], ["CENTRAL", "CENTRAL", "+22370000000", "+22371111111"]);
  assert.ok(!JSON.stringify(r).includes("77000000"));
  const sansWa = resolveContact({ config: on(["AGENCY"]), category: "AGENCY", listing: ANNONCE, ownerPhone: "+22377000000" });
  assert.equal(sansWa.whatsapp, "+22370000000"); // WhatsApp absent : le téléphone centralisé sert aussi
});

test("mode personnalisé (C) : numéros de l'annonce ; incomplet = repli sûr sans fuite", () => {
  const cfg = on(["PREMIUM"]);
  const ok = resolveContact({ config: cfg, category: "PREMIUM", listing: { contactMode: "CUSTOM", customPhone: "+22372222222", customWhatsapp: "" }, ownerPhone: "+22377000000" });
  assert.deepEqual([ok.mode, ok.phone, ok.whatsapp, ok.routing], ["CUSTOM", "+22372222222", "+22372222222", "CENTRAL"]);
  const cassé = resolveContact({ config: cfg, category: "PREMIUM", listing: { contactMode: "CUSTOM", customPhone: "abc" }, ownerPhone: "+22377000000" });
  assert.deepEqual([cassé.mode, cassé.phone], ["CENTRAL", "+22370000000"]);
  const rien = resolveContact({ config: { ...cfg, central: { phone: "" } }, category: "PREMIUM", listing: { contactMode: "CUSTOM", customPhone: "" }, ownerPhone: "+22377000000" });
  assert.deepEqual([rien.phone, rien.whatsapp], [null, null]); // aucun bouton plutôt qu'un lien cassé ou le numéro du propriétaire
});

test("scénario 16 : coordonnée centralisée manquante : aucun bouton, aucune exposition du propriétaire", () => {
  const r = resolveContact({ config: { enabled: true, categories: { STANDARD: true }, central: {} }, category: "STANDARD", listing: ANNONCE, ownerPhone: "+22377000000" });
  assert.equal(r.phone, null);
  assert.equal(r.whatsapp, null);
  assert.equal(r.routing, "CENTRAL");
});

test("catégorie non couverte : le téléphone du propriétaire est rendu tel quel (aucune régression)", () => {
  for (const stored of ["+223 70 00 00 00", "70000000", "0022370000000"]) {
    assert.equal(resolveContact({ config: on(["AGENCY"]), category: "STANDARD", listing: ANNONCE, ownerPhone: stored }).phone, stored);
  }
  assert.equal(resolveContact({ config: null, category: "STANDARD", ownerPhone: "" }).phone, null);
});

test("normalizePhone : format international strict", () => {
  assert.equal(normalizePhone("+223 70 00 00 00"), "+22370000000");
  assert.equal(normalizePhone("00223 70.00.00.00"), "+22370000000");
  for (const bad of ["", "70000000", "+0223700", "+12", "+223abc", "tel:+22370000000", null, undefined, 22370000000]) assert.equal(normalizePhone(bad), "");
});

test("validateConfigInput : refuse les saisies invalides, exige un téléphone centralisé validé", () => {
  assert.ok(validateConfigInput(null).errors.length);
  assert.ok(validateConfigInput({ enabled: "oui" }).errors.length);
  assert.ok(validateConfigInput({ categories: { VIP: true } }).errors.length);
  assert.ok(validateConfigInput({ categories: { AGENCY: "true" } }).errors.length);
  assert.ok(validateConfigInput({ central: { phone: "123" } }).errors.length);
  assert.ok(validateConfigInput({ recipients: "x" }).errors.length);
  assert.ok(validateConfigInput({ enabled: true, categories: { AGENCY: true }, defaultMode: "CENTRAL" }).errors.some((e) => /téléphone centralisé/.test(e)));
  assert.deepEqual(validateConfigInput({ enabled: true, categories: { AGENCY: true }, defaultMode: "CENTRAL", central: { phone: "+223 70 00 00 00" } }).errors, []);
  assert.deepEqual(validateConfigInput({ enabled: false, categories: { AGENCY: true } }).errors, []); // catégories mémorisées sans effet tant que le général est éteint
  assert.deepEqual(validateConfigInput({}).value.categories, { STANDARD: false, ADVERTISER: false, AGENCY: false, PREMIUM: false });
});
