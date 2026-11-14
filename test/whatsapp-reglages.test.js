// Anomalies A-03 et A-05 : signature du webhook WhatsApp et réglages publics en liste blanche. Aucun accès réseau ni base.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createWhatsApp } from "../server/services/whatsapp.js";
import { publicView } from "../server/services/superadmin-settings.js";
import { getConfig } from "../server/config.js";

const SECRET = "secret-de-test";
const wa = (whatsapp) => createWhatsApp({ config: { whatsapp }, logger: { info() {}, error() {} } });
const sign = (raw, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

test("signature valide acceptée", () => {
  const raw = '{"entry":[]}';
  assert.equal(wa({ appSecret: SECRET }).verifySignature(raw, sign(raw)), "ok");
});

test("signature fausse, absente, mal formée ou calculée sur un autre texte : refusée", () => {
  const s = wa({ appSecret: SECRET }), raw = '{"a":1}';
  assert.equal(s.verifySignature(raw, sign(raw, "autre-secret")), "invalid");
  assert.equal(s.verifySignature(raw, sign('{"a":2}')), "invalid");
  assert.equal(s.verifySignature(raw, undefined), "invalid");
  assert.equal(s.verifySignature(raw, "sha256=zz"), "invalid");
  assert.equal(s.verifySignature(undefined, sign(raw)), "invalid");
});

test("sans secret d'application configuré, le webhook n'est jamais accepté", () => {
  const raw = "{}";
  assert.equal(wa({}).verifySignature(raw, sign(raw)), "not_configured");
  assert.equal(createWhatsApp({ config: {} }).verifySignature(raw, sign(raw, "")), "not_configured");
});

test("vérification GET : jeton exact exigé ; jeton absent des deux côtés refusé", () => {
  assert.equal(wa({ verifyToken: "abc" }).verifyWebhook("subscribe", "abc", "42"), "42");
  assert.equal(wa({ verifyToken: "abc" }).verifyWebhook("subscribe", "faux", "42"), null);
  assert.equal(wa({}).verifyWebhook("subscribe", undefined, "42"), null);
});

test("la configuration WhatsApp vient de l'environnement et reste vide par défaut", () => {
  assert.equal(getConfig({}).whatsapp.appSecret, "");
  assert.equal(getConfig({ WHATSAPP_APP_SECRET: "x", WHATSAPP_VERIFY_TOKEN: "y" }).whatsapp.appSecret, "x");
});

test("réglages publics : seules les clés d'affichage connues sortent", () => {
  const out = publicView({
    welcome_title: "Bienvenue", welcome_subtitle: "Sous-titre",
    modules: { crm: false, map: true, premium: "oui", secret_module: true },
    colors: { primary: "#0b6b3a", accent: "javascript:alert(1)", autre: "#fff" },
    api_key: "NE_DOIT_PAS_SORTIR", internal: { a: 1 },
  });
  assert.deepEqual(out, { welcome_title: "Bienvenue", welcome_subtitle: "Sous-titre", modules: { crm: false, map: true }, colors: { primary: "#0b6b3a" } });
});

test("réglages publics : absence ou valeur invalide donne un objet vide, jamais les autres lignes", () => {
  assert.deepEqual(publicView(undefined), {});
  assert.deepEqual(publicView("texte"), {});
  assert.deepEqual(publicView({ api_key: "x" }), {});
});
