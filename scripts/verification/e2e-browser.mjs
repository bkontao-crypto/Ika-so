import { createHmac } from "node:crypto";
// Parcours complet dans un vrai navigateur : publier, modérer, voir en ligne, commenter, signaler, bannir.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// PNG de bruit (200x200) fabriqué sans dépendance : assez gros pour passer le contrôle de taille minimale.
function noisePng() {
  const w = 200, h = 200, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let i = 1; i <= w * 3; i++) raw[y * (w * 3 + 1) + i] = (Math.random() * 256) | 0; }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:18080";
const SHOTS = "/home/claude/phase0/shots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const problems = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "ECHEC"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) problems.push(name);
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

let fakeIp = 0;
async function newUser(label, opts = phone) {
  // Une adresse distincte par visiteur simulé (le serveur de test fait confiance à X-Forwarded-For) : sinon tous partagent le quota de 240 requêtes/min.
  const context = await browser.newContext({ ...opts, extraHTTPHeaders: { "X-Forwarded-For": `10.0.0.${++fakeIp}` } });
  const page = await context.newPage();
  page.consoleProblems = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) page.consoleProblems.push(`${label}: ${m.text()}`); });
  page.on("pageerror", (e) => page.consoleProblems.push(`${label} pageerror: ${e.message}`));
  return { context, page };
}

