// Lot A confidentialité : consentement « Cartes et services externes », passerelle Mapbox, brouillon par compte, fiche Mapbox sur demande.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConsent, hasConsent, saveConsent, CONSENT_KEY, CONSENT_VERSION, CONSENT_CATEGORIES } from "../public/js/core/consent.js";
import { draftKey, LEGACY_DRAFT_KEY, legacyDraftInfo, claimLegacyDraft, discardLegacyDraft } from "../public/js/core/draft.js";
import { createListingsMap, createMap } from "../public/js/map/provider.js";
import { ficheHtml } from "../server/lib/fiche.js";
import { clearMapboxStorage } from "../public/js/core/consent.js";

/** Faux stockage (même interface que localStorage). */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    has: (k) => data.has(k),
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
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

// ---------- Brouillon par compte et ancien brouillon anonyme ----------

test("brouillon : clé propre à chaque compte, jamais celle d'un autre", () => {
  assert.equal(draftKey("u1"), "ika-so-draft:u1");
  assert.notEqual(draftKey("u1"), draftKey("u2"));
  assert.notEqual(draftKey("u1"), LEGACY_DRAFT_KEY);
});

test("ancien brouillon : la simple lecture n'efface ni ne modifie rien", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"Terrain\",\"savedAt\":\"2026-11-01T10:00:00.000Z\"}" });
  const before = storage.getItem(LEGACY_DRAFT_KEY);
  assert.deepEqual(legacyDraftInfo(storage), { savedAt: "2026-11-01T10:00:00.000Z" });
  assert.equal(storage.getItem(LEGACY_DRAFT_KEY), before);
  assert.equal(storage.has(draftKey("alice")), false);
});

test("ancien brouillon : aucune suppression ni attribution sans clic (déconnexion, anonyme)", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"ancien\"}" });
  // Pas d'appel = pas d'effet : il n'existe plus de traitement automatique.
  assert.equal(storage.getItem(LEGACY_DRAFT_KEY), "{\"title\":\"ancien\"}");
  assert.equal(storage.has(draftKey("alice")), false);
  assert.equal(storage.has(draftKey("bob")), false);
});

test("ancien brouillon : récupération explicite, copie vérifiée puis retrait de l'ancienne clé", () => {
  const raw = "{\"title\":\"Terrain\"}";
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: raw });
  assert.equal(claimLegacyDraft("alice", storage), true);
  assert.equal(storage.getItem(draftKey("alice")), raw);
  assert.equal(storage.has(LEGACY_DRAFT_KEY), false);
  assert.equal(storage.has(draftKey("bob")), false);
});

test("ancien brouillon : une récupération n'écrase jamais le brouillon déjà présent du compte", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"ancien\"}", [draftKey("alice")]: "{\"title\":\"récent\"}" });
  assert.equal(claimLegacyDraft("alice", storage), false);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"récent\"}");
  assert.equal(storage.getItem(LEGACY_DRAFT_KEY), "{\"title\":\"ancien\"}");
});

test("ancien brouillon : suppression explicite uniquement, sans toucher aux brouillons de compte", () => {
  const storage = memoryStorage({ [LEGACY_DRAFT_KEY]: "{\"title\":\"ancien\"}", [draftKey("alice")]: "{\"title\":\"garde\"}" });
  discardLegacyDraft(storage);
  assert.equal(storage.has(LEGACY_DRAFT_KEY), false);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"garde\"}");
});

test("brouillon de compte : les brouillons de A et de B restent séparés", () => {
  const storage = memoryStorage({ [draftKey("alice")]: "{\"title\":\"Villa d'Alice\"}" });
  assert.equal(storage.getItem(draftKey("bob")), null);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"Villa d'Alice\"}");
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

test("fiche : la route ne lit jamais le paramètre fond et n'envoie aucun jeton (ni avec ?fond=mapbox)", () => {
  const source = readFileSync(new URL("../server/routes/index.js", import.meta.url), "utf8");
  const start = source.indexOf('router.get("/me/listings/:id/fiche"');
  const block = source.slice(start, source.indexOf("});", start) + 3);
  const code = block.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.ok(start > 0);
  assert.equal(/fond|mapbox/i.test(code), false, code);
});

test("fiche : sans consentement côté serveur, la page contient un emplacement vide, sans URL ni jeton Mapbox", () => {
  const html = ficheHtml({ geo: GEO, listing: LISTING });
  assert.equal(html.includes("api.mapbox.com"), false);
  assert.equal(html.includes("access_token"), false);
  assert.match(html, /<div class="fond-auto" id="fond-auto" hidden data-geo="/);
  assert.match(html, /<script type="module" src="\/js\/fiche\.js">/);
});

test("fiche : le chargement du fond côté page est conditionné au consentement enregistré dans le navigateur", () => {
  const js = readFileSync(new URL("../public/js/fiche.js", import.meta.url), "utf8");
  assert.match(js, /if \(slot && hasConsent\("cartes"\)\) loadFond\(slot\);/);
  assert.equal(js.indexOf('fetch("/api/config/map"') > js.indexOf("hasConsent"), true);
});

test("consentement : le panneau et le pied de page exposent « Gérer mes choix »", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="consent-open"[^>]*>Gérer mes choix</);
  const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.match(app, /consent-open.*openConsentPanel/s);
});

// ---------- Audit (version jointe) : données Mapbox retirées avec le consentement ----------

test("audit : le retrait du consentement efface l'identifiant et la télémétrie posés par Mapbox, sans toucher au reste", () => {
  const storage = memoryStorage({ "mapbox.eventData:pk.x": "{\"id\":\"abc\"}", "mapbox.eventData": "{}", [draftKey("alice")]: "{\"title\":\"garde\"}", "ika-theme": "dark" });
  assert.equal(clearMapboxStorage(storage), 2);
  assert.equal(storage.has("mapbox.eventData:pk.x"), false);
  assert.equal(storage.has("mapbox.eventData"), false);
  assert.equal(storage.getItem(draftKey("alice")), "{\"title\":\"garde\"}");
  assert.equal(storage.getItem("ika-theme"), "dark");
});

test("audit : stockage absent ou bloqué : rien ne plante", () => {
  assert.equal(clearMapboxStorage(null), 0);
  assert.equal(clearMapboxStorage({ get length() { throw new Error("SecurityError"); } }), 0);
});

// ---------- Audit : plan de secours pour une annonce à simple point ----------

test("fiche : une annonce à simple point GPS reçoit un plan de secours local (sans contour, sans Mapbox)", () => {
  const pointOnly = { ...GEO, polygon: null, areaM2: null, perimeterM: null };
  const html = ficheHtml({ geo: pointOnly, listing: LISTING });
  assert.match(html, /<svg class="plan plan-point"/);
  assert.equal(html.includes("api.mapbox.com"), false);
  assert.equal(html.includes("Position indicative"), true);
});

test("fiche : une annonce avec contour garde son plan métrique", () => {
  const html = ficheHtml({ geo: GEO, listing: LISTING });
  assert.equal(html.includes('<svg class="plan" '), true);
  assert.equal(html.includes("plan-point"), false);
});

test("localisation : le lien d'impression apparaît aussi pour un simple point", () => {
  const source = readFileSync(new URL("../public/js/pages/localisation.js", import.meta.url), "utf8");
  assert.match(source, /\(geo\?\.polygon \|\| geo\?\.point\) \? h\("p", null, h\("a", \{ class: "btn btn-small", href: `\/api\/me\/listings/);
});
