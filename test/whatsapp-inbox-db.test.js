// Boîte WhatsApp contre un VRAI PostgreSQL et le VRAI serveur HTTP (ignoré sans DATABASE_URL_TEST). Aucun appel réel à Meta.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHmac } from "node:crypto";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { return { ok: true, r: await p }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("WhatsApp : envoi enregistré, refus de Meta expliqué, numéro invalide, non configuré", { skip }, async () => {
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createWhatsAppInbox } = await import("../server/services/whatsapp-inbox.js");
  const db = createDb(url);
  const phone = `2239${String(Date.now()).slice(-7)}`;
  try {
    await migrate(db, () => {});
    let behaviour = "ok";
    const fake = {
      isConfigured: () => behaviour !== "unconfigured",
      verifySignature: () => "ok",
      sendText: async () => {
        if (behaviour === "window") { const e = new Error("Re-engagement message"); e.status = 400; e.details = { error: { code: 131047 } }; throw e; }
        return { messages: [{ id: `wamid.OUT${phone}` }] };
      },
    };
    const inbox = createWhatsAppInbox({ db, whatsapp: fake, logger: { error() {} } });

    assert.equal((await outcome(inbox.send({ userId: null, phone: "12", message: "Bonjour" }))).status, 400, "numéro trop court");
    assert.equal((await outcome(inbox.send({ userId: null, phone, message: "   " }))).status, 400, "message vide");

    const sent = await inbox.send({ userId: null, phone: `+${phone.slice(0, 3)} ${phone.slice(3)}`, message: "Bonjour" });
    assert.equal(sent.waMessageId, `wamid.OUT${phone}`);
    let [row] = await inbox.list({ phone });
    assert.equal(row.direction, "outbound");
    assert.equal(row.status, "sent");
    assert.equal(row.text, "Bonjour");

    behaviour = "window";
    const refused = await outcome(inbox.send({ userId: null, phone, message: "Encore" }));
    assert.equal(refused.status, 502);
    assert.match(refused.message, /24 h/);
    const history = await inbox.list({ phone });
    assert.equal(history.length, 2);
    assert.equal(history[1].status, "failed");
    assert.match(history[1].error, /Re-engagement/);

    behaviour = "unconfigured";
    assert.equal((await outcome(inbox.send({ userId: null, phone, message: "x" }))).status, 503);
  } finally {
    await db.query("delete from ika_whatsapp_messages where phone_number like '2239%'").catch(() => undefined);
    await db.close();
  }
});

