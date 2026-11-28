// Centre des activations : réservé au Superadmin, lecture sans écriture, bascules à effet réel et journalisées.
// Base dédiée : les réglages sont globaux et ne doivent pas gêner les tests lancés en parallèle.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test d'intégration PostgreSQL ignoré.";

test("Centre des activations : droits, lecture sans écriture, effets, garde-fous, historique", { skip }, async () => {
  assert.match(new URL(url).pathname, /test/i);
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const name = `ika_test_activations_${process.pid}`;
  const admin = createDb(url);
  await admin.query(`create database ${name}`);
  const target = new URL(url); target.pathname = `/${name}`;
  const db = createDb(target.href);
  const servers = [];
  try {
    await migrate(db, () => {});
    const start = async (env) => {
      const config = getConfig({ NODE_ENV: "test", DATABASE_URL: target.href, BOOTSTRAP_ADMIN: "true", ...env });
      const server = createApp({ services: createServices({ db, config, sendSms: async () => ({}) }), config, health: () => db.query("select 1") }).listen(0, "127.0.0.1");
      servers.push(server);
      await once(server, "listening");
      const base = `http://127.0.0.1:${server.address().port}/api`;
      return async (cookie, path, method = "GET", body) => {
        const r = await fetch(base + path, { method, headers: { cookie, "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile", ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
        return { status: r.status, body: (r.headers.get("content-type") ?? "").includes("json") ? await r.json() : null, cookie: r.headers.get("set-cookie")?.split(";")[0] };
      };
    };
    const call = await start({});
    const register = async (who) => {
      const r = await call("", "/auth/register", "POST", { name: `Essai ${who}`, email: `${who}@test.local`, password: "MotDePasse-Test-1", acceptTerms: true, dataConsent: "essential" });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.cookie;
    };
    const boss = await register("patron");
    const user = await register("membre");
    const state = async () => db.query("select 's' as t, key, value::text from ika_settings union all select 'a', key, value::text from ika_superadmin_settings order by 1, 2");
    const get = async () => (await call(boss, "/staff/owner/activations")).body;
    const find = (d, key) => d.switches.find((x) => x.key === key);
    const flip = (key, enabled, c = call) => c(boss, `/staff/owner/activations/${key}`, "PUT", { enabled });

    // Droits : ni anonyme ni membre ni ADMIN.
    assert.equal((await call("", "/staff/owner/activations")).status, 401);
    assert.equal((await call(user, "/staff/owner/activations")).status, 403);
    assert.equal((await call(user, "/staff/owner/activations/crm", "PUT", { enabled: false })).status, 403);
    await db.query("update ika_profiles set staff_role = 'ADMIN' where user_id = (select id from ika_users where email = 'membre@test.local')");
    assert.equal((await call(user, "/staff/owner/activations")).status, 403);
    assert.equal((await call(user, "/staff/owner/activations/crm", "PUT", { enabled: false })).status, 403);

    // La lecture n'écrit rien.
    const before = await state();
    const first = await get();
    assert.deepEqual(await state(), before);
    assert.deepEqual(first.history, []);
    for (const [key, enabled] of Object.entries({ crm: true, premium: true, discover: true, alerts: true, videoLinks: false, advertiserApplication: true, onlinePayment: false, starBadge: false, whatsappDecision: false, analytics: true, securityLog: true, preferences: false, comments: true, reviews: true, messaging: true })) {
      assert.equal(find(first, key).enabled, enabled, key);
    }

    // Garde-fous : demande invalide, clé inconnue, allumage sans configuration.
    assert.equal((await flip("inconnu", true)).status, 404);
    assert.equal((await flip("crm", "oui")).status, 400);
    for (const key of ["onlinePayment", "whatsappDecision"]) assert.equal((await flip(key, true)).status, 409, key);
    assert.deepEqual(await state(), before);

    // Demander l'état déjà en place ne change et ne journalise rien.
    assert.equal((await flip("crm", true)).body.changed, false);
    assert.deepEqual(await state(), before);

    // Chaque interrupteur disponible : aller, vérification, retour.
    for (const key of ["crm", "premium", "discover", "alerts", "videoLinks", "advertiserApplication", "starBadge", "analytics", "securityLog", "preferences", "comments", "reviews", "messaging"]) {
      const initial = find(first, key).enabled;
      for (const value of [!initial, initial]) {
        const r = await flip(key, value);
        assert.equal(r.status, 200, `${key} ${value} ${JSON.stringify(r.body)}`);
        assert.equal(find(await get(), key).enabled, value, `${key} relu`);
      }
    }
    // Effets réels sur les routes concernées, immédiats.
    await flip("crm", false); await flip("discover", false);
    assert.equal((await call(boss, "/me/crm/stats")).status, 403);
    assert.deepEqual((await call(boss, "/discover")).body.items, []);
    const events = async () => { await new Promise((r) => setTimeout(r, 400)); return (await db.query("select count(*)::int as n from ika_analytics_events"))[0].n; };
    await call("", "/e", "POST", { pagePath: "/" }); // remplit la mémoire courte de la collecte
    const counted = await events();
    await flip("analytics", false);
    await call("", "/e", "POST", { pagePath: "/" });
    assert.equal(await events(), counted, "coupure immédiate malgré la mémoire courte");

    // Les autres réglages sont conservés.
    await call(boss, "/staff/superadmin-settings/main", "PUT", { value: { welcome_title: "Conservé", modules: { crm: false } } });
    await flip("premium", false);
    const main = (await call(boss, "/staff/superadmin-settings/main")).body.value;
    assert.equal(main.welcome_title, "Conservé");
    assert.deepEqual(main.modules, { crm: false, premium: false });

    // Historique : auteur, fonction, état ; le plus récent d'abord.
    const history = (await get()).history;
    assert.equal(history[0].key, "premium");
    assert.equal(history[0].enabled, false);
    assert.equal(history[0].by, "Essai patron");
    assert.equal((await db.query("select count(*)::int as n from ika_moderation_audit where action = 'ACTIVATION_CHANGE'"))[0].n, 30);

    // Variable d'hébergeur prioritaire ; fournisseur présent → le paiement peut s'ouvrir ; aucune clé exposée.
    const other = await start({ ANALYTICS_ENABLED: "false", PAYMENT_PROVIDER: "fake", PAYMENT_WEBHOOK_SECRET: "secret-a-ne-pas-montrer" });
    const seen = (await other(boss, "/staff/owner/activations")).body;
    assert.equal(find(seen, "analytics").enabled, false);
    assert.match(find(seen, "analytics").blocked, /ANALYTICS_ENABLED/);
    assert.equal((await flip("analytics", true, other)).status, 409);
    assert.equal((await flip("onlinePayment", true, other)).status, 200);
    assert.equal((await flip("onlinePayment", false, other)).status, 200);
    assert.ok(!JSON.stringify(seen).includes("secret-a-ne-pas-montrer"));
  } finally {
    for (const s of servers) { s.closeAllConnections?.(); s.close(); }
    await db.close();
    // Pas de « with (force) » : couper une connexion en cours de fermeture lève une erreur asynchrone.
    for (let essai = 0; ; essai += 1) {
      try { await admin.query(`drop database if exists ${name}`); break; } catch (error) {
        if (essai >= 50) throw error;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    await admin.close();
  }
});
