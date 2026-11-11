// Envoi SMS par Infobip : forme de la requête et refus, sur faux réseau (jamais le vrai service).
import test from "node:test";
import assert from "node:assert/strict";
import { getConfig, smsConfigured } from "../server/config.js";
import { createSmsSender } from "../server/lib/sms.js";

const env = { SMS_PROVIDER: "infobip", INFOBIP_BASE_URL: "rklell.api.infobip.com", INFOBIP_API_KEY: "cle-secrete", INFOBIP_FROM: "IkaSo" };

test("Infobip : l'adresse copiée du portail (sans https://) est complétée", () => {
  const config = getConfig(env);
  assert.equal(config.sms.infobipBaseUrl, "https://rklell.api.infobip.com");
  assert.equal(smsConfigured(config), true);
  assert.equal(getConfig({ ...env, INFOBIP_BASE_URL: "https://rklell.api.infobip.com/" }).sms.infobipBaseUrl, "https://rklell.api.infobip.com");
  assert.equal(getConfig({ ...env, INFOBIP_BASE_URL: "" }).sms.infobipBaseUrl, "");
});

test("Infobip : requête envoyée (URL, en-tête App, numéro sans +, texte)", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ messages: [{ status: { groupId: 1 } }] }) }; };
  await createSmsSender(getConfig(env), fetchImpl)("+223 70 11 22 33", "Votre code : 123456");
  assert.equal(calls[0].url, "https://rklell.api.infobip.com/sms/2/text/advanced");
  assert.equal(calls[0].init.headers.Authorization, "App cle-secrete");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.messages[0], { from: "IkaSo", destinations: [{ to: "22370112233" }], text: "Votre code : 123456" });
});

test("Infobip : refus du service ou message rejeté = erreur lisible, sans fuite de la clé", async () => {
  const sender = (res) => createSmsSender(getConfig(env), async () => res);
  await assert.rejects(sender({ ok: false, status: 401, json: async () => ({}) })("+22370112233", "x"), (e) => /Envoi du SMS impossible/.test(e.message) && !e.message.includes("cle-secrete"));
  await assert.rejects(sender({ ok: true, json: async () => ({ messages: [{ status: { groupId: 5 } }] }) })("+22370112233", "x"), /Envoi du SMS impossible/);
});

test("sans fournisseur complet : SMS refusé, aucun numéro vérifié", async () => {
  const config = getConfig({ SMS_PROVIDER: "infobip", INFOBIP_BASE_URL: "rklell.api.infobip.com" });
  assert.equal(smsConfigured(config), false);
  await assert.rejects(createSmsSender(getConfig({}))("+22370112233", "x"), /SMS non configuré/);
});