test("WhatsApp : webhook signé enregistré, statuts qui n'en reculent pas, droits d'accès de la page", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const { createWhatsAppInbox } = await import("../server/services/whatsapp-inbox.js");
  const db = createDb(url);
  let server;
  const tag = String(Date.now()).slice(-7);
  const phone = `2238${tag}`;
  const email = `wa${Date.now()}@test.invalid`;
  const secret = "secret-de-test";
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false", WHATSAPP_APP_SECRET: secret, WHATSAPP_VERIFY_TOKEN: "jeton" });
    const services = createServices({ db, config, sendSms: async () => ({}) });
    const whatsappInbox = createWhatsAppInbox({ db, whatsapp: services.whatsapp, logger: { error() {} } });
    const app = createApp({ services, config, health: () => db.query("select 1"), whatsappInbox });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { method = "GET", cookie, body } = {}) => fetch(base + path, {
      method,
      headers: { ...(method === "GET" ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), origin: base },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    const webhook = (payload, signed = true, wrongSecret = false) => {
      const raw = JSON.stringify(payload);
      const sig = `sha256=${createHmac("sha256", wrongSecret ? "autre" : secret).update(raw).digest("hex")}`;
      return fetch(`${base}/api/webhooks/whatsapp`, { method: "POST", headers: { "content-type": "application/json", ...(signed ? { "x-hub-signature-256": sig } : {}) }, body: raw });
    };
    const inbound = (id, text) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", contacts: [{ profile: { name: "Awa Test" }, wa_id: phone }], messages: [{ from: phone, id, timestamp: "1700000000", type: "text", text: { body: text } }] } }] }] });
    const countRows = async () => (await db.query("select count(*)::int as n from ika_whatsapp_messages where phone_number = $1", [phone]))[0].n;

    // Message reçu : enregistré seulement si la signature est valide (le webhook existant répond 401 sinon).
    assert.equal((await webhook(inbound(`wamid.IN1${tag}`, "Bonjour"), false)).status, 401, "sans signature : refus");
    assert.equal((await webhook(inbound(`wamid.IN1${tag}`, "Bonjour"), true, true)).status, 401, "mauvaise signature : refus");
    assert.equal(await countRows(), 0, "rien n'est enregistré sans signature valide");
    assert.equal((await webhook(inbound(`wamid.IN1${tag}`, "Bonjour"))).status, 200);
    assert.equal((await webhook(inbound(`wamid.IN1${tag}`, "Bonjour"))).status, 200, "relivraison par Meta");
    assert.equal(await countRows(), 1, "pas de doublon");
    const row = (await db.query("select * from ika_whatsapp_messages where phone_number = $1", [phone]))[0];
    assert.equal(row.direction, "inbound");
    assert.equal(row.status, "received");
    assert.equal(row.contact_name, "Awa Test");
    assert.equal(row.message_text, "Bonjour");

    // Statuts d'un message envoyé : sent -> delivered -> read, sans recul.
    await db.query("insert into ika_whatsapp_messages (wa_message_id, direction, phone_number, message_text, status) values ($1, 'outbound', $2, 'Salut', 'sent')", [`wamid.OUT${tag}`, phone]);
    const status = (value) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: [{ id: `wamid.OUT${tag}`, status: value, recipient_id: phone }] } }] }] });
    const current = async () => (await db.query("select status from ika_whatsapp_messages where wa_message_id = $1", [`wamid.OUT${tag}`]))[0].status;
    await webhook(status("delivered")); assert.equal(await current(), "delivered");
    await webhook(status("read")); assert.equal(await current(), "read");
    await webhook(status("delivered")); assert.equal(await current(), "read", "un statut ne recule pas");

    // Accès : anonyme 401, compte ordinaire 403, personnel autorisé 200.
    assert.equal((await call("/api/whatsapp/messages")).status, 401);
    assert.equal((await call("/api/whatsapp/send", { method: "POST", body: { phone, message: "x" } })).status, 401);
    await services.accounts.register({ name: "Test WhatsApp", email, password: "motdepasse1", acceptTerms: true });
    const login = await call("/api/auth/login", { method: "POST", body: { email, password: "motdepasse1" } });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await call("/api/whatsapp/messages", { cookie })).status, 403, "compte ordinaire refusé");
    assert.equal((await call("/api/whatsapp/send", { method: "POST", cookie, body: { phone, message: "x" } })).status, 403);
    await db.query("update ika_profiles set staff_role = 'ADMIN' where user_id = (select id from ika_users where email = $1)", [email]);
    const listed = await call(`/api/whatsapp/messages?phone=${phone}`, { cookie });
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get("cache-control"), "no-store");
    const { messages } = await listed.json();
    assert.deepEqual(messages.map((m) => m.direction), ["inbound", "outbound"]);
    assert.equal(messages[1].status, "read");
    const info = await (await call("/api/whatsapp/status", { cookie })).json();
    assert.equal(info.webhookPath, "/api/webhooks/whatsapp");
    assert.equal(info.configured, false, "jetons Meta absents dans ce test");
    assert.equal((await call("/api/whatsapp/send", { method: "POST", cookie, body: { phone, message: "x" } })).status, 503, "envoi impossible sans configuration");
    assert.equal((await call("/api/whatsapp/send", { method: "POST", cookie, body: { phone: "1", message: "x" } })).status, 400);
  } finally {
    if (server) { server.close(); await once(server, "close").catch(() => {}); }
    await db.query("delete from ika_whatsapp_messages where phone_number = $1", [phone]).catch(() => undefined);
    await db.query("delete from ika_users where email = $1", [email]).catch(() => undefined);
    await db.close();
  }
});
