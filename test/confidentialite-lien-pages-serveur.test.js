// Les pages rendues côté serveur (quartiers, guides, annonces publiques) offrent le lien « Gérer mes choix ».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { layout } from "../server/seo/render.js";

test("page rendue côté serveur : pied de page avec le lien « Gérer mes choix »", () => {
  const html = layout({ base: "https://exemple.test", path: "/quartiers", title: "Quartiers", description: "Liste", body: "<p>x</p>" });
  assert.match(html, /<footer class="seo-footer">[\s\S]*<a href="\/\?choix=1" rel="nofollow">Gérer mes choix<\/a>/);
});

test("application : /?choix=1 ouvre le panneau et retire le paramètre de l'adresse", () => {
  const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.match(app, /get\("choix"\) === "1"/);
  assert.match(app, /history\.replaceState\(null, "", location\.pathname \+ location\.hash\);\s*openConsentPanel\(\)/);
});
