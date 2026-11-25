// MFA : service contre un VRAI PostgreSQL (ignoré sans DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { const r = await p; return { ok: true, r }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("MFA : activation, rejeu refusé, codes de secours, blocage après 5 échecs, renouvellement, désactivation", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const { parseKey, totpCode } = await import("../server/lib/totp.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const mfa = createMfa({ db, key: parseKey("c".repeat(64)) });
  const tag = `mf${Date.now()}`;
  const email = `${tag}@test.invalid`;
  try {
    await accounts.register({ name: "Test MFA", email, password: "motdepasse1", acceptTerms: true });
    const userId = (await db.query("select id from ika_users where email = $1", [email]))[0].id;

    assert.deepEqual(await mfa.status(userId), { enabled: false, pending: false, backupCodesLeft: 0 });
    assert.equal((await outcome(mfa.verify(userId, "123456"))).status, 401, "sans MFA activée, rien n'est accepté");

    // Activation : le secret est chiffré en base, inactif tant qu'un code valide n'est pas saisi.
    const begun = await mfa.begin(userId);
    assert.equal(begun.secret.length, 32);
    assert.match(begun.otpauthUri, /^otpauth:\/\/totp\//);
    const stored = (await db.query("select secret_enc from ika_mfa_secrets where user_id = $1", [userId]))[0].secret_enc;
    assert.ok(!stored.includes(begun.secret), "secret jamais en clair");
    assert.deepEqual(await mfa.status(userId), { enabled: false, pending: true, backupCodesLeft: 0 });
    assert.equal((await outcome(mfa.verify(userId, totpCode(begun.secret)))).status, 401, "un secret non confirmé ne valide aucune connexion");
    assert.equal((await outcome(mfa.confirm(userId, "abcdef"))).status, 400, "mauvais code refusé");
    const { backupCodes } = await mfa.confirm(userId, totpCode(begun.secret));
    assert.equal(backupCodes.length, 10);
    assert.deepEqual(await mfa.status(userId), { enabled: true, pending: false, backupCodesLeft: 10 });
    const hashes = (await db.query("select code_hash from ika_mfa_backup_codes where user_id = $1", [userId])).map((r) => r.code_hash);
    assert.ok(backupCodes.every((c) => !hashes.includes(c)), "codes de secours jamais en clair");
    assert.equal((await outcome(mfa.begin(userId))).status, 409, "déjà activée");

    // Un code ne sert qu'une fois ; le pas suivant est accepté.
    const used = totpCode(begun.secret);
    assert.equal((await outcome(mfa.verify(userId, used))).status, 401, "rejeu du code d'activation refusé");
    const next = await mfa.verify(userId, totpCode(begun.secret, Date.now() + 30_000));
    assert.equal(next.method, "TOTP");

    // Code de secours : accepté une fois.
    const viaBackup = await mfa.verify(userId, backupCodes[0].toUpperCase());
    assert.equal(viaBackup.method, "BACKUP");
    assert.equal(viaBackup.backupCodesLeft, 9);
    assert.equal((await outcome(mfa.verify(userId, backupCodes[0]))).status, 401, "code de secours déjà utilisé");

    // Blocage : 5 échecs depuis la dernière réussite (1 déjà compté ci-dessus + 4).
    for (let i = 0; i < 4; i += 1) assert.equal((await outcome(mfa.verify(userId, "abcdef"))).status, 401);
    assert.equal((await outcome(mfa.verify(userId, backupCodes[1]))).status, 429, "bloqué, même avec un bon code");
    assert.equal((await mfa.status(userId)).backupCodesLeft, 9, "le code présenté pendant le blocage n'est pas consommé");
    await db.query("update ika_mfa_attempts set created_at = now() - interval '1 hour' where user_id = $1", [userId]);
    assert.equal((await mfa.verify(userId, backupCodes[1])).method, "BACKUP", "blocage levé après la durée prévue");

    // Renouvellement : les anciens codes cessent de fonctionner.
    const renewed = await mfa.regenerateBackupCodes(userId, backupCodes[2]);
    assert.equal(renewed.backupCodes.length, 10);
    assert.equal((await mfa.status(userId)).backupCodesLeft, 10);
    assert.equal((await outcome(mfa.disable(userId, backupCodes[3]))).status, 401, "ancien code de secours refusé après renouvellement");

    // Désactivation avec un code valide : tout est supprimé.
    assert.equal((await mfa.disable(userId, renewed.backupCodes[0])).ok, true);
    assert.deepEqual(await mfa.status(userId), { enabled: false, pending: false, backupCodesLeft: 0 });
    assert.equal((await db.query("select count(*)::int as n from ika_mfa_backup_codes where user_id = $1", [userId]))[0].n, 0);
    const actions = (await db.query("select action from ika_audit where actor_id = $1 and action like 'MFA_%' order by created_at", [userId])).map((r) => r.action);
    assert.deepEqual(actions, ["MFA_ENABLED", "MFA_BACKUP_REGENERATED", "MFA_DISABLED"]);
  } finally {
    await db.query("delete from ika_users where email = $1", [email]).catch(() => undefined);
    await db.close();
  }
});

test("MFA : sans clé de chiffrement configurée, l'activation est refusée (503) et rien n'est stocké", { skip }, async () => {
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const mfa = createMfa({ db, key: null });
  const email = `nk${Date.now()}@test.invalid`;
  try {
    await accounts.register({ name: "Sans clé", email, password: "motdepasse1", acceptTerms: true });
    const userId = (await db.query("select id from ika_users where email = $1", [email]))[0].id;
    assert.equal((await outcome(mfa.begin(userId))).status, 503);
    assert.equal((await db.query("select 1 from ika_mfa_secrets where user_id = $1", [userId])).length, 0);
  } finally {
    await db.query("delete from ika_users where email = $1", [email]).catch(() => undefined);
    await db.close();
  }
});
