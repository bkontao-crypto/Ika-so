// Audit lot 2 : les routes de modèles WhatsApp doivent exister dès le démarrage (elles étaient déclarées DANS le gestionnaire d'un envoi de texte).
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./helpers/express-resolver.mjs", import.meta.url);
const { buildRoutes } = await import("../server/routes/index.js");
const { unauthorized } = await import("../server/lib/errors.js");

function setup() {
  const calls = { sent: [], notes: [] };
  const whatsapp = {
    isConfigured: () => true,
    listTemplates: async () => ({ data: [{ name: "bienvenue", language: "fr", status: "APPROVED" }] }),
    sendText: async (to, text) => { calls.sent.push(["text", to, text]); return { messages: [{ id: "m1" }] }; },
    sendTemplate: async (to, name, lang) => { calls.sent.push(["template", to, name, lang]); return { messages: [{ id: "m2" }] }; },
  };
  const crm = {
    get: async (_u, leadId) => (leadId === "l1" ? { id: "l1", contact_phone: "22370000000", notes: "" } : null),
    update: async (_u, _id, patch) => { calls.notes.push(patch.notes); return {}; },
  };
  const requireUser = (req) => { if (!req.user?.id) throw unauthorized("Connexion requise."); return req.user.id; };
  const router = buildRoutes({ services: { whatsapp, crm }, config: {}, limiter: () => {}, logger: { info() {}, error() {} }, counters: {}, requireUser, setSession() {}, clearSession() {} });
  return { router, calls };
}
const count = (router, method, path) => router.routes.filter((r) => r.method === method && r.path === path).length;

test("les routes modèles WhatsApp sont enregistrées dès le démarrage, une seule fois", () => {
  const { router } = setup();
  assert.equal(count(router, "GET", "/me/whatsapp/templates"), 1);
  assert.equal(count(router, "POST", "/me/crm/leads/:id/whatsapp-template"), 1);
  assert.equal(count(router, "POST", "/me/crm/leads/:id/whatsapp"), 1);
});

test("envoyer un texte n'enregistre aucune nouvelle route (plus de fuite) et ne bloque pas les modèles", async () => {
  const { router, calls } = setup();
  const before = router.routes.length;
  for (let i = 0; i < 3; i++) assert.equal((await router.call("POST", "/me/crm/leads/l1/whatsapp", { user: { id: "u1" }, body: { text: "Bonjour" } })).status, 200);
  assert.equal(router.routes.length, before);
  assert.equal(calls.sent.length, 3);
  const list = await router.call("GET", "/me/whatsapp/templates", { user: { id: "u1" } });
  assert.equal(list.status, 200);
  assert.equal(list.body[0].name, "bienvenue");
});

test("envoi d'un modèle : lead inconnu 404, nom manquant 400, succès journalisé dans les notes", async () => {
  const { router, calls } = setup();
  const as = { user: { id: "u1" } };
  assert.equal((await router.call("POST", "/me/crm/leads/zz/whatsapp-template", { ...as, body: { template: "bienvenue" } })).status, 404);
  assert.equal((await router.call("POST", "/me/crm/leads/l1/whatsapp-template", { ...as, body: {} })).status, 400);
  const ok = await router.call("POST", "/me/crm/leads/l1/whatsapp-template", { ...as, body: { template: "bienvenue", language: "fr" } });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls.sent.at(-1), ["template", "22370000000", "bienvenue", "fr"]);
  assert.match(calls.notes.at(-1), /Template WhatsApp\] bienvenue/);
});

test("sans connexion : refus (401) et non 404", async () => {
  const { router } = setup();
  const out = await router.call("GET", "/me/whatsapp/templates");
  assert.equal(out.error?.status, 401, "requireUser refuse avant tout traitement");
});
