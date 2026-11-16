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

test("deux méthodes par compte : mot de passe seul, Google seul, les deux ; règles de liaison et de retrait", { skip }, async () => {
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { sha256 } = await import("../server/lib/security.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const tag = `dm${Date.now()}`;
  const emails = [`a${tag}@test.invalid`, `b${tag}@test.invalid`, `c${tag}@test.invalid`];
  try {
    // A : compte avec mot de passe (sans Google)
    await accounts.register({ name: "Compte A", email: emails[0], password: "motdepasse1", acceptTerms: true });
    const a = (await db.query("select id from ika_users where email = $1", [emails[0]]))[0].id;
    assert.deepEqual((await accounts.me(a)).authMethods, { password: true, google: false });

    // B : compte créé par Google (sans mot de passe connu)
    const gb = await accounts.loginWithGoogle({ sub: `${tag}-b`, email: emails[1], name: "Compte B" }, { acceptTerms: true });
    const b = gb.user.id;
    assert.deepEqual((await accounts.me(b)).authMethods, { password: false, google: true });
    assert.equal((await outcome(accounts.login({ email: emails[1], password: "n-importe-quoi" }))).status, 401, "pas de connexion par mot de passe pour un compte Google seul");
    assert.equal((await outcome(accounts.unlinkGoogle(b))).status, 400, "retrait refusé : il ne resterait aucune connexion");

    // Réinitialisation du mot de passe : le compte Google obtient aussi un mot de passe
    await db.query("insert into ika_password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')", [sha256(`tok-${tag}`), b]);
    await accounts.resetPassword({ token: `tok-${tag}`, password: "nouveau-mdp-1" });
    assert.deepEqual((await accounts.me(b)).authMethods, { password: true, google: true });
    assert.ok((await accounts.login({ email: emails[1], password: "nouveau-mdp-1" })).token, "connexion par mot de passe après réinitialisation");

    // Liaison : A relie Google avec la même adresse, puis se connecte par Google
    assert.equal((await outcome(accounts.linkGoogle(a, { sub: `${tag}-a`, email: emails[2] }))).status, 400, "adresse Google différente refusée");
    assert.equal((await outcome(accounts.linkGoogle(a, { sub: `${tag}-b`, email: emails[0] }))).status, 409, "identifiant Google déjà relié à un autre compte refusé");
    assert.equal((await outcome(accounts.linkGoogle(a, { sub: `${tag}-a`, email: emails[0] }))).ok, true);
    assert.equal((await accounts.unlinkGoogle(b)).ok, true, "retrait autorisé : le mot de passe existe");
    assert.deepEqual((await accounts.me(b)).authMethods, { password: true, google: false });
    assert.deepEqual((await accounts.me(a)).authMethods, { password: true, google: true });
    const viaGoogle = await accounts.loginWithGoogle({ sub: `${tag}-a`, email: emails[0], name: "A" }, { acceptTerms: false });
    assert.equal(viaGoogle.user.id, a, "même compte par les deux méthodes");
    assert.ok((await accounts.login({ email: emails[0], password: "motdepasse1" })).token, "même compte par mot de passe");
    const audit = await db.query("select action from ika_audit where actor_id = $1 order by created_at", [a]);
    assert.deepEqual(audit.map((x) => x.action), ["GOOGLE_LINK"]);

    // Un compte à mot de passe avec une autre adresse Google : la connexion Google ne le relie pas toute seule
    const refused = await outcome(accounts.loginWithGoogle({ sub: `${tag}-c`, email: emails[0], name: "C" }, { acceptTerms: true }));
    assert.equal(refused.status, 409);
    assert.match(refused.message, /mot de passe/);
    // Retrait possible maintenant que le mot de passe existe
    assert.equal((await accounts.unlinkGoogle(a)).ok, true);
    assert.equal((await outcome(accounts.unlinkGoogle(a))).status, 400, "rien à retirer une seconde fois");
  } finally {
    await db.query("delete from ika_users where email = any($1)", [emails]).catch(() => undefined);
    await db.close();
  }
});
