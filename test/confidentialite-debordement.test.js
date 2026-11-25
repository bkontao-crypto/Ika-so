// Réglages de confidentialité : une ligne ne doit jamais élargir la page (texte long + boutons sur petit écran).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/css/mon-profil.css", import.meta.url), "utf8");
const rule = (sel) => css.split("\n").find((l) => l.startsWith(`${sel} {`)) ?? "";

test("la ligne de réglage peut passer à la ligne", () => assert.match(rule(".mp-setting"), /flex-wrap:\s*wrap/));
test("le texte d'un réglage peut rétrécir et couper les mots longs", () => assert.match(rule(".mp-setting > div:first-child"), /min-width:\s*0.*overflow-wrap:\s*anywhere|overflow-wrap:\s*anywhere.*min-width:\s*0/));
test("les contrôles ne dépassent pas la ligne", () => { assert.match(rule(".mp-ctl"), /flex-wrap:\s*wrap/); assert.match(rule(".mp-ctl"), /max-width:\s*100%/); });
