// Lot A confidentialité : consentement « Cartes et services externes », passerelle Mapbox, brouillon par compte, fiche Mapbox sur demande.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConsent, hasConsent, saveConsent, CONSENT_KEY, CONSENT_VERSION, CONSENT_CATEGORIES } from "../public/js/core/consent.js";
import { draftKey, moveLegacyDraft, LEGACY_DRAFT_KEY } from "../public/js/core/draft.js";
import { createListingsMap, createMap } from "../public/js/map/provider.js";
import { ficheHtml } from "../server/lib/fiche.js";

/** Faux stockage (même interface que localStorage). */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    has: (k) => data.has(k),
  };
}

const NOW = Date.parse("2026-11-17T08:00:00Z");

// ---------- Consentement ----------

test("consentement : aucun choix par défaut, toute catégorie optionnelle est refusée", () => {
  const storage = memoryStorage();
  assert.equal(readConsent({ storage, now: NOW }), null);
  for (const c of CONSENT_CATEGORIES) assert.equal(hasConsent(c.id, { storage, now: NOW }), false, c.id);
});

test("consentement : les quatre catégories optionnelles existent et sont désactivées par défaut", () => {
  const ids = CONSENT_CATEGORIES.map((c) => c.id);
  assert.deepEqual(ids, ["preferences", "statistiques", "cartes", "marketing"]);
  assert.equal(CONSENT_CATEGORIES.find((c) => c.id === "cartes").label, "Cartes et services externes");
});

test("consentement : acceptation puis lecture ; refus des autres catégories", () => {
  const storage = memoryStorage();
  saveConsent(["cartes"], { storage, now: NOW });
  const r = readConsent({ storage, now: NOW + 1000 });
  assert.deepEqual(r.accepted, ["cartes"]);
  assert.deepEqual(r.refused, ["preferences", "statistiques", "marketing"]);
  assert.equal(r.version, CONSENT_VERSION);
  assert.equal(hasConsent("cartes", { storage, now: NOW }), true);
  assert.equal(hasConsent("marketing", { storage, now: NOW }), false);
});

test("consentement : retrait immédiat (nouveau choix sans la catégorie)", () => {
  const storage = memoryStorage();
  saveConsent(["cartes"], { storage, now: NOW });
  saveConsent([], { storage, now: NOW });
  assert.equal(hasConsent("cartes", { storage, now: NOW }), false);
});

test("consentement : choix expiré = pas de choix (6 mois par défaut)", () => {
  const storage = memoryStorage();
  saveConsent(["cartes"], { storage, now: NOW });
  const sixMonthsPlus = NOW + 184 * 86_400_000;
  assert.equal(hasConsent("cartes", { storage, now: sixMonthsPlus }), false);
  const record = JSON.parse(storage.getItem(CONSENT_KEY));
  const days = (Date.parse(record.expiresAt) - NOW) / 86_400_000;
  assert.equal(Math.round(days), 183);
});

test("consentement : version de politique différente = choix ignoré", () => {
  const storage = memoryStorage({ [CONSENT_KEY]: JSON.stringify({ version: CONSENT_VERSION + 1, accepted: ["cartes"], expiresAt: new Date(NOW + 1e9).toISOString() }) });
  assert.equal(hasConsent("cartes", { storage, now: NOW }), false);
});

test("consentement : valeurs inconnues ou invalides ignorées sans erreur", () => {
  const storage = memoryStorage({ [CONSENT_KEY]: JSON.stringify({ version: CONSENT_VERSION, accepted: ["cartes", "inconnue", 42], expiresAt: new Date(NOW + 1e9).toISOString() }) });
  assert.deepEqual(readConsent({ storage, now: NOW }).accepted, ["cartes"]);
  const broken = memoryStorage({ [CONSENT_KEY]: "{pas du json" });
  assert.equal(readConsent({ storage: broken, now: NOW }), null);
});

test("consentement : stockage bloqué ou plein ne plante pas et ne donne aucun accord", () => {
  const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); } };
  assert.equal(readConsent({ storage: blocked, now: NOW }), null);
  assert.doesNotThrow(() => saveConsent(["cartes"], { storage: blocked, now: NOW }));
  assert.equal(hasConsent("cartes", { storage: blocked, now: NOW }), false);
});

// ---------- Brouillon par compte ----------

test("brouillon : clé propre à chaque compte", () => {
  assert.notEqual(draftKey("u1"), draftKey("u2"));
  assert.equal(draftKey("u1"), "ika-so-draft:u1");
  assert.notEqual(draftKey("u1"), LEGACY_DRAFT_KEY);
});

test("brouillon : un compte ne lit jamais le brouillon d'un autre", () => {
  const storage = memoryStorage({ [draftKey("alice")]: JSON.stringify({ title: "Villa d'Alice" }) });
  assert.equal(storage.getItem(draftKey("bob")), null);
});

