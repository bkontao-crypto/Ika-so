// Page d'une annonce : un clic sur la photo l'ouvre en plein écran, avec défilement gauche/droite entre les photos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/pages/listing.js", import.meta.url), "utf8");

test("la photo principale ouvre le plein écran (souris, doigt, clavier)", () => {
  assert.match(src, /import \{ openFullscreen, socialBar \}/);
  assert.match(src, /openFullscreen\(all, photo,/);
  assert.match(src, /onClick: openFull/);
  assert.match(src, /onKeydown/);
});
test("le plein écran garde la miniature active en phase avec la photo affichée", () => assert.match(src, /\(i\) => \{ photo = i; main\.src = all\[i\]; drawThumbs\(\); \}/));
