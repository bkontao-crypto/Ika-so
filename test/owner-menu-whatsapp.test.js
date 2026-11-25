// Owner center : une entrée « WhatsApp » (Clients & croissance) mène à la boîte WhatsApp du site ; réservée au Superadmin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/owner/main.js", import.meta.url), "utf8");

test("l'entrée de menu WhatsApp existe et ouvre #/whatsapp", () => {
  assert.match(src, /\["whatsapp", "mail", "WhatsApp"\]/);
  assert.match(src, /whatsapp: whatsappView/);
  assert.match(src, /href: "\/#\/whatsapp"/);
});
test("aucun module délégable pour WhatsApp : réservé au Superadmin", () => assert.doesNotMatch(src.match(/const MODULE_OF = \{[^}]*\}/s)?.[0] ?? "", /whatsapp/));
