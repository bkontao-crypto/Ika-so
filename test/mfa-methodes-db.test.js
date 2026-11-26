// MFA : méthodes e-mail et SMS (code à usage unique) contre un VRAI PostgreSQL (ignoré sans DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { return { ok: true, r: await p }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("MFA par e-mail et SMS : envoi, usage unique, expiration, limites, secours, désactivation", { skip }, async () => {
  assert.match(new URL(url).pathname.replace(/^\//, ""), /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { createMfa } = await import("../server/services/mfa.js");
  const { parseKey, totpCode, generateSecret } = await import("../server/lib/totp.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const key = parseKey("e".repeat(64));
  const sent = []; let failNext = false;
  const sendEmail = async ({ to, subject, text }) => { if (failNext) throw new Error("boom"); sent.push({ via: "EMAIL", to, text, subject }); };
  const sendSms = async (to, body) => { if (failNext) throw new Error("boom"); sent.push({ via: "SMS", to, text: body }); };
  const lastCode = () => sent.at(-1).text.match(/\b(\d{6})\b/)[1];
  const mfa = createMfa({ db, key, sendEmail, sendSms });
  const tag = `mm${Date.now()}`;
  const email = `${tag}@test.invalid`;
  const phone = `+223${String(Date.now()).slice(-8)}`;
  const ago = (userId, seconds) => db.query("update ika_mfa_otps set created_at = created_at - ($2 || ' seconds')::interval where user_id = $1", [userId, String(seconds)]);
  try {
    await accounts.register({ name: "Test Methodes", email, password: "motdepasse1", acceptTerms: true });
    const userId = (await db.query("select id from ika_users where email = $1", [email]))[0].id;

    // Disponibilité : sans fournisseur, e-mail et SMS sont refusés.
    assert.deepEqual(createMfa({ db, key }).available(), { app: true, email: false, sms: false });
    assert.deepEqual(mfa.available(), { app: true, email: true, sms: true });
    assert.equal((await outcome(createMfa({ db, key }).begin(userId, "EMAIL"))).status, 400);
    assert.equal((await outcome(mfa.begin(userId, "FAX"))).status, 400, "méthode inconnue");
    assert.equal((await outcome(mfa.begin(userId, "SMS"))).status, 400, "SMS : numéro non vérifié refusé");
    assert.equal(sent.length, 0, "rien n'est envoyé avant les contrôles");

    // Activation par e-mail : le code part vers l'adresse du compte (masquée dans la réponse).
    const begun = await mfa.begin(userId, "EMAIL");
    assert.equal(begun.method, "EMAIL"); assert.match(begun.sentTo, /^.•+@test\.invalid$/);
    assert.equal(sent.length, 1); assert.equal(sent[0].to, email); assert.match(sent[0].subject, /code de vérification/);
    assert.equal((await db.query("select code_hash from ika_mfa_otps where user_id = $1", [userId]))[0].code_hash.includes(lastCode()), false, "code jamais en clair");
    assert.equal((await mfa.status(userId)).pending, true); assert.equal((await mfa.status(userId)).method, "EMAIL");
    assert.equal((await outcome(mfa.confirm(userId, "000000"))).status, 400, "mauvais code refusé");
    assert.equal((await outcome(mfa.confirm(userId, totpCode(generateSecret())))).status, 400, "un code d'application n'est pas accepté");
    const { backupCodes } = await mfa.confirm(userId, lastCode());
    assert.equal(backupCodes.length, 10);
    const st = await mfa.status(userId); assert.equal(st.enabled, true); assert.equal(st.method, "EMAIL");
    assert.equal((await outcome(mfa.verify(userId, lastCode()))).status, 401, "un code ne sert qu'une fois");

    // Connexion : envoi, limite de fréquence, usage unique, expiration, code précédent invalidé.
    assert.deepEqual(await mfa.pendingInfo(userId), { method: "EMAIL", sentTo: begun.sentTo });
    await ago(userId, 3600);
    const a = await mfa.sendCode(userId); assert.equal(a.expiresInMinutes, 10);
    const first = lastCode();
    assert.equal((await outcome(mfa.sendCode(userId))).status, 429, "pas deux envois en moins de 45 s");
    await ago(userId, 60);
    await mfa.sendCode(userId);
    const second = lastCode();
    assert.notEqual(first, second);
    assert.equal((await outcome(mfa.verify(userId, first))).status, 401, "l'ancien code n'est plus valable");
    assert.equal((await mfa.verify(userId, second)).method, "OTP");
    assert.equal((await outcome(mfa.verify(userId, second))).status, 401, "rejeu refusé");
    await ago(userId, 60);
    await mfa.sendCode(userId); const old = lastCode();
    await db.query("update ika_mfa_otps set expires_at = now() - interval '1 minute' where user_id = $1 and used_at is null", [userId]);
    assert.equal((await outcome(mfa.verify(userId, old))).status, 401, "code expiré refusé");

    // Plafond de 5 envois par heure ; un échec d'envoi ne laisse aucun code valable.
    await db.query("delete from ika_mfa_otps where user_id = $1", [userId]);
    for (let i = 0; i < 5; i += 1) { await mfa.sendCode(userId); await ago(userId, 60); }
    assert.equal((await outcome(mfa.sendCode(userId))).status, 429, "5 codes par heure au plus");
    await db.query("delete from ika_mfa_otps where user_id = $1", [userId]);
    failNext = true;
    assert.equal((await outcome(mfa.sendCode(userId))).status, 502);
    failNext = false;
    assert.equal(Number((await db.query("select count(*)::int as n from ika_mfa_otps where user_id = $1", [userId]))[0].n), 0, "échec d'envoi : aucun code conservé");

    // Les codes de secours restent valables, et la désactivation exige un code reçu.
    assert.equal((await mfa.verify(userId, backupCodes[0])).method, "BACKUP");
    await mfa.sendCode(userId);
    assert.deepEqual(await mfa.disable(userId, lastCode()), { ok: true });
    assert.equal((await mfa.status(userId)).enabled, false);

    // SMS : numéro vérifié obligatoire ; le code part par SMS.
    await db.query("update ika_profiles set phone = $2, phone_verified_at = now() where user_id = $1", [userId, phone]);
    await ago(userId, 60);
    const viaSms = await mfa.begin(userId, "SMS");
    assert.equal(viaSms.method, "SMS"); assert.match(viaSms.sentTo, /^\+223 •• •• \d\d$/);
    assert.equal(sent.at(-1).via, "SMS"); assert.equal(sent.at(-1).to, phone);
    await mfa.confirm(userId, lastCode());
    assert.equal((await mfa.status(userId)).method, "SMS");
    assert.deepEqual((await mfa.status(userId)).available, { app: true, email: true, sms: true });
    await ago(userId, 3600);
    await mfa.sendCode(userId);
    assert.equal((await mfa.verify(userId, lastCode())).ok, true);
  } finally {
    await db.query("delete from ika_users where email = $1", [email]);
    await db.close();
  }
});
