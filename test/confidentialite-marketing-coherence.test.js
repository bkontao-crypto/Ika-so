// La politique publiée (/confidentialite) doit rester cohérente avec les pixels Marketing prévus (éteints par défaut).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARKETING_PROVIDERS } from "../server/lib/consent-services.js";

const policy = readFileSync(new URL("../docs/juridique/projet-confidentialite.md", import.meta.url), "utf8");
const registre = readFileSync(new URL("../docs/juridique/registre-cookies-et-prestataires.md", import.meta.url), "utf8");

test("la politique ne prétend plus « aucun traceur publicitaire » sans réserve", () => {
  assert.doesNotMatch(policy, /- Aucun traceur publicitaire, pas de CDN/);
  assert.match(policy, /éteints par défaut/);
  assert.match(policy, /Marketing et publicité/);
});
test("chaque pixel prévu est cité dans la politique et dans le registre", () => {
  for (const name of ["Meta", "Google Ads", "TikTok"]) { assert.match(policy, new RegExp(name)); assert.match(registre, new RegExp(name)); }
  assert.deepEqual(Object.keys(MARKETING_PROVIDERS).sort(), ["google", "meta", "tiktok"]);
});
