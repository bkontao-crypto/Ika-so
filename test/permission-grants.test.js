// BUG-004 : attribution individuelle de permissions (server/services/permission-grants.js) contre un VRAI PostgreSQL.
// Ignoré tant que DATABASE_URL_TEST est absent ; la base doit avoir « test » dans son nom.
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_PERMISSIONS, NON_DELEGABLE, assertCanGrant } from "../server/lib/permissions.js";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { await p; return "ok"; } catch (e) { return `${e.status ?? "err"}:${e.message}`; } };

async function scene() {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, `Base « ${name} » refusée : DATABASE_URL_TEST doit viser une base dont le nom contient « test ».`);
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { createPermissionGrants } = await import("../server/services/permission-grants.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const grants = createPermissionGrants({ db, accounts });
  const tag = `tgrant${Date.now()}`;
  const ids = { boss: `${tag}-boss`, boss2: `${tag}-boss2`, adm: `${tag}-adm`, mod: `${tag}-mod`, usr: `${tag}-usr` };
  const roles = { boss: "SUPERADMIN", boss2: "SUPERADMIN", adm: "ADMIN", mod: "MODERATOR", usr: "USER" };
  for (const [k, id] of Object.entries(ids)) {
    await db.query("insert into ika_users (id, email, name, password_hash) values ($1, $2, $3, 'x')", [id, `${id}@test.invalid`, `Nom ${k}`]);
    await db.query("insert into ika_profiles (user_id, staff_role) values ($1, $2)", [id, roles[k]]);
  }
  const cleanup = async () => { for (const id of Object.values(ids)) await db.query("delete from ika_users where id = $1", [id]); await db.close(); };
  return { db, accounts, grants, ids, cleanup };
}

test("attribution : seul le Superadmin peut lister, accorder ou retirer", { skip }, async () => {
  const { grants, ids, cleanup } = await scene();
  try {
    for (const who of ["adm", "mod", "usr"]) {
      assert.match(await outcome(grants.list(ids[who])), /^403:/, `list ${who}`);
      assert.match(await outcome(grants.grant(ids[who], { userId: ids.mod, permission: "contenu.gerer", reason: "x" })), /^403:/, `grant ${who}`);
      assert.match(await outcome(grants.revoke(ids[who], { userId: ids.mod, permission: "contenu.gerer" })), /^403:/, `revoke ${who}`);
    }
  } finally { await cleanup(); }
});

test("attribution : accorder offres.tarifs à un administrateur lui ouvre le droit, retirer le lui reprend", { skip }, async () => {
  const { db, accounts, grants, ids, cleanup } = await scene();
  try {
    assert.match(await outcome(accounts.requirePermission(ids.adm, "offres.tarifs")), /^403:/, "refusé avant l'octroi");
    assert.equal(await outcome(grants.grant(ids.boss, { userId: ids.adm, permission: "offres.tarifs", reason: "Gestion des tarifs pendant l'absence" })), "ok");
    assert.equal(await outcome(accounts.requirePermission(ids.adm, "offres.tarifs")), "ok", "ouvert après l'octroi");
    assert.ok((await accounts.me(ids.adm)).permissions.includes("offres.tarifs"), "visible dans la session");

    const list = await grants.list(ids.boss);
    const mine = list.grants.find((g) => g.userId === ids.adm && g.permission === "offres.tarifs");
    assert.ok(mine, "présent dans la liste");
    assert.equal(mine.grantedBy, ids.boss);
    assert.equal(mine.expiresAt, null);
    const grantable = list.grantable.map((p) => p.code);
    assert.ok(grantable.includes("offres.tarifs"));
    for (const code of NON_DELEGABLE) assert.ok(!grantable.includes(code), `${code} ne doit pas être proposée`);

    assert.equal(await outcome(grants.revoke(ids.boss, { userId: ids.adm, permission: "offres.tarifs" })), "ok");
    assert.match(await outcome(accounts.requirePermission(ids.adm, "offres.tarifs")), /^403:/, "repris après le retrait");
    assert.equal(await outcome(grants.revoke(ids.boss, { userId: ids.adm, permission: "offres.tarifs" })), "404:Aucune attribution à retirer.");

    const audit = await db.query("select action, note from ika_audit where actor_id = $1 and action like 'PERMISSION_%' order by created_at", [ids.boss]);
    assert.deepEqual(audit.map((a) => a.action), ["PERMISSION_GRANT", "PERMISSION_REVOKE"]);
    assert.match(audit[0].note, new RegExp(`offres.tarifs ${ids.adm} : Gestion des tarifs`));
  } finally { await db.query("delete from ika_audit where actor_id = $1", [ids.boss]); await cleanup(); }
});

