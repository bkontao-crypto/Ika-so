// Lot B confidentialité : la page vue n'est envoyée qu'avec l'accord « Statistiques ».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveConsent, CONSENT_CATEGORIES } from "../public/js/core/consent.js";
import { trackPageView } from "../public/js/core/analytics.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
  };
}
const NOW = Date.parse("2026-11-18T08:00:00Z");

test("statistiques : sans choix, aucune requête n'est envoyée", () => {
  const sent = [];
  const ok = trackPageView("/", (p) => sent.push(p), { storage: memoryStorage(), now: NOW });
  assert.equal(ok, false);
  assert.deepEqual(sent, []);
});

test("statistiques : refus explicite ou autre catégorie acceptée = aucune requête", () => {
  for (const accepted of [[], ["cartes"], ["preferences", "marketing"]]) {
    const storage = memoryStorage();
    saveConsent(accepted, { storage, now: NOW });
    const sent = [];
    assert.equal(trackPageView("/annonces", (p) => sent.push(p), { storage, now: NOW }), false);
    assert.deepEqual(sent, []);
  }
});

test("statistiques : accord enregistré = une requête avec le chemin seul", () => {
  const storage = memoryStorage();
  saveConsent(["statistiques"], { storage, now: NOW });
  const sent = [];
  assert.equal(trackPageView("/annonces", (p) => sent.push(p), { storage, now: NOW }), true);
  assert.deepEqual(sent, ["/annonces"]);
});

test("statistiques : retrait de l'accord = plus aucune requête ; choix expiré = plus aucune requête", () => {
  const storage = memoryStorage();
  saveConsent(["statistiques"], { storage, now: NOW });
  saveConsent([], { storage, now: NOW });
  assert.equal(trackPageView("/", () => {}, { storage, now: NOW }), false);
  const old = memoryStorage();
  saveConsent(["statistiques"], { storage: old, now: NOW });
  assert.equal(trackPageView("/", () => {}, { storage: old, now: NOW + 200 * 86_400_000 }), false);
});

test("statistiques : une erreur d'envoi ne casse pas la page", async () => {
  const storage = memoryStorage();
  saveConsent(["statistiques"], { storage, now: NOW });
  assert.equal(trackPageView("/", () => Promise.reject(new Error("réseau")), { storage, now: NOW }), true);
  assert.equal(trackPageView("/", () => { throw new Error("immédiat"); }, { storage, now: NOW }), true);
});

test("statistiques : la catégorie est active dans le panneau et app.js passe par le filtre de consentement", () => {
  assert.equal(CONSENT_CATEGORIES.find((c) => c.id === "statistiques").active, true);
  const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.match(app, /trackPageView\(path,/);
  assert.doesNotMatch(app, /^\s*api\("\/e"/m, "plus d'appel direct à /e hors du filtre");
});
