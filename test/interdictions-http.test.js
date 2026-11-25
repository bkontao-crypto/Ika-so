// Interdictions d'accès (plan rôles/permissions) : contre un VRAI PostgreSQL et le VRAI serveur HTTP (ignoré sans DATABASE_URL_TEST).
// Un utilisateur ordinaire n'appelle aucune API d'administration ; un Admin ne s'octroie aucune permission et ne crée aucun Superadmin.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";

test("interdictions : utilisateur ordinaire et Admin face aux API d'administration", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const { createMfaSessions } = await import("../server/services/mfa-session.js");
  const { parseKey } = await import("../server/lib/totp.js");
  const db = createDb(url);
  let server;
  const tag = `ih${Date.now()}`;
  const ids = [];
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false" });
    const services = createServices({ db, config, sendSms: async () => ({}) });
    const mfa = { service: createMfa({ db, key: parseKey("f".repeat(64)) }), sessions: createMfaSessions({ db }) };
    const app = createApp({ services, config, health: () => db.query("select 1"), mfa });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { method = "GET", cookie, body } = {}) => fetch(base + path, {
      method,
      headers: { ...(method === "GET" ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), origin: base },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    const make = async (label, role) => {
      const email = `${tag}${label}@test.invalid`;
      await services.accounts.register({ name: `Test ${label}`, email, password: "motdepasse1", acceptTerms: true });
      const id = (await db.query("select id from ika_users where email = $1", [email]))[0].id;
      await services.accounts.ensureProfile(id);
      if (role !== "USER") await db.query("update ika_profiles set staff_role = $2 where user_id = $1", [id, role]);
      ids.push(id);
      const res = await call("/api/auth/login", { method: "POST", body: { email, password: "motdepasse1" } });
      assert.equal(res.status, 200);
      return { id, cookie: res.headers.get("set-cookie").split(";")[0] };
    };
    const user = await make("usr", "USER");
    const admin = await make("adm", "ADMIN");
    const target = await make("tgt", "USER");

    const forbidden = async (label, path, opts) => assert.equal((await call(path, opts)).status, 403, label);
    for (const [who, a] of [["utilisateur", user], ["admin", admin]]) {
      await forbidden(`${who} : promouvoir un Superadmin`, `/api/staff/accounts/${target.id}/role`, { method: "POST", cookie: a.cookie, body: { role: "SUPERADMIN" } });
      await forbidden(`${who} : s'octroyer une permission`, "/api/staff/permissions/grant", { method: "POST", cookie: a.cookie, body: { userId: a.id, permission: "permissions.grant", reason: "test", days: 1 } });
      await forbidden(`${who} : régler la MFA obligatoire`, "/api/mfa/required", { method: "PUT", cookie: a.cookie, body: { required: true } });
      await forbidden(`${who} : voir les emplacements Superadmin`, "/api/mfa/superadmins", { cookie: a.cookie });
    }
    await forbidden("utilisateur : API d'administration", "/api/staff/permissions", { cookie: user.cookie });
    assert.equal((await db.query("select staff_role from ika_profiles where user_id = $1", [target.id]))[0].staff_role, "USER");
    assert.equal((await db.query("select count(*)::int n from ika_user_permissions where user_id = any($1::text[])", [ids]))[0].n, 0);
  } finally {
    if (ids.length) await db.query("update ika_profiles set staff_role = 'USER' where user_id = any($1::text[])", [ids]).catch(() => {});
    server?.close();
  }
});
