// Anomalie A-08 : les routes elles-mêmes (webhook signé, réglages, journal d'audit, annonces similaires), sans Express ni base.
// Express est remplacé par un mini routeur de test ; les services sont des doublures, sauf WhatsApp et réglages (code réel).
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHmac } from "node:crypto";

register("./helpers/express-resolver.mjs", import.meta.url);
const { buildRoutes } = await import("../server/routes/index.js");
const { createWhatsApp } = await import("../server/services/whatsapp.js");
const { createSuperadminSettings } = await import("../server/services/superadmin-settings.js");
const { forbidden, unauthorized } = await import("../server/lib/errors.js");

const SECRET = "secret-de-test";
const RANK = { USER: 0, MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 };
const ROLES = { u1: "USER", adm: "ADMIN", sup: "SUPERADMIN" };

function setup({ appSecret = SECRET } = {}) {
  const calls = { dbQueries: [], crmUpdates: [], settingsWrites: [] };
  const settingsRows = [
    { key: "main", value: { welcome_title: "Bienvenue", colors: { primary: "#0b6b3a" }, modules: { crm: false }, api_key: "SECRET_INTERNE" } },
    { key: "autre", value: { token: "NE_DOIT_PAS_SORTIR" } },
  ];
  const db = { query: async (sql, params) => { calls.dbQueries.push({ sql, params }); return /ika_superadmin_settings/.test(sql) ? (/insert/.test(sql) ? [{ key: params[0] }] : settingsRows) : [{ id: "lead-1", advertiser_id: "adv-1", notes: "" }]; } };
  const services = {
    db,
    whatsapp: createWhatsApp({ config: { whatsapp: { appSecret, verifyToken: "jeton" } }, logger: { info() {}, error() {} } }),
    crm: { update: async (adv, leadId, patch) => { calls.crmUpdates.push({ adv, leadId, patch }); return {}; } },
    superadminSettings: createSuperadminSettings({ db }),
    moderationAudit: { list: async () => [{ id: "a1" }], log: async () => { calls.settingsWrites.push("audit"); } },
    accounts: { requireStaff: async (uid, min) => { if (RANK[ROLES[uid] ?? "USER"] < RANK[min]) throw forbidden("Réservé."); return {}; } },
    listings: { similarPublic: async (listingId) => [{ id: "s1", of: listingId }] },
  };
  const requireUser = (req) => { if (!req.user?.id) throw unauthorized("Connexion requise."); return req.user.id; };
  const router = buildRoutes({ services, config: {}, limiter: () => {}, logger: { info() {}, error() {} }, counters: {}, requireUser, setSession() {}, clearSession() {} });
  return { router, calls };
}
const sign = (raw, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
const msg = { entry: [{ changes: [{ value: { messages: [{ from: "223 70-12-34-56", type: "text", text: { body: "Bonjour" } }] } }] }] };

test("webhook POST sans secret d'application configuré : 503, rien n'est traité", async () => {
  const { router, calls } = setup({ appSecret: "" });
  const raw = JSON.stringify(msg);
  const out = await router.call("POST", "/webhooks/whatsapp", { rawBody: raw, body: msg, headers: { "X-Hub-Signature-256": sign(raw) } });
  assert.equal(out.status, 503);
  assert.equal(calls.crmUpdates.length, 0);
});

test("webhook POST non signé ou mal signé : 401, aucun lead modifié", async () => {
  const { router, calls } = setup();
  const raw = JSON.stringify(msg);
  assert.equal((await router.call("POST", "/webhooks/whatsapp", { rawBody: raw, body: msg })).status, 401);
  assert.equal((await router.call("POST", "/webhooks/whatsapp", { rawBody: raw, body: msg, headers: { "x-hub-signature-256": sign(raw, "autre") } })).status, 401);
  assert.equal(calls.crmUpdates.length, 0);
  assert.equal(calls.dbQueries.length, 0);
});

test("webhook POST signé : 200, le numéro est réduit aux chiffres et le lead est mis à jour", async () => {
  const { router, calls } = setup();
  const raw = JSON.stringify(msg);
  const out = await router.call("POST", "/webhooks/whatsapp", { rawBody: raw, body: msg, headers: { "x-hub-signature-256": sign(raw) } });
  assert.equal(out.status, 200);
  assert.equal(calls.dbQueries[0].params[0], "2237012" + "3456");
  assert.equal(calls.crmUpdates.length, 1);
  assert.equal(calls.crmUpdates[0].leadId, "lead-1");
  assert.equal(calls.crmUpdates[0].patch.status, "CONTACTED");
  assert.match(calls.crmUpdates[0].patch.notes, /Bonjour/);
});

test("webhook GET : défi renvoyé avec le bon jeton, 403 sinon", async () => {
  const { router } = setup();
  const ok = await router.call("GET", "/webhooks/whatsapp", { query: { "hub.mode": "subscribe", "hub.verify_token": "jeton", "hub.challenge": "42" } });
  assert.equal(ok.status, 200); assert.equal(ok.body, "42");
  const bad = await router.call("GET", "/webhooks/whatsapp", { query: { "hub.mode": "subscribe", "hub.verify_token": "faux", "hub.challenge": "42" } });
  assert.equal(bad.status, 403);
});

test("réglages publics : sans connexion, seulement la liste blanche", async () => {
  const { router } = setup();
  const out = await router.call("GET", "/superadmin-settings/public");
  assert.equal(out.error, null);
  assert.deepEqual(out.body, { welcome_title: "Bienvenue", modules: { crm: false }, colors: { primary: "#0b6b3a" } });
  assert.ok(!JSON.stringify(out.body).includes("SECRET_INTERNE") && !JSON.stringify(out.body).includes("NE_DOIT_PAS_SORTIR"));
});

test("réglages Superadmin : anonyme 401, ADMIN et utilisateur 403, SUPERADMIN autorisé", async () => {
  const { router } = setup();
  for (const [method, url] of [["GET", "/staff/superadmin-settings"], ["GET", "/staff/superadmin-settings/main"], ["PUT", "/staff/superadmin-settings/main"]]) {
    assert.equal((await router.call(method, url, { body: { value: {} } })).error?.status, 401, `${method} ${url} anonyme`);
    assert.equal((await router.call(method, url, { user: { id: "u1" }, body: { value: {} } })).error?.status, 403, `${method} ${url} utilisateur`);
    assert.equal((await router.call(method, url, { user: { id: "adm" }, body: { value: {} } })).error?.status, 403, `${method} ${url} admin`);
  }
  const ok = await router.call("GET", "/staff/superadmin-settings", { user: { id: "sup" } });
  assert.equal(ok.error, null); assert.ok(ok.body.main);
  const put = await router.call("PUT", "/staff/superadmin-settings/main", { user: { id: "sup" }, body: { value: { welcome_title: "x" } } });
  assert.equal(put.error, null);
});

test("journal d'audit de modération : réservé aux ADMIN et au-dessus", async () => {
  const { router } = setup();
  assert.equal((await router.call("GET", "/staff/moderation-audit", {})).error?.status, 401);
  assert.equal((await router.call("GET", "/staff/moderation-audit", { user: { id: "u1" } })).error?.status, 403);
  const ok = await router.call("GET", "/staff/moderation-audit", { user: { id: "adm" } });
  assert.equal(ok.error, null); assert.deepEqual(ok.body, [{ id: "a1" }]);
});

test("annonces similaires : une seule route, qui appelle similarPublic (plus de réponse vide)", async () => {
  const { router } = setup();
  assert.equal(router.routes.filter((r) => r.method === "GET" && r.path === "/listings/:id/similar").length, 1);
  const out = await router.call("GET", "/listings/ann-9/similar");
  assert.deepEqual(out.body, [{ id: "s1", of: "ann-9" }]);
});