test("attribution : refus des octrois interdits ou mal formés", { skip }, async () => {
  const { db, grants, ids, cleanup } = await scene();
  try {
    const ok = { userId: ids.adm, permission: "offres.tarifs", reason: "Motif" };
    const g = (patch) => outcome(grants.grant(ids.boss, { ...ok, ...patch }));
    assert.equal(await g({ reason: "   " }), "400:Motif obligatoire.");
    assert.equal(await g({ reason: undefined }), "400:Motif obligatoire.");
    assert.equal(await g({ permission: "nimporte.quoi" }), "400:Permission inconnue.");
    assert.equal(await g({ permission: "owner.stats" }), "400:Permission non délégable.");
    assert.equal(await g({ permission: "permissions.grant" }), "400:Permission non délégable.");
    assert.equal(await g({ userId: ids.usr }), "400:La cible doit être un administrateur ou un modérateur.");
    assert.equal(await g({ userId: ids.boss2 }), "400:La cible doit être un administrateur ou un modérateur.");
    assert.equal(await g({ userId: "inconnu" }), "404:Compte introuvable.");
    assert.equal(await g({ userId: ids.boss }), "403:Nul ne peut s'accorder une permission.");
    assert.equal(await g({ userId: ids.adm, permission: "contenu.gerer" }), "400:Son rôle lui donne déjà cette permission.");
    for (const days of [0, -1, 366, 1.5, "abc"]) assert.match(await g({ days }), /^400:Durée invalide/, `days=${days}`);
    assert.equal((await db.query("select count(*)::int as n from ika_user_permissions where user_id = any($1)", [Object.values(ids)]))[0].n, 0, "rien n'a été enregistré");
  } finally { await cleanup(); }
});

test("attribution : durée limitée, puis renouvellement sans échéance", { skip }, async () => {
  const { db, grants, ids, cleanup } = await scene();
  try {
    const expiry = async () => (await db.query("select expires_at, extract(epoch from (expires_at - now())) as secs from ika_user_permissions where user_id = $1 and permission_code = 'contenu.gerer'", [ids.mod]))[0];
    assert.equal(await outcome(grants.grant(ids.boss, { userId: ids.mod, permission: "contenu.gerer", reason: "Remplacement", days: 1 })), "ok");
    const first = await expiry();
    assert.ok(first.secs > 23 * 3600 && first.secs < 25 * 3600, `échéance dans environ 1 jour (${first.secs} s)`);
    assert.equal(await outcome(grants.grant(ids.boss, { userId: ids.mod, permission: "contenu.gerer", reason: "Prolongé sans limite" })), "ok");
    assert.equal((await expiry()).expires_at, null, "le renouvellement remplace l'échéance");
    assert.equal((await db.query("select count(*)::int as n from ika_user_permissions where user_id = $1", [ids.mod]))[0].n, 1, "une seule ligne (pas de doublon)");
  } finally { await db.query("delete from ika_audit where actor_id = $1", [ids.boss]); await cleanup(); }
});

test("session : permissions effectives selon le rôle ; vide pour un compte ordinaire", { skip }, async () => {
  const { accounts, ids, cleanup } = await scene();
  try {
    assert.deepEqual((await accounts.me(ids.usr)).permissions, []);
    const mod = (await accounts.me(ids.mod)).permissions;
    assert.ok(mod.includes("moderation.review") && !mod.includes("contenu.gerer"));
    const adm = (await accounts.me(ids.adm)).permissions;
    assert.ok(adm.includes("contenu.gerer") && !adm.includes("offres.tarifs") && !adm.includes("owner.stats"));
    assert.deepEqual([...(await accounts.me(ids.boss)).permissions].sort(), [...ALL_PERMISSIONS].sort());
  } finally { await cleanup(); }
});

// Sans base : les erreurs de règle portent un vrai code HTTP (avant : erreurs sans statut → réponse 500).
test("assertCanGrant : refus = 403, requête invalide = 400", () => {
  const base = { actorId: "s", actorRole: "SUPERADMIN", targetId: "a", targetRole: "ADMIN", permission: "offres.tarifs", reason: "ok" };
  const status = (patch) => { try { assertCanGrant({ ...base, ...patch }); return 200; } catch (e) { return e.status; } };
  assert.equal(status({}), 200);
  assert.equal(status({ actorRole: "ADMIN" }), 403);
  assert.equal(status({ targetId: "s" }), 403);
  assert.equal(status({ permission: "x.y" }), 400);
  assert.equal(status({ permission: "owner.stats" }), 400);
  assert.equal(status({ targetRole: "USER" }), 400);
  assert.equal(status({ reason: "" }), 400);
});
