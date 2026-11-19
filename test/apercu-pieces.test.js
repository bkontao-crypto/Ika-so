import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const viewer = readFileSync(new URL("../public/js/owner/proof-viewer.js", import.meta.url), "utf8");
const modules = readFileSync(new URL("../public/js/owner/v-modules.js", import.meta.url), "utf8");

test("aperçu des pièces : aucun lien ni bouton de téléchargement, pas de nouvel onglet", () => {
  assert.doesNotMatch(viewer, /download|createObjectURL|window\.open|\.save\(/);
});
test("les pièces s'ouvrent dans la plateforme (plus de window.open sur les pièces)", () => {
  assert.match(modules, /previewDocument\(fileData/);
  assert.doesNotMatch(modules, /window\.open\(URL\.createObjectURL/);
});
test("accepter / refuser une pièce : motif d'au moins 3 caractères contrôlé dans le formulaire", () => {
  assert.match(modules, /label: "Qu'avez-vous contrôlé \?"[^}]*min: 3/);
  assert.match(modules, /Motif du refus \(transmis au propriétaire\)[^}]*min: 3/);
});
