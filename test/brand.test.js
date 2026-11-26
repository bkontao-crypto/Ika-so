// Nom de la plateforme : modifiable par le Superadmin, repris partout (aucun texte en dur).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_BRAND, applyBrand, brand, brandSlug, brandUpper, cleanBrand, loadBrand, setBrand } from "../server/lib/brand.js";
import { documentDisclaimer } from "../server/lib/rules.js";
import { formatReceiptEmail } from "../server/lib/receipt-email.js";
import { appFailPage } from "../server/lib/google-oauth.js";
import { DEFAULT_STAR_POLICY } from "../server/lib/star-badge-policy.js";

test("nom du site : défaut, renommage, nettoyage, majuscules, nom de fichier", () => {
  setBrand("");
  assert.equal(brand(), DEFAULT_BRAND);
  setBrand("  Maison <b>Bamako</b>  ");
  assert.equal(brand(), "Maison bBamako/b");
  setBrand("Kèlè   Immo");
  assert.equal(brand(), "Kèlè Immo");
  assert.equal(brandUpper(), "KÈLÈ IMMO");
  assert.equal(brandSlug(), "kele-immo");
  assert.equal(cleanBrand("x".repeat(200)).length, 80);
  setBrand("");
});

test("loadBrand lit le réglage en base ; une base en panne garde le nom courant", async () => {
  await loadBrand({ query: async () => [{ value: "Dembélé Immo" }] });
  assert.equal(brand(), "Dembélé Immo");
  await loadBrand({ query: async () => { throw new Error("down"); } });
  assert.equal(brand(), "Dembélé Immo");
  await loadBrand({ query: async () => [] });
  assert.equal(brand(), DEFAULT_BRAND);
});

test("les textes lus à l'appel suivent le nouveau nom (pas figés au chargement)", () => {
  setBrand("Kèlè Immo");
  assert.match(documentDisclaimer(), /Kèlè Immo ne certifie/);
  assert.match(formatReceiptEmail({ reference: "R1", amountXof: 1000 }).subject, /Kèlè Immo$/);
  assert.match(appFailPage("compte-existant"), /compte Kèlè Immo protégé/);
  assert.match(DEFAULT_STAR_POLICY.infoBody, /équipe Kèlè Immo à partir/);
  assert.doesNotMatch(appFailPage("compte-existant"), /Ika So|IKA SÔ/);
  setBrand("");
});

test("applyBrand : documents juridiques écrits avec le nom d'origine", () => {
  setBrand("Kèlè Immo");
  assert.equal(applyBrand("IKA SO Immobilier édite Ika So et IKA SÔ."), "Kèlè Immo édite Kèlè Immo et KÈLÈ IMMO.");
  setBrand("");
  assert.equal(applyBrand("Ika So"), "Ika So");
});

// Garde-fou : aucun nouveau texte ne doit réécrire le nom en dur (hors commentaires, noms techniques et module brand).
test("aucun nom de site en dur dans le code du site et du serveur", () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk("public/js"), ...walk("server")].filter((f) => f.endsWith(".js") && !/brand\.js$/.test(f));
  const bad = [];
  for (const f of files) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (/IKA S[OÔ]|Ika S[oô]|\bika so\b/.test(line.replace(/\/\/.*$/, ""))) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], "utiliser brand() / brandUpper() (ou {{SITE_NAME}} dans les pages HTML)");
});