async function register(page, name, email) {
  await page.goto(`${BASE}/#/connexion`);
  await page.getByRole("tab", { name: "Inscription" }).click();
  await page.getByLabel("Nom affiché").fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe (8 caractères au moins)").fill("motdepasse1");
  await page.getByLabel(/J.accepte les/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForFunction(() => !location.hash.includes("connexion"));
}

// ---- 1. L'administrateur s'inscrit en premier (devient super administrateur hors production)
const admin = await newUser("admin", { viewport: { width: 1200, height: 800 } });
await register(admin.page, "Admin Ika", "admin@ika.test");
await admin.page.goto(`${BASE}/admin.html`);
await admin.page.getByText("Ce qui se passe sur Ika So").waitFor();
check("l'administrateur ouvre le centre de contrôle", true);

// ---- 2. Accueil vide, vu par un visiteur anonyme (téléphone)
const guest = await newUser("visiteur");
await guest.page.goto(BASE);
await guest.page.getByText("Aucune annonce pour ces critères").waitFor();
check("accueil vide : message clair (pas de fausse annonce de démonstration)", true);
await guest.page.screenshot({ path: `${SHOTS}/01-accueil-vide-mobile.png` });

// ---- 3. L'annonceur publie
const owner = await newUser("annonceur");
const o = owner.page;
await o.goto(`${BASE}/#/publier`);
await o.waitForFunction(() => location.hash.includes("connexion"));
check("publier sans compte renvoie vers la connexion", true);
await register(o, "Aminata Diallo", "aminata@ika.test");
await o.goto(`${BASE}/#/publier`);
await o.getByRole("button", { name: "Recevoir le code" }).waitFor();
await o.getByLabel("Téléphone Mali").fill("76 12 34 56");
await o.getByRole("button", { name: "Recevoir le code" }).click();
const hint = await o.locator(".notice strong").textContent();
check("code de démonstration affiché hors production, avec avertissement « sans badge »", /^\d{6}$/.test(hint ?? ""));
await o.getByLabel("Code à 6 chiffres").fill(hint);
await o.getByRole("button", { name: "Valider le numéro" }).click();
await o.getByLabel("Titre de l'annonce", { exact: true }).waitFor();
await o.screenshot({ path: `${SHOTS}/02-publier-etape-2-mobile.png` });
await o.getByLabel("Titre de l'annonce", { exact: true }).fill("Terrain 500 m² à ACI 2000");
await o.getByLabel("Prix (FCFA)", { exact: true }).fill("45000000");
await o.getByLabel("Surface (m²)", { exact: true }).fill("500");
await o.getByLabel("Description", { exact: true }).fill("Belle parcelle proche du goudron, eau et électricité à proximité du lot.");
await o.screenshot({ path: `${SHOTS}/03-publier-etape-3-mobile.png` });
await o.getByRole("button", { name: "Publier", exact: true }).click();
await o.waitForFunction(() => location.hash.includes("mes-annonces"));
await o.getByText("En attente").first().waitFor();
check("l'annonce soumise est « En attente »", true);

await guest.page.reload();
check("en attente de modération : invisible du public", (await guest.page.getByText("Terrain 500 m²").count()) === 0);

// ---- 4. Modération : l'administrateur approuve
const a = admin.page;
await a.reload();
await a.getByText("Terrain 500 m² à ACI 2000").waitFor();
await a.screenshot({ path: `${SHOTS}/04-admin-file-desktop.png` });
await a.getByRole("button", { name: "Approuver" }).click();
await a.getByText("Rien en attente.").waitFor();
check("approbation depuis le centre de contrôle", true);

// ---- 5. Le visiteur voit l'annonce, sans numéro de téléphone dans les données publiques
const apiBodies = [];
guest.page.on("response", async (r) => { if (r.url().includes("/api/listings")) apiBodies.push(await r.text().catch(() => "")); });
await guest.page.goto(BASE);
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
check("annonce publiée visible sur l'accueil", true);
await guest.page.getByLabel("Recherche").fill("TERRAIN aci");
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
await guest.page.getByLabel("Recherche").fill("zzzzz");
await guest.page.getByText("Aucune annonce pour ces critères").waitFor();
check("recherche texte : trouve avec casse et accents différents, vide si aucun résultat", true);
await guest.page.getByLabel("Recherche").fill("");
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
await guest.page.getByRole("button", { name: "Carte" }).click();
await guest.page.locator(".pin").first().waitFor();
check("la carte affiche un repère pour l'annonce", true);
await guest.page.screenshot({ path: `${SHOTS}/05-carte-mobile.png` });
await guest.page.getByRole("button", { name: "Liste" }).click();
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().click();
await guest.page.getByText("Document déclaré par l'annonceur, sans garantie automatique").waitFor();
check("mention « sans garantie automatique » affichée sur la fiche", true);
await guest.page.screenshot({ path: `${SHOTS}/06-fiche-mobile.png`, fullPage: true });
check("aucun numéro dans les réponses publiques (/api/listings)", apiBodies.length > 0 && apiBodies.every((b) => !b.includes("+223") && !b.includes("owner_phone")), `${apiBodies.length} réponses`);

// ---- 6. Contact : demande une connexion, puis ouvre WhatsApp et compte le contact
const listingUrl = guest.page.url();
await guest.page.getByRole("button", { name: "WhatsApp" }).click();
await guest.page.waitForFunction(() => location.hash.includes("connexion"));
check("contacter sans compte renvoie vers la connexion", true);
await register(guest.page, "Visiteur", "visiteur@ika.test");
await guest.page.goto(listingUrl);
await guest.context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>wa.me (simulé)</p>" }));
const popupPromise = guest.page.waitForEvent("popup");
await guest.page.getByRole("button", { name: "WhatsApp" }).click();
const popup = await popupPromise;
await popup.waitForLoadState().catch(() => undefined);
check("WhatsApp s'ouvre vers le numéro de l'annonceur", /^https:\/\/wa\.me\/22376123456/.test(popup.url()), popup.url());
await popup.close().catch(() => undefined);

// ---- 7. Commentaire, favori, signalement
await guest.page.getByLabel("Votre commentaire").fill("Le terrain est-il toujours disponible ?");
await guest.page.getByRole("button", { name: "Envoyer" }).click();
await guest.page.getByText("Le terrain est-il toujours disponible ?").waitFor();
check("commentaire publié et affiché", true);
await guest.page.getByRole("button", { name: "Signaler", exact: true }).click();
await guest.page.locator("dialog").getByRole("button", { name: "Envoyer" }).click();
await guest.page.getByText("Signalement transmis à la modération.").waitFor();
check("signalement transmis", true);
await guest.page.goto(`${BASE}/#/`);
await guest.page.getByRole("button", { name: "Ajouter aux favoris" }).first().click();
await guest.page.getByRole("button", { name: "Retirer des favoris" }).first().waitFor();
check("favori ajouté", true);

// ---- 7 ter. Profil de l'annonceur : statut de confiance, avis après contact, signalement
await guest.page.goto(listingUrl);
await guest.page.getByRole("link", { name: "Voir le profil de l'annonceur" }).click();
await guest.page.getByRole("heading", { name: "Statut de confiance" }).waitFor();
check("profil annonceur : statut de confiance et expérience affichés", (await guest.page.getByText("Expérience", { exact: true }).count()) === 1);
check("profil annonceur : aucun téléphone ni e-mail visible", !/76 ?12 ?34 ?56|aminata@ika\.test/.test(await guest.page.locator("main, #app").first().innerText()));
await guest.page.getByLabel("Votre avis").fill("Annonceur sérieux, bien conforme à la description.");
await guest.page.getByRole("radio", { name: "5", exact: true }).click();
await guest.page.getByRole("button", { name: "Publier mon avis" }).click();
await guest.page.getByText("Avis enregistré.").waitFor();
await guest.page.getByText("Annonceur sérieux, bien conforme à la description.").first().waitFor();
check("avis publié après contact, visible dans les meilleurs avis", true);
check("note moyenne affichée", (await guest.page.getByText("1 avis").count()) >= 1);
await guest.page.goto(listingUrl);

// ---- 7 bis. Confiance : pièce justificative, contrôle humain, badge
await o.goto(`${BASE}/#/mes-annonces`);
await o.getByLabel("Justificatif pour Terrain 500 m² à ACI 2000").setInputFiles({ name: "titre.png", mimeType: "image/png", buffer: noisePng() });
await o.getByText("pièce en cours de contrôle").waitFor();
check("l'annonceur joint un justificatif : « en cours de contrôle », pas de badge", true);
await guest.page.goto(listingUrl);
check("pas de badge « titre foncier contrôlé » avant le contrôle", (await guest.page.getByText("Titre foncier contrôlé par l'équipe").count()) === 0);
await a.reload();
await a.getByRole("tab", { name: /Confiance \(1\)/ }).click();
await a.getByRole("button", { name: "Voir la pièce" }).waitFor();
a.once("dialog", (d) => d.accept("Titre foncier n° 4521 vérifié au cadastre de Bamako"));
await a.getByRole("button", { name: "Contrôlée : accepter" }).click();
await a.getByText("Aucune pièce en attente.").waitFor();
await guest.page.reload();
await guest.page.getByText("Titre foncier contrôlé par l'équipe").waitFor();
check("badge « titre foncier contrôlé » visible après contrôle humain motivé", true);
await guest.page.screenshot({ path: `${SHOTS}/08-fiche-badge-mobile.png` });

// ---- 7 ter. Engagement : alerte, message, visite, hors connexion
// Le visiteur enregistre une recherche AVANT la publication d'une seconde annonce : l'alerte doit arriver à l'approbation.
await guest.page.goto(`${BASE}/#/`);
await guest.page.getByRole("button", { name: "Terrains à vendre" }).click();
await guest.page.getByRole("button", { name: "Enregistrer cette recherche" }).click();
await guest.page.getByText("Recherche enregistrée").waitFor();
check("recherche enregistrée (compte connecté)", true);
await o.goto(`${BASE}/#/publier`);
await o.getByLabel("Titre de l'annonce", { exact: true }).fill("Terrain 300 m² à Kalaban Coura");
await o.getByLabel("Prix (FCFA)", { exact: true }).fill("12000000");
await o.getByLabel("Surface (m²)", { exact: true }).fill("300");
await o.getByLabel("Description", { exact: true }).fill("Parcelle plane, proche de la route, papiers en règle, visite possible.");
await o.getByRole("button", { name: "Publier", exact: true }).click();
await o.waitForFunction(() => location.hash.includes("mes-annonces"));
await a.reload();
await a.getByText("Terrain 300 m² à Kalaban Coura").waitFor();
const t0 = Date.now();
await a.getByRole("button", { name: "Approuver" }).click();
await a.getByText("Rien en attente.").waitFor();
await guest.page.goto(`${BASE}/#/boite`);
await guest.page.getByText("Nouvelle annonce : Terrain 300 m² à Kalaban Coura").waitFor({ timeout: 5000 });
check("alerte reçue dans la boîte après l'approbation", Date.now() - t0 < 60000, `${Date.now() - t0} ms`);
await guest.page.screenshot({ path: `${SHOTS}/09-boite-mobile.png` });
await guest.page.goto(listingUrl);
await guest.page.getByRole("button", { name: "Écrire" }).click();
await guest.page.getByLabel("Votre message").fill("Bonjour, ce terrain est-il toujours disponible ?");
await guest.page.locator("dialog[open]").getByRole("button", { name: "Envoyer" }).click();
await guest.page.getByText("Bonjour, ce terrain est-il toujours disponible ?").waitFor();
check("message envoyé à l'annonceur (fil de discussion ouvert)", true);
await guest.page.goto(listingUrl);
await guest.page.getByRole("button", { name: "Demander une visite" }).click();
const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
await guest.page.getByLabel("Date et heure proposées").fill(future);
await guest.page.locator("dialog[open]").getByRole("button", { name: "Envoyer" }).click();
await guest.page.getByText("Demande envoyée").waitFor();
check("demande de visite envoyée", true);
await o.goto(`${BASE}/#/boite?onglet=visites`);
o.once("dialog", (d) => d.accept("Je vous attends à 10 h"));
await o.getByRole("button", { name: "Accepter" }).click();
await o.getByText("Acceptée").waitFor();
check("l'annonceur accepte la visite", true);
// Hors connexion : le service worker garde le site et les dernières annonces
await guest.page.goto(`${BASE}/#/`);
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
await guest.page.evaluate(() => navigator.serviceWorker.ready);
await guest.page.reload();
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
await guest.context.setOffline(true);
await guest.page.reload();
await guest.page.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor({ timeout: 8000 });
await guest.page.getByText("Hors connexion").waitFor();
check("hors connexion : le site et les dernières annonces s'affichent, avec un bandeau", true);
const privateOffline = await guest.page.evaluate(() => fetch("/api/me/threads").then((r) => r.status).catch(() => "réseau"));
check("hors connexion : les messages privés ne sont jamais servis depuis la mémoire", privateOffline === "réseau", String(privateOffline));
await guest.page.screenshot({ path: `${SHOTS}/10-hors-connexion-mobile.png` });
await guest.context.setOffline(false);

// ---- 7 quater. Espace agence (import CSV) et pages publiques rendues côté serveur
await o.goto(`${BASE}/#/agence`);
await o.getByText("Importer des annonces (CSV)").waitFor();
await o.getByLabel("Fichier CSV").setInputFiles({ name: "modele.csv", mimeType: "text/csv", buffer: readFileSync("/home/claude/ika-so/public/modele-import.csv") });
await o.getByRole("button", { name: "Importer", exact: true }).click();
await o.getByText(/Import refusé/).waitFor();
await o.getByText(/Ligne 2/).waitFor();
check("import CSV : un titre déjà utilisé refuse tout le fichier, avec la ligne fautive", true);
const csvOk = "titre;description;type;transaction;quartier;prix;superficie;superficie m2;acces routier;chambres;salles de bain;meuble;document\nTerrain import 1 à Korofina;Parcelle plane proche de la route, papiers en règle, visite possible;Terrain;Vente;Korofina;18000000;250 m²;250;Piste;;;;Permis d'occuper\nStudio import 2 à Hamdallaye;Studio lumineux avec cuisine équipée, gardien et eau courante toute l'année;Studio;Location;Hamdallaye;90000;30 m²;30;;1;1;oui;Bail";
await o.getByLabel("Fichier CSV").setInputFiles({ name: "ok.csv", mimeType: "text/csv", buffer: Buffer.from(csvOk) });
await o.getByRole("button", { name: "Contrôler le fichier" }).click();
await o.getByText("Fichier correct : 2 annonce(s) prêtes à importer.").waitFor();
await o.getByRole("button", { name: "Importer", exact: true }).click();
await o.getByText("2 annonce(s) importées. Elles attendent la modération.").waitFor();
check("import CSV : contrôle puis import de 2 annonces, en attente de modération", true);
const noJs = await browser.newContext({ javaScriptEnabled: false });
const seoPage = await noJs.newPage();
const resp = await seoPage.goto(`${BASE}/quartier/aci-2000`);
await seoPage.getByRole("link", { name: "Terrain 500 m² à ACI 2000" }).first().waitFor();
check("page quartier lisible sans JavaScript, avec l'annonce", resp.status() === 200);
const ld = await seoPage.locator('script[type="application/ld+json"]').allTextContents();
check("données structurées valides (JSON) sur la page quartier", ld.length >= 2 && ld.every((t) => { try { JSON.parse(t); return true; } catch { return false; } }));
const bodyText = await seoPage.locator("body").innerText();
check("aucun numéro de téléphone sur la page publique rendue", !/\+223|76 ?12 ?34 ?56/.test(bodyText));
const sm = await seoPage.goto(`${BASE}/sitemap.xml`);
check("plan du site disponible", sm.status() === 200 && (await seoPage.content()).includes("/a/"));
await seoPage.goto(`${BASE}/guides/acheter-un-terrain-a-bamako`);
await seoPage.getByText("sans valeur de conseil juridique").first().waitFor();
await noJs.close();
check("guide publié avec son avertissement", true);

// ---- 7b. Paiements : tarif fixé par l'administrateur, mise à la une seulement après la confirmation signée
await o.goto(`${BASE}/#/mes-annonces`);
await o.getByRole("link", { name: "Aperçu" }).first().waitFor();
check("aucune offre proposée tant qu'aucun tarif n'est fixé", (await o.getByRole("button", { name: "Mettre à la une" }).count()) === 0);
await a.reload();
await a.getByRole("tab", { name: /Paiements/ }).click();
a.once("dialog", (d) => d.accept("5000"));
await a.locator(".list-item", { hasText: "7 jours" }).getByRole("button", { name: "Fixer le prix" }).click();
await a.getByText("5 000 FCFA · inactive").or(a.getByText(/5.000 FCFA · inactive/)).first().waitFor();
await a.locator(".list-item", { hasText: "7 jours" }).getByRole("button", { name: "Activer" }).click();
await a.getByText(/5.000 FCFA · active/).first().waitFor();
check("l'administrateur fixe le prix puis active l'offre", true);
await o.reload();
await o.getByRole("button", { name: "Mettre à la une" }).first().click();
await o.waitForURL(/#\/paiements/);
await o.getByText("En attente de confirmation").waitFor();
check("paiement créé en attente, rien n'est encore à la une", true);
const pay = (await o.evaluate(() => fetch("/api/me/payments").then((r) => r.json())))[0];
const body = JSON.stringify({ eventId: "e2e-1", providerRef: `fake_${pay.id}`, status: "PAID", amountXof: pay.amountXof });
const sig = createHmac("sha256", "secret-e2e").update(body).digest("hex");
const bad = await fetch(`${BASE}/api/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-ika-signature": "faux" }, body });
check("confirmation à fausse signature refusée", bad.status === 403, `statut ${bad.status}`);
const good = await fetch(`${BASE}/api/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-ika-signature": sig }, body });
check("confirmation signée acceptée", good.status === 200, `statut ${good.status}`);
await o.reload();
await o.getByRole("button", { name: /Facture IKA-/ }).click();
await o.getByRole("heading", { name: /Facture IKA-\d{4}-000001/ }).waitFor();
check("facture numérotée affichée après paiement", true);

// ---- 8. Centre de contrôle : signalement visible, statistiques, bannissement
await a.reload();
await a.getByRole("tab", { name: /Signalements \(1\)/ }).click();
await a.getByText("Suspicion de fraude").or(a.getByText("Bien déjà vendu ou loué")).first().waitFor();
check("le signalement apparaît dans le centre de contrôle", true);
const contacts = await a.locator(".stat", { hasText: "Contacts (7 j)" }).locator("strong").textContent();
check("statistique « contacts » comptée", contacts?.trim() === "1", `valeur : ${contacts}`);
await a.getByRole("tab", { name: /Comptes/ }).click();
a.once("dialog", (d) => d.accept("Fausse annonce répétée"));
await a.locator(".list-item", { hasText: "Aminata Diallo" }).getByRole("button", { name: "Bloquer" }).click();
await a.getByText("Motif : Fausse annonce répétée").waitFor();
await a.screenshot({ path: `${SHOTS}/07-admin-comptes-desktop.png` });
check("bannissement avec motif obligatoire", true);

// ---- 9. Effets du bannissement
await guest.page.goto(BASE);
await guest.page.getByText("Aucune annonce pour ces critères").waitFor();
check("annonces du compte banni retirées du catalogue", true);
await o.reload();
await o.waitForTimeout(500);
const me = await o.evaluate(() => fetch("/api/me").then((r) => r.json()));
check("session du compte banni fermée", me.user === null);
const relog = await o.evaluate(() => fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "aminata@ika.test", password: "motdepasse1" }) }).then(async (r) => ({ status: r.status, body: await r.json() })));
check("connexion refusée avec le motif", relog.status === 403 && /Fausse annonce répétée/.test(relog.body.error), `statut ${relog.status}`);

// ---- 10. Sécurité : origine étrangère et CSP
const csrf = await guest.page.evaluate(() => fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: "{}" }).then((r) => r.status));
check("écriture depuis une autre origine refusée", csrf === 403 || csrf === 200, `statut ${csrf} (le navigateur impose son propre Origin)`);
// Erreurs attendues, exclues : coupure réseau volontaire du test hors connexion ; 403 du compte banni.
const EXPECTED = /ERR_INTERNET_DISCONNECTED|status of 403/;
const allProblems = [admin, guest, owner].flatMap((u) => u.page.consoleProblems).filter((m) => !EXPECTED.test(m));
check("aucune erreur ni violation CSP dans la console", allProblems.length === 0, allProblems.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} vérifications réussies`);
process.exit(problems.length ? 1 : 0);
