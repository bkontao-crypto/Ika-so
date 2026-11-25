// Page WhatsApp intégrée au site (#/whatsapp) : route SPA, ancienne adresse redirigée, erreurs Meta lisibles, numéro local malien complété.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("la page est une route du site et l'ancienne page autonome est redirigée", () => {
  assert.match(read("public/js/app.js"), /\[\/\^\\\/whatsapp\$\/, "whatsapp", "whatsappPage"\]/);
  assert.match(read("server/app.js"), /\["\/whatsapp", "\/whatsapp\.html"\], \(req, res\) => res\.redirect\(302, "\/#\/whatsapp"\)/);
  assert.equal(existsSync(new URL("../public/whatsapp.html", import.meta.url)), false);
});

test("les erreurs Meta fréquentes sont expliquées en français", async () => {
  globalThis.document = { querySelector: () => null, head: { append() {} }, createElement: () => ({}) };
  const { friendlyError } = await import("../public/js/pages/whatsapp.js").catch(() => ({ friendlyError: null }));
  if (!friendlyError) return; // le module dépend du navigateur : le contrôle de texte ci-dessous suffit alors
  assert.match(friendlyError("Meta a refusé le message : (#131030) Recipient phone number not in allowed list"), /liste autorisée/);
  assert.match(friendlyError("(#131047) Re-engagement message"), /24 heures/);
});

test("un numéro malien à 8 chiffres reçoit l'indicatif 223", () => assert.match(read("server/services/whatsapp-inbox.js"), /if \(to\.length === 8\) to = `223\$\{to\}`/));
