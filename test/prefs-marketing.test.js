// Côté navigateur : Préférences et Marketing n'agissent qu'avec le service activé ET l'accord de l'utilisateur.
import test from "node:test";
import assert from "node:assert/strict";

function fakeBrowser() {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const scripts = [];
  globalThis.document = { createElement: () => ({}), head: { append: (s) => scripts.push(s.src) } };
  return { mem, scripts };
}

test("préférences : rien n'est mémorisé sans service ni accord, puis tout s'efface au retrait", async () => {
  const { mem } = fakeBrowser();
  const prefs = await import("../public/js/core/prefs.js");
  const consent = await import("../public/js/core/consent.js");
  assert.equal(prefs.setPref("view", "map"), false);
  prefs.setPrefsService(true);
  assert.equal(prefs.setPref("view", "map"), false, "service actif mais pas d'accord");
  consent.saveConsent(["preferences"]);
  assert.equal(prefs.setPref("view", "map"), true);
  assert.equal(prefs.getPref("view"), "map");
  prefs.clearPrefs();
  assert.equal(prefs.getPref("view", "grid"), "grid");
  assert.equal(mem.has(prefs.PREFS_KEY), false);
  prefs.setPrefsService(false);
  assert.equal(prefs.setPref("view", "map"), false, "service éteint");
});

test("marketing : aucun script sans accord, chargement avec accord, jamais deux fois", async () => {
  const { scripts } = fakeBrowser();
  const marketing = await import("../public/js/core/marketing.js");
  const consent = await import("../public/js/core/consent.js");
  consent.saveConsent([]);
  marketing.setMarketingProviders([{ provider: "meta", id: "123456789012345" }]);
  assert.equal(marketing.applyMarketing(), 0);
  assert.equal(scripts.length, 0);
  consent.saveConsent(["marketing"]);
  assert.equal(marketing.applyMarketing(), 1);
  assert.equal(marketing.applyMarketing(), 1);
  assert.equal(scripts.filter((s) => /facebook/.test(s)).length, 1);
});