test("brouillon : à la déconnexion, l'ancien brouillon sans compte est rangé chez le compte qui se déconnecte", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: JSON.stringify({ title: "Terrain" }) });
  moveLegacyDraft("alice", storage);
  assert.equal(storage.has(LEGACY_DRAFT_KEY), false);
  assert.equal(storage.getItem(draftKey("alice")), JSON.stringify({ title: "Terrain" }));
});

test("brouillon : le brouillon déjà présent d'un compte n'est jamais écrasé par l'ancien format", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"ancien\"}", [draftKey("alice")]: "{\"title\":\"récent\"}" });
  moveLegacyDraft("alice", storage);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"récent\"}");
  assert.equal(storage.has(LEGACY_DRAFT_KEY), false);
});

test("brouillon : sans compte (ouverture de la publication), l'ancien format est retiré et n'est attribué à personne", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"inconnu\"}" });
  moveLegacyDraft(null, storage);
  assert.equal(storage.has(LEGACY_DRAFT_KEY), false);
  assert.equal(storage.has(draftKey("bob")), false);
});

test("brouillon : sans ancien format, rien ne change (brouillons légitimes préservés)", () => {
  const storage = memoryStorage({ [draftKey("alice")]: "{\"title\":\"garde\"}" });
  moveLegacyDraft("alice", storage);
  moveLegacyDraft(null, storage);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"garde\"}");
});

// ---------- Passerelle Mapbox ----------

function withStubs(fn) {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(JSON.stringify({ mapbox: { token: "pk.test" } }), { headers: { "Content-Type": "application/json" } }); };
  return fn(calls).finally(() => {
    globalThis.fetch = realFetch;
    if (realStorage) Object.defineProperty(globalThis, "localStorage", realStorage); else delete globalThis.localStorage;
  });
}

const useStorage = (storage) => Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });

test("carte : sans acceptation, aucune requête vers /api/config/map et pas de Mapbox (liste de repères)", () => withStubs(async (calls) => {
  useStorage(memoryStorage());
  const result = await createListingsMap({}, [], () => {});
  assert.equal(result, null);
  assert.equal(calls.length, 0);
}));

test("carte : sans acceptation, la carte d'une fiche reste locale sans requête externe", () => withStubs(async (calls) => {
  useStorage(memoryStorage());
  const container = { replaceChildren() {}, append() {}, style: {} };
  await createMap(container, { center: { lat: 12.6, lng: -8.0 }, mode: "view" }).catch(() => undefined);
  assert.equal(calls.some((u) => u.includes("/api/config/map")), false);
}));

test("carte : après acceptation, la configuration Mapbox est demandée", () => withStubs(async (calls) => {
  useStorage(memoryStorage());
  saveConsent(["cartes"], { storage: globalThis.localStorage, now: Date.now() });
  await createListingsMap({}, [], () => {}).catch(() => undefined); // la bibliothèque n'existe pas hors navigateur : l'erreur est attendue
  assert.equal(calls.filter((u) => u.includes("/api/config/map")).length, 1);
}));

// ---------- Fiche imprimable ----------

const GEO = {
  category: "Terrain", point: { lat: 12.6, lng: -8.0 }, isPublic: false,
  areaM2: 500, perimeterM: 90, computedAt: "2026-11-01T10:00:00Z",
  polygon: { coordinates: [[[-8.0, 12.6], [-7.999, 12.6], [-7.999, 12.601], [-8.0, 12.601], [-8.0, 12.6]]] },
};
const LISTING = { title: "Terrain test", neighborhood: "Quartier", city: "Bamako", surface_label: "500 m²" };

test("fiche : sans fond Mapbox demandé, aucune URL Mapbox ni jeton dans la page ; plan local présent", () => {
  const html = ficheHtml({ geo: GEO, listing: LISTING, mapboxToken: "" });
  assert.equal(html.includes("api.mapbox.com"), false);
  assert.equal(html.includes("<img class=\"fond-carte\""), false);
  assert.equal(html.includes("class=\"plan\""), true);
});

test("fiche : avec fond Mapbox demandé, l'image Mapbox est incluse", () => {
  const html = ficheHtml({ geo: GEO, listing: LISTING, mapboxToken: "pk.test" });
  assert.equal(html.includes("api.mapbox.com"), true);
});

test("fiche : la route n'envoie le jeton Mapbox qu'avec ?fond=mapbox", () => {
  const source = readFileSync(new URL("../server/routes/index.js", import.meta.url), "utf8");
  assert.match(source, /req\.query\?\.fond === "mapbox" \? config\.mapbox\?\.token/);
});

test("consentement : le panneau et le pied de page exposent « Gérer mes choix »", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="consent-open"[^>]*>Gérer mes choix</);
  const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.match(app, /consent-open.*openConsentPanel/s);
});
