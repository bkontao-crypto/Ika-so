// Régression (26/11) : une règle « .btn » propre au mode sombre effaçait les couleurs des boutons or, danger, discret, etc.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../public/css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("aucune règle sombre sur le bouton de base seul ne force la couleur ou le fond", () => {
  for (const f of ["components.css", "owner.css", "refonte.css", "ika.css", "modern.css"]) {
    for (const [, selectors, body] of css(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(^|;)\s*(color|background(-color)?)\s*:/.test(body)) continue;
      for (const sel of selectors.split(",").map((s) => s.trim())) {
        assert.doesNotMatch(sel, /\[data-theme=["']?dark["']?\]\)?\s+\.(btn|pa-btn|mp-btn)$/, `${f} : ${sel}`);
      }
    }
  }
});

test("le texte des boutons or suit la couleur d'accent choisie", () => {
  assert.match(css("components.css"), /\.pa-btn\.soft\s*\{[^}]*color:\s*var\(--on-gold/);
  assert.match(css("refonte.css"), /\.btn-gold, \.btn-lime \{[^}]*color: var\(--on-gold/);
  assert.match(readFileSync(new URL("../public/js/bootstrap-settings.js", import.meta.url), "utf8"), /setProperty\("--on-gold"/);
});
