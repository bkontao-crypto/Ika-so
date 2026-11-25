// Double authentification : « Ouvrir dans mon application » (otpauth://) prévient quand rien ne s'ouvre et propose « Copier la clé ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { otpauthUri } from "../server/lib/totp.js";

const src = readFileSync(new URL("../public/js/components/mfa-security.js", import.meta.url), "utf8");

test("le lien otpauth est bien formé", () => assert.match(otpauthUri("ABCDEFGH", "a@b.c"), /^otpauth:\/\/totp\/Ika%20So:a%40b\.c\?secret=ABCDEFGH&issuer=Ika%20So/));
test("un message apparaît si aucune application ne s'ouvre, et la clé peut être copiée", () => {
  assert.match(src, /Aucune application ne s'est ouverte/);
  assert.match(src, /Copier la clé/);
  assert.match(src, /navigator\.clipboard\.writeText\(view\.secret\)/);
});
