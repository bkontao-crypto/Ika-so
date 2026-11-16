// Décision du propriétaire (16/11) : plus de bouton « Retour » à l'écran sur le site public ; la navigation arrière se fait
// avec le retour du téléphone / du navigateur. Seules restent les sorties d'écrans qui n'ont pas d'historique ou ne changent
// pas d'adresse (page d'erreur, facture ouverte dans la page « Paiements », lien d'e-mail de réinitialisation).
// Hors périmètre : la console d'administration (admin.js) et le centre de contrôle (owner/), interfaces séparées.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const pub = new URL("../public/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(pub, "js")).map((p) => relative(join(pub, "js"), p)).filter((f) => f.endsWith(".js") && f !== "admin.js" && !f.startsWith("owner/") && !f.startsWith("vendor/"));

// [fichier, extrait de la ligne autorisée, raison]
const AUTORISES = [
  ["app.js", "Retour à l'accueil", "page introuvable / erreur : seule sortie"],
  ["pages/payments.js", "onClick: paymentsPage }, \"Retour\"", "ferme la facture et réaffiche la liste sans changer d'adresse"],
  ["pages/password-reset.js", "Retour à la connexion", "page ouverte depuis un lien d'e-mail, sans historique"],
  ["pages/centre.js", "Retour au profil", "écran d'erreur"],
  ["pages/complaints.js", "Retour à mon profil", "écran d'erreur"],
  ["pages/compte-unifie.js", "\"Retour\"", "écrans d'erreur « bien introuvable / impossible à charger »"],
];

test("aucun bouton ou lien « Retour » de navigation sur le site public (hors sorties autorisées)", () => {
  const trouves = [];
  for (const f of files) {
    readFileSync(join(pub, "js", f), "utf8").split("\n").forEach((ligne, i) => {
      if (!/["'`]\s*(←\s*)?Retour\b|["'`]←\s/.test(ligne)) return;
      if (AUTORISES.some(([fic, extrait]) => fic === f && ligne.includes(extrait))) return;
      trouves.push(`${f}:${i + 1}  ${ligne.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(trouves, [], "bouton « Retour » non autorisé : utiliser le retour du téléphone, ou justifier l'exception dans AUTORISES");
});

test("la barre « Retour » globale a disparu (conteneur, rendu et appel à history.back)", () => {
  assert.ok(!/id="backbar"/.test(readFileSync(join(pub, "index.html"), "utf8")), "#backbar dans index.html");
  const chrome = readFileSync(join(pub, "js/components/chrome.js"), "utf8");
  assert.ok(!/renderBackbar|backbar|history\.back|goBack/.test(chrome), "reste de la barre Retour dans chrome.js");
  const aveuglesHistorique = files.filter((f) => /history\.back\(|goBack\(/.test(readFileSync(join(pub, "js", f), "utf8")));
  assert.deepEqual(aveuglesHistorique, [], "history.back()/goBack() dans le site public");
});

test("garde-fou : le test lit bien les pages du site", () => {
  assert.ok(files.length > 30 && files.includes("pages/advertiser.js") && files.includes("components/chrome.js"));
});
