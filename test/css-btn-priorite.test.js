// Régression de l'en-tête mobile (15/11) : components.css est chargé en dernier et déclare « .btn { display: inline-flex } ».
// Une règle « .xxx { display: none } » d'une autre feuille, visant un bouton qui porte aussi la classe .btn, a la MÊME priorité
// mais passe AVANT : elle perd, et l'élément réapparaît (ex. « Publier » dans l'en-tête mobile, qui faisait passer les boutons à la ligne).
// Test statique : toute règle qui masque un bouton doit être plus prioritaire qu'une simple classe (ex. « .site-header .header-publish »).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const pub = new URL("../public/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sources = walk(pub).filter((f) => /\.(js|html)$/.test(f)).map((f) => readFileSync(f, "utf8"));
const BASE = new Set(["btn", "pa-btn", "mp-btn"]); // boutons stylés par components.css

// Classes qui accompagnent un bouton de base dans le code (class: "btn btn-small header-publish", class="btn …")
const accompagnantes = new Set();
for (const src of sources) {
  for (const m of src.matchAll(/(?:class|className)\s*[:=]\s*["'`]([^"'`$]*)["'`]/g)) {
    const tokens = m[1].split(/\s+/).filter(Boolean);
    if (tokens.some((t) => BASE.has(t))) tokens.filter((t) => !BASE.has(t)).forEach((t) => accompagnantes.add(t));
  }
}

const css = readdirSync(join(pub, "css")).filter((f) => f.endsWith(".css") && f !== "components.css");
function reglesQuiMasquent(texte) {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  for (const m of sansCommentaires.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)) {
    if (!/display\s*:\s*none\s*(?:!important)?\s*(?:;|$)/.test(m[2])) continue;
    if (/!important/.test(m[2])) continue; // !important gagne toujours
    for (const sel of m[1].split(",").map((s) => s.trim())) out.push(sel);
  }
  return out;
}

test("le code contient bien des boutons à classes accompagnantes (garde-fou du test)", () => {
  assert.ok(accompagnantes.has("header-publish"), "header-publish devrait accompagner .btn dans chrome.js");
});

test("aucune feuille ne masque un bouton avec une simple classe (écrasée par .btn de components.css)", () => {
  const fautifs = [];
  for (const f of css) {
    for (const sel of reglesQuiMasquent(readFileSync(join(pub, "css", f), "utf8"))) {
      const m = /^\.([A-Za-z][\w-]*)$/.exec(sel); // exactement UNE classe, rien d'autre (même priorité que .btn)
      if (m && accompagnantes.has(m[1])) fautifs.push(`${f} : ${sel} { display: none }`);
    }
  }
  assert.deepEqual(fautifs, [], "préfixer le sélecteur (ex. .site-header .header-publish) pour qu'il l'emporte sur .btn");
});
