// Connexion avec Google : règles de liaison des comptes contre un VRAI PostgreSQL (ignoré sans DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { const r = await p; return { ok: true, r }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("loginWithGoogle : création, reconnexion par identifiant Google, refus de liaison à un compte à mot de passe, blocage", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const tag = `gg${Date.now()}`;
  const profile = { sub: `${tag}-sub`, email: `${tag}@test.invalid`, name: "Ali Test" };
  const pwEmail = `pw${tag}@test.invalid`;
  try {
    // 1. Nouvel utilisateur avec conditions acceptées : compte créé, sans mot de passe connu, avec l'identifiant Google.
    const created = await accounts.loginWithGoogle(profile, { acceptTerms: true });
    assert.ok(created.token && created.user.email === profile.email);
    const row = (await db.query("select password_hash, google_sub, terms_version from ika_users where email = $1", [profile.email]))[0];
    assert.equal(row.google_sub, profile.sub);
    assert.ok(row.password_hash.length > 20, "mot de passe aléatoire, inconnu de tous");
    assert.ok(row.terms_version, "version des conditions enregistrée");

    // 2. Nouvelle connexion : même compte, sans demander à nouveau les conditions.
    const again = await accounts.loginWithGoogle(profile, { acceptTerms: false });
    assert.equal(again.user.id, created.user.id);

    // 3. Compte à mot de passe existant avec la même adresse : PAS de liaison automatique.
    await accounts.register({ name: "Mot de passe", email: pwEmail, password: "motdepasse1", acceptTerms: true });
    const clash = await outcome(accounts.loginWithGoogle({ sub: `${tag}-other`, email: pwEmail, name: "X" }, { acceptTerms: true }));
    assert.equal(clash.ok, false);
    assert.equal(clash.status, 409);
    assert.equal((await db.query("select google_sub from ika_users where email = $1", [pwEmail]))[0].google_sub, null, "aucun identifiant Google ajouté au compte à mot de passe");

    // 4. Nouveau compte sans conditions acceptées : refusé, aucune ligne créée.
    const noTerms = await outcome(accounts.loginWithGoogle({ sub: `${tag}-nt`, email: `nt${tag}@test.invalid`, name: "N" }, { acceptTerms: false }));
    assert.equal(noTerms.status, 400);
    assert.equal((await db.query("select 1 from ika_users where email = $1", [`nt${tag}@test.invalid`])).length, 0);

    // 5. Compte bloqué : refusé.
    await db.query("insert into ika_profiles (user_id, account_status, status_reason) values ($1, 'BANNED', 'essai') on conflict (user_id) do update set account_status = 'BANNED', status_reason = 'essai'", [created.user.id]);
    const banned = await outcome(accounts.loginWithGoogle(profile, { acceptTerms: false }));
    assert.equal(banned.status, 403);
  } finally {
    await db.query("delete from ika_users where email in ($1, $2, $3)", [profile.email, `nt${tag}@test.invalid`, pwEmail]).catch(() => undefined);
    await db.close();
  }
});
