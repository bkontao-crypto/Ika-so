// MFA à la connexion : contre un VRAI PostgreSQL et le VRAI serveur HTTP (ignoré sans DATABASE_URL_TEST).
// Vérifie surtout qu'aucun chemin de connexion ne donne accès sans le code, une fois la MFA activée.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";

test("MFA à la connexion : session en attente tant que le code n'est pas saisi, secours, abandon, désactivation", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const { createMfaSessions } = await import("../server/services/mfa-session.js");
  const { parseKey, totpCode } = await import("../server/lib/totp.js");
  const db = createDb(url);
  let server;
  const email = `mh${Date.now()}@test.invalid`;
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false" });
    const services = createServices({ db, config, sendSms: async () => ({}) });
    const mfa = { service: createMfa({ db, key: parseKey("d".repeat(64)) }), sessions: createMfaSessions({ db }) };
    const app = createApp({ services, config, health: () => db.query("select 1"), mfa });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { method = "GET", cookie, body } = {}) => fetch(base + path, {
      method,
      headers: { ...(method === "GET" ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), origin: base },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    const login = async () => {
      const res = await call("/api/auth/login", { method: "POST", body: { email, password: "motdepasse1" } });
      assert.equal(res.status, 200);
      return res.headers.get("set-cookie").split(";")[0];
    };
    const privateStatus = async (cookie) => (await call("/api/me/favorites", { cookie })).status;
    const pending = async (cookie) => (await (await call("/api/mfa/pending", { cookie })).json()).pending;

    await services.accounts.register({ name: "Test MFA HTTP", email, password: "motdepasse1", acceptTerms: true });

    // Sans MFA : connexion normale.
    const a = await login();
    assert.equal(await privateStatus(a), 200);
    const status = await call("/api/mfa/status", { cookie: a });
    assert.equal(status.headers.get("cache-control"), "no-store");
    assert.deepEqual(await status.json(), { enabled: false, pending: false, backupCodesLeft: 0 });
    assert.equal((await call("/api/mfa/status")).status, 401, "MFA : connexion requise");
    assert.equal((await call("/api/mfa/login", { method: "POST", body: { code: "123456" } })).status, 400, "rien à vérifier sans session");

    // Activation depuis la session A : elle reste connectée (elle vient de prouver qu'elle possède l'appli).
    const begun = await (await call("/api/mfa/begin", { method: "POST", cookie: a })).json();
    assert.equal(begun.secret.length, 32);
    const confirmed = await call("/api/mfa/confirm", { method: "POST", cookie: a, body: { code: totpCode(begun.secret) } });
    assert.equal(confirmed.status, 200);
    const { backupCodes } = await confirmed.json();
    assert.equal(backupCodes.length, 10);
    assert.equal(await privateStatus(a), 200);
    assert.equal(await pending(a), false);

    // Nouvelle connexion par mot de passe : session ouverte MAIS en attente, aucune donnée privée accessible.
    const b = await login();
    assert.equal(await privateStatus(b), 401, "session non vérifiée : pas connectée");
    assert.equal(await pending(b), true);
    assert.equal((await call("/api/mfa/status", { cookie: b })).status, 401, "les réglages MFA exigent une session vérifiée");
    assert.equal((await call("/api/mfa/begin", { method: "POST", cookie: b })).status, 401);
    assert.equal((await call("/api/mfa/disable", { method: "POST", cookie: b, body: { code: backupCodes[0] } })).status, 401, "on ne désactive pas la MFA sans être connecté");
    assert.equal(await pending(undefined), false, "visiteur anonyme : rien en attente");

    // Mauvais code : refus, toujours en attente. Bon code : session vérifiée.
    assert.equal((await call("/api/mfa/login", { method: "POST", cookie: b, body: { code: "abcdef" } })).status, 401);
    assert.equal(await privateStatus(b), 401);
    const ok = await call("/api/mfa/login", { method: "POST", cookie: b, body: { code: totpCode(begun.secret, Date.now() + 30_000) } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).method, "TOTP");
    assert.equal(await privateStatus(b), 200);
    assert.equal(await pending(b), false);

    // Code de secours : accepté une fois.
    const c = await login();
    assert.equal(await privateStatus(c), 401);
    const viaBackup = await call("/api/mfa/login", { method: "POST", cookie: c, body: { code: backupCodes[0] } });
    assert.equal(viaBackup.status, 200);
    assert.equal((await viaBackup.json()).method, "BACKUP");
    assert.equal(await privateStatus(c), 200);
    const d = await login();
    assert.equal((await call("/api/mfa/login", { method: "POST", cookie: d, body: { code: backupCodes[0] } })).status, 401, "code de secours déjà utilisé");

    // Abandon : la session en attente est fermée.
    const cancel = await call("/api/mfa/cancel", { method: "POST", cookie: d });
    assert.equal(cancel.status, 200);
    assert.equal(await pending(d), false, "session fermée");
    assert.equal((await db.query("select count(*)::int as n from ika_sessions s join ika_users u on u.id = s.user_id where u.email = $1", [email]))[0].n, 3, "sessions A, B, C restantes");

    // Désactivation depuis une session vérifiée : les connexions suivantes redeviennent directes.
    assert.equal((await call("/api/mfa/disable", { method: "POST", cookie: c, body: { code: backupCodes[1] } })).status, 200);
    const e = await login();
    assert.equal(await privateStatus(e), 200);
    assert.equal(await pending(e), false);
  } finally {
    if (server) { server.close(); await once(server, "close").catch(() => {}); }
    await db.query("delete from ika_users where email = $1", [email]).catch(() => undefined);
    await db.close();
  }
});
