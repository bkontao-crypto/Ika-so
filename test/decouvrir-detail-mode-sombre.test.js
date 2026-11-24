// Découvrir : « Écrire » dans le détail de la publication (sur la ligne du nom) et lisibilité du mode sombre.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readableOn, contrastRatio } from "../public/js/core/contrast.js";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");

test("readableOn : texte blanc ou sombre selon la couleur principale, contraste ≥ 4,5", () => {
  for (const bg of ["#0033ff", "#1e6b50", "#c9ef75", "#ffd166", "#ffffff", "#000000", "#f0b429", "#99bbff"]) {
    const fg = readableOn(bg);
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(contrastRatio(rgb(bg), rgb(fg)) >= 4.5, `${bg} → ${fg}`);
  }
  assert.equal(readableOn("#0033ff"), "#ffffff");
  assert.equal(readableOn("#c9ef75"), "#04130c");
  assert.equal(readableOn("pas une couleur"), null);
  assert.equal(readableOn("#fff"), "#04130c");
});

test("la couleur principale choisie règle aussi la couleur du texte dessus (clair et sombre)", () => {
  assert.match(read("js/bootstrap-settings.js"), /--on-leaf/);
  assert.match(read("css/components.css"), /data-theme="dark"\] \.btn-primary[\s\S]*?color: var\(--on-leaf/);
});

test("le site public n'utilise plus --soft (absent hors Owner center) pour les commentaires et cartes partagées", () => {
  const social = read("css/social.css") + read("css/decouvrir.css");
  assert.ok(!/var\(--soft[,)]/.test(social), "--soft n'existe pas sur le site public : fond clair illisible en mode sombre");
  assert.match(social, /\.sc-comment\{background:var\(--surface-2/);
  assert.match(social, /\.dc-shared\{[^}]*background:var\(--surface-2/);
});

test("« Écrire » n'est plus au pied de la carte : il est dans le détail, sur la ligne du nom", () => {
  const dec = read("js/pages/decouvrir.js");
  assert.ok(!/dc-actions/.test(dec), "plus de pied de carte");
  assert.match(dec, /action: ecrire/);
  assert.match(dec, /openLightbox\(\[\], 0,/, "une publication sans photo a aussi son détail");
  const soc = read("js/components/social.js");
  assert.match(soc, /sc-sidehead[\s\S]*title \? h\("strong", null, title\)[\s\S]*action\?\.\(\)/, "nom puis action sur la même ligne");
  assert.match(read("css/social.css"), /\.sc-sidehead\{display:flex;[^}]*justify-content:space-between/);
});
