// Profil sur téléphone : la largeur de la page ne doit plus dépendre de la somme des onglets (cause du débordement),
// et les onglets en trop passent dans le menu « ••• » (pas de « Plus ▾ » sur petit écran).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../public/css/${f}`, import.meta.url), "utf8");
const js = readFileSync(new URL("../public/js/components/profile-tabs.js", import.meta.url), "utf8");

test("la grille du profil a une colonne bornée (minmax(0, 1fr)) et des enfants rétrécissables", () => {
  const mp = css("mon-profil.css");
  assert.match(mp, /\.mp \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(mp, /\.mp > \* \{ min-width: 0; \}/);
  assert.match(css("profil-onglets.css"), /\.mp-header-pop \{[^}]*min-width: 0/);
});

test("téléphone : « Plus ▾ » masqué, bouton ••• réduit", () => {
  const c = css("profil-onglets.css");
  assert.match(c, /@media \(max-width: 640px\)[\s\S]*\.mpt-more \{ display: none !important; \}/);
  assert.match(c, /\.mpt-dots-btn \{ min-width: 36px; height: 32px;/);
});

test("le composant range les onglets en trop dans le menu ••• en mode compact", () => {
  assert.match(js, /matchMedia\("\(max-width: 640px\)"\)/);
  assert.match(js, /"Autres sections"/);
});
