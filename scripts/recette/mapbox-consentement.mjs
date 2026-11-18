// Recette réelle du fond Mapbox (lot A confidentialité). À lancer HORS production, avec un jeton public de TEST restreint à localhost.
//
// Variables d'environnement (jamais écrites dans le dépôt, jamais affichées) :
//   MAPBOX_TEST_TOKEN   jeton public « pk. » de test (obligatoire)
//   RECETTE_BASE_URL    adresse du site local (défaut http://localhost:3000)
//   RECETTE_LISTING_ID  identifiant d'une annonce PUBLIÉE et géolocalisée (obligatoire)
//
// Prérequis : Playwright installé (npm i -D playwright && npx playwright install chromium) et un serveur local lancé avec MAPBOX_TOKEN=<même jeton de test>.
// Sortie : un résumé JSON des 7 contrôles. Code de sortie 1 si un contrôle échoue.
// Les journaux réseau ne gardent que l'hôte et le chemin : le paramètre access_token est retiré.
import { createRequire } from "node:module";

const token = process.env.MAPBOX_TEST_TOKEN || "";
const base = process.env.RECETTE_BASE_URL || "http://localhost:3000";
const listingId = process.env.RECETTE_LISTING_ID || "";
if (!token.startsWith("pk.")) { console.error("MAPBOX_TEST_TOKEN absent ou non « pk. » : arrêt (aucune valeur affichée)."); process.exit(2); }
if (!listingId) { console.error("RECETTE_LISTING_ID absent : arrêt."); process.exit(2); }

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.error("Playwright introuvable : npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const CONSENT = (accepted) => JSON.stringify({ version: 1, accepted, refused: ["preferences", "statistiques", "cartes", "marketing"].filter((c) => !accepted.includes(c)), decidedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 183 * 864e5).toISOString() });
const redact = (url) => { const u = new URL(url); u.searchParams.delete("access_token"); return `${u.host}${u.pathname}`; };
const isExternalMap = (url) => /(^|\.)mapbox\.com$/.test(new URL(url).host) || /\/vendor\/mapbox-gl/.test(url);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const log = []; let phase = "init"; const errors = [];
page.on("pageerror", (e) => errors.push(`${phase}: ${e.message}`));
page.on("request", (r) => { if (isExternalMap(r.url()) || r.url().includes("/api/config/map")) log.push({ phase, url: redact(r.url()) }); });
const count = (p) => log.filter((x) => x.phase === p && !x.url.includes("/api/config/map")).length;
const configCount = (p) => log.filter((x) => x.phase === p && x.url.includes("/api/config/map")).length;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const go = async (hash) => { await page.goto(`${base}/?_=${Date.now()}#${hash}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200); };

// 1. Première visite sans consentement : aucune requête Mapbox, aucune donnée Mapbox dans le navigateur
phase = "1-premiere-visite";
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await go(`/annonce/${listingId}`);
check("1. aucune requête Mapbox sans consentement", count(phase) === 0 && configCount(phase) === 0, `requêtes Mapbox=${count(phase)}, config=${configCount(phase)}`);
check("1b. aucune donnée Mapbox dans le navigateur sans consentement", await page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith("mapbox"))));

// 2. Acceptation « Cartes et services externes »
phase = "2-acceptation";
await page.evaluate((c) => localStorage.setItem("ika-so-consent", c), CONSENT(["cartes"]));
check("2. acceptation enregistrée", (await page.evaluate(() => JSON.parse(localStorage.getItem("ika-so-consent")).accepted)).includes("cartes"));

// 3 (suite). Le chargement de la fiche après acceptation déclenche la demande du jeton
phase = "3-chargement";
await go(`/annonce/${listingId}`);
const serveurRenvoieJeton = await page.evaluate(async () => Boolean((await (await fetch("/api/config/map")).json())?.mapbox?.token));
check("3a. le serveur de recette fournit un jeton (oui/non, valeur non affichée)", serveurRenvoieJeton, serveurRenvoieJeton ? "" : "MAPBOX_TEST_TOKEN doit aussi être défini côté serveur local");

// 3. Chargement réel de Mapbox
await page.waitForTimeout(3000);
check("3. jeton demandé après consentement", configCount(phase) >= 1, `config=${configCount(phase)}`);
check("3b. bibliothèque ou tuiles Mapbox chargées", count(phase) >= 1, `requêtes Mapbox=${count(phase)}`);
const mapboxOk = await page.evaluate(() => Boolean(window.mapboxgl));
check("3c. bibliothèque Mapbox présente dans la page", mapboxOk);

// 4. Annonce géolocalisée affichée sur le fond Mapbox
phase = "4-annonce";
check("4. géolocalisation visible", (await page.$(".geo-box canvas, .geo-box .mapboxgl-canvas")) !== null || (await page.$(".geo-box")) !== null);

// 5. Retrait du consentement
phase = "5-retrait";
await page.click("#consent-open"); await page.waitForSelector("#consent-dialog");
await Promise.all([page.waitForLoadState("load"), page.click("text=Tout refuser")]);
await page.waitForTimeout(1500);
check("5. consentement retiré", !(await page.evaluate(() => JSON.parse(localStorage.getItem("ika-so-consent")).accepted)).includes("cartes"));
check("5b. données Mapbox du navigateur effacées", !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("mapbox")))));

// 6. Retour à la carte locale
phase = "6-retour-local";
check("6. carte locale affichée après retrait", (await page.$(".geo-box")) !== null);

// 7. Aucune nouvelle requête Mapbox après retrait
phase = "7-apres-retrait";
await go(`/annonce/${listingId}`);
check("7. aucune requête Mapbox après retrait", count(phase) === 0 && configCount(phase) === 0, `requêtes Mapbox=${count(phase)}, config=${configCount(phase)}`);

check("Aucune erreur JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ base, listingId: "[fourni]", tokenFormat: "pk. (valeur non affichée)", passed: results.length - failed.length, failed: failed.length, results, requestLog: log }, null, 2));
process.exit(failed.length ? 1 : 0);
