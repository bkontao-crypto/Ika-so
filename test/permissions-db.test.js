// BUG-004 : les permissions nommées contre un VRAI PostgreSQL (migrations 025 et 065, requirePermission, retour arrière).
// Ignoré tant que DATABASE_URL_TEST est absent ; la base doit avoir « test » dans son nom (même garde-fou que integration-pg).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ROLE_PERMISSIONS, ALL_PERMISSIONS, NON_DELEGABLE } from "../server/lib/permissions.js";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";

function guard() {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, `Base « ${name} » refusée : DATABASE_URL_TEST doit viser une base dont le nom contient « test ».`);
}
async function open() {
  guard();
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const db = createDb(url);
  await migrate(db, () => {});
  return { db, migrate };
}
const sorted = (a) => [...a].sort();
const outcome = async (p) => { try { await p; return "ok"; } catch (e) { return `${e.status ?? "err"}:${e.message}`; } };

test("PostgreSQL : la base et server/lib/permissions.js sont strictement concordants", { skip }, async () => {
  const { db } = await open();
  try {
    const perms = await db.query("select code, delegable from ika_permissions");
    assert.deepEqual(sorted(perms.map((p) => p.code)), sorted(ALL_PERMISSIONS), "mêmes codes en base et dans le code");
    assert.deepEqual(sorted(perms.filter((p) => !p.delegable).map((p) => p.code)), sorted(NON_DELEGABLE), "mêmes permissions non délégables");
    for (const role of ["MODERATOR", "ADMIN", "SUPERADMIN"]) {
      const rows = await db.query("select permission_code from ika_role_permissions where role = $1", [role]);
      assert.deepEqual(sorted(rows.map((r) => r.permission_code)), sorted(ROLE_PERMISSIONS[role]), `droits de ${role}`);
    }
  } finally { await db.close(); }
});

test("PostgreSQL : requirePermission avec de vraies lignes (accordée, expirée, non délégable, rôle ordinaire)", { skip }, async () => {
  const { db } = await open();
  const { createAccounts } = await import("../server/services/accounts.js");
  const acc = createAccounts({ db, config: {} });
  const tag = `tperm${Date.now()}`;
  const ids = { mod: `${tag}-mod`, adm: `${tag}-adm`, usr: `${tag}-usr`, boss: `${tag}-boss` };
  try {
    for (const [k, id] of Object.entries(ids)) {
      await db.query("insert into ika_users (id, email, password_hash) values ($1, $2, 'x')", [id, `${id}@test.invalid`]);
      const role = { mod: "MODERATOR", adm: "ADMIN", usr: "USER", boss: "SUPERADMIN" }[k];
      await db.query("insert into ika_profiles (user_id, staff_role) values ($1, $2)", [id, role]);
    }
    const grant = (userId, code, expiresSql = "null") =>
      db.query(`insert into ika_user_permissions (user_id, permission_code, granted_by, reason, expires_at) values ($1, $2, $3, 'test', ${expiresSql})`, [userId, code, ids.boss]);

    // droits par rôle, sans aucune permission accordée
    assert.equal(await outcome(acc.requirePermission(ids.adm, "contenu.gerer")), "ok");
    assert.equal(await outcome(acc.requirePermission(ids.mod, "contenu.gerer")), "403:Réservé aux administrateurs.");
    assert.equal(await outcome(acc.requirePermission(ids.adm, "offres.tarifs")), "403:Réservé aux administrateurs.");
    assert.equal(await outcome(acc.requirePermission(ids.boss, "offres.tarifs")), "ok");
    assert.equal(await outcome(acc.requirePermission(ids.usr, "moderation.review")), "403:Réservé à la modération.");

    // permission accordée à un administrateur précis
    await grant(ids.adm, "offres.tarifs");
    assert.equal(await outcome(acc.requirePermission(ids.adm, "offres.tarifs")), "ok");
    // accordée à un modérateur
    await grant(ids.mod, "contenu.gerer");
    assert.equal(await outcome(acc.requirePermission(ids.mod, "contenu.gerer")), "ok");
    // expirée : refusée par la requête SQL réelle
    await db.query("delete from ika_user_permissions where user_id = $1", [ids.mod]);
    await grant(ids.mod, "contenu.gerer", "now() - interval '1 hour'");
    assert.equal(await outcome(acc.requirePermission(ids.mod, "contenu.gerer")), "403:Réservé aux administrateurs.");
    // non expirée (dans le futur) : acceptée
    await db.query("delete from ika_user_permissions where user_id = $1", [ids.mod]);
    await grant(ids.mod, "contenu.gerer", "now() + interval '1 hour'");
    assert.equal(await outcome(acc.requirePermission(ids.mod, "contenu.gerer")), "ok");

    // la base refuse d'accorder une permission non délégable (déclencheur de la migration 025)
    for (const code of ["owner.stats", "permissions.grant"]) {
      assert.match(await outcome(grant(ids.adm, code)), /non délégable/, code);
    }
    // un compte ordinaire ne reçoit rien d'une ligne de permission
    await grant(ids.usr, "moderation.review");
    assert.equal(await outcome(acc.requirePermission(ids.usr, "moderation.review")), "403:Réservé à la modération.");
  } finally {
    for (const id of Object.values(ids)) await db.query("delete from ika_users where id = $1", [id]);
    await db.close();
  }
});

test("PostgreSQL : la migration 065 est relançable sans effet, et son retour arrière puis sa réapplication restaurent l'état", { skip }, async () => {
  const { db, migrate } = await open();
  try {
    const NEW = ["contenu.gerer", "offres.tarifs", "owner.stats"];
    const snapshot = async () => ({
      perms: (await db.query("select code, delegable from ika_permissions where code = any($1) order by code", [NEW])),
      roles: (await db.query("select role, permission_code from ika_role_permissions where permission_code = any($1) order by role, permission_code", [NEW])),
    });
    const before = await snapshot();
    assert.equal(before.perms.length, 3);
    assert.equal(before.roles.length, 4);

    // relançable : rejouer le fichier tel quel ne change rien
    const up = await readFile(new URL("../migrations/065_permissions_contenu_offres_owner.sql", import.meta.url), "utf8");
    await db.query(up);
    assert.deepEqual(await snapshot(), before);

    // retour arrière : les 3 codes disparaissent, la migration est « à refaire », rien d'autre n'est touché
    const [{ n: otherBefore }] = await db.query("select count(*)::int as n from ika_permissions where code <> all($1)", [NEW]);
    const down = await readFile(new URL("../scripts/rollback/065_permissions_contenu_offres_owner_down.sql", import.meta.url), "utf8");
    await db.query(down);
    assert.equal((await snapshot()).perms.length, 0);
    const [{ n: otherAfter }] = await db.query("select count(*)::int as n from ika_permissions where code <> all($1)", [NEW]);
    assert.equal(otherAfter, otherBefore, "les permissions de la migration 025 sont intactes");

    // réapplication : la migration redevient « à appliquer » et l'état initial est restauré
    assert.deepEqual(await migrate(db, () => {}), ["065_permissions_contenu_offres_owner.sql"]);
    assert.deepEqual(await snapshot(), before);
  } finally { await db.close(); }
});
