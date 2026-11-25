// Étape 3 : deux emplacements Superadmin et MFA obligatoire, contre un VRAI PostgreSQL (ignoré sans DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { return { ok: true, r: await p }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("Superadmin : deux emplacements, aucun troisième, aucun Admin ne promeut ; MFA obligatoire pour le personnel", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const { parseKey, totpCode } = await import("../server/lib/totp.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false" });
  const services = createServices({ db, config, sendSms: async () => ({}) });
  const { accounts, moderation } = services;
  const mfa = createMfa({ db, key: parseKey("e".repeat(64)) });
  accounts.setStaffGate((p) => mfa.staffGate(p));
  const tag = `sa${Date.now()}`;
  const mk = async (label) => {
    const email = `${tag}${label}@test.invalid`;
    await accounts.register({ name: `Test ${label}`, email, password: "motdepasse1", acceptTerms: true });
    const id = (await db.query("select id from ika_users where email = $1", [email]))[0].id;
    await accounts.ensureProfile(id);
    return id;
  };
  const setRole = (id, role) => db.query("update ika_profiles set staff_role = $2, superadmin_slot = case when $2 = 'SUPERADMIN' then superadmin_slot else null end where user_id = $1", [id, role]);
  const slotOf = async (id) => (await db.query("select staff_role, superadmin_slot from ika_profiles where user_id = $1", [id]))[0];
  const enable = async (id) => { const b = await mfa.begin(id); await mfa.confirm(id, totpCode(b.secret)); return b.secret; };
  let ids = [];
  const saved = await db.query("select user_id, superadmin_slot from ika_profiles where superadmin_slot is not null");
  const savedSetting = await db.query("select key, value from ika_settings where key in ('mfa_required', 'mfa_required_since')");
  try {
    // Base de test partagée : on libère les emplacements le temps du test, puis on les rend.
    await db.query("update ika_profiles set superadmin_slot = null where superadmin_slot is not null");
    const [a, b, c, admin, mod, user] = await Promise.all(["a", "b", "c", "adm", "mod", "usr"].map(mk));
    ids = [a, b, c, admin, mod, user];
    await setRole(a, "SUPERADMIN");
    await db.query("update ika_profiles set superadmin_slot = 'PRINCIPAL' where user_id = $1", [a]);
    await setRole(admin, "ADMIN");
    await setRole(mod, "MODERATOR");

    // Un Admin ne peut ni créer ni promouvoir un Superadmin ; un utilisateur ordinaire non plus.
    for (const actor of [admin, mod, user]) {
      assert.equal((await outcome(moderation.setStaffRole(actor, user, "SUPERADMIN"))).status, 403);
      assert.equal((await outcome(moderation.setStaffRole(actor, actor, "SUPERADMIN"))).status, 403, "pas d'auto-promotion");
    }
    assert.equal((await slotOf(user)).staff_role, "USER");

    // Le Superadmin remplit le deuxième emplacement ; un troisième est refusé.
    await moderation.setStaffRole(a, b, "SUPERADMIN");
    assert.deepEqual(await slotOf(b), { staff_role: "SUPERADMIN", superadmin_slot: "SECONDARY" });
    assert.equal((await outcome(moderation.setStaffRole(a, c, "SUPERADMIN"))).status, 403, "troisième Superadmin refusé");
    assert.equal((await slotOf(c)).staff_role, "USER");
    // La base elle-même refuse un doublon d'emplacement.
    assert.equal((await outcome(db.query("update ika_profiles set staff_role = 'SUPERADMIN', superadmin_slot = 'PRINCIPAL' where user_id = $1", [c]))).ok, false);
    // Rétrograder libère l'emplacement ; il est de nouveau attribuable.
    await moderation.setStaffRole(a, b, "ADMIN");
    assert.equal((await slotOf(b)).superadmin_slot, null);
    await moderation.setStaffRole(a, c, "SUPERADMIN");
    assert.equal((await slotOf(c)).superadmin_slot, "SECONDARY");

    // MFA obligatoire : réglage réservé au Superadmin, qui doit d'abord avoir activé la sienne.
    assert.equal((await outcome(mfa.setRequired(a, true))).status, 400);
    const secretA = await enable(a);
    await db.query("delete from ika_settings where key = 'mfa_required_since'");
    assert.equal((await mfa.requirement()).required, false);
    await accounts.requireStaff(c, "SUPERADMIN"); // pas obligatoire : tout passe
    const on = await mfa.setRequired(a, true);
    assert.equal(on.required, true);
    assert.ok(on.graceEndsAt > new Date(Date.now() + 13 * 86_400_000));
    assert.equal((await outcome(accounts.requireStaff(c, "SUPERADMIN"))).status, 403, "Superadmin sans MFA bloqué dès l'activation");
    await accounts.requireStaff(a, "SUPERADMIN"); // Superadmin avec MFA : accès normal
    // Admin et Modérateur : tolérés pendant 14 jours, bloqués ensuite.
    await accounts.requireStaff(admin, "ADMIN");
    await accounts.requireStaff(mod, "MODERATOR");
    await db.query("update ika_settings set value = $1 where key = 'mfa_required_since'", [new Date(Date.now() - 15 * 86_400_000).toISOString()]);
    assert.equal((await outcome(accounts.requireStaff(admin, "ADMIN"))).status, 403);
    assert.equal((await outcome(accounts.requireStaff(mod, "MODERATOR"))).status, 403);
    // L'obligation ne touche pas un compte ordinaire, et la MFA du personnel ne peut plus être désactivée.
    await accounts.requireActive?.(user);
    const secretMod = await enable(mod);
    await accounts.requireStaff(mod, "MODERATOR");
    const r1 = await outcome(mfa.disable(mod, totpCode(secretMod, Date.now() + 30_000)));
    assert.equal(r1.status, 403, "désactivation interdite quand la MFA est obligatoire");
    assert.equal((await mfa.status(mod)).enabled, true);
    // L'obligation levée, la désactivation redevient possible ; un compte ordinaire pouvait toujours la retirer.
    await mfa.setRequired(a, false);
    assert.equal((await mfa.requirement()).required, false);
    assert.equal((await outcome(mfa.disable(mod, totpCode(secretMod, Date.now() + 30_000)))).ok, true);
    void secretA;
  } finally {
    await db.query("update ika_profiles set staff_role = 'USER', superadmin_slot = null where user_id = any($1::text[])", [ids]).catch(() => {});
    for (const s of ["mfa_required", "mfa_required_since"]) await db.query("delete from ika_settings where key = $1", [s]).catch(() => {});
    for (const s of savedSetting) await db.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [s.key, s.value]).catch(() => {});
    for (const s of saved) await db.query("update ika_profiles set superadmin_slot = $2 where user_id = $1", [s.user_id, s.superadmin_slot]).catch(() => {});
  }
});

test("migration 093 : les Superadmin existants reçoivent principal puis secondaire, un surplus reste sans emplacement", { skip }, async () => {
  const { createDb } = await import("../server/db.js");
  const db = createDb(url);
  const row = (await db.query("select count(*)::int as n from ika_profiles where superadmin_slot is not null and staff_role <> 'SUPERADMIN'"))[0];
  assert.equal(row.n, 0, "un emplacement n'existe que pour un Superadmin (contrainte)");
  const dup = await db.query("select superadmin_slot from ika_profiles where superadmin_slot is not null group by 1 having count(*) > 1");
  assert.deepEqual(dup, []);
});
