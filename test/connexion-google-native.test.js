// Connexion native Google (application Android) : contrôle des revendications de l'ID token.
import { test } from "node:test";
import assert from "node:assert/strict";
import { profileFromIdTokenClaims, verifyIdToken } from "../server/lib/google-oauth.js";

const CLIENT = "web-client.apps.googleusercontent.com";
const NOW = 1_800_000_000;
const good = () => ({ aud: CLIENT, iss: "https://accounts.google.com", exp: NOW + 600, sub: "123", email: "Ali@Example.com", email_verified: "true", name: " Ali " });

test("ID token valide : profil normalisé", () => {
  assert.deepEqual(profileFromIdTokenClaims(good(), CLIENT, NOW), { sub: "123", email: "ali@example.com", name: "Ali" });
});

test("refus : mauvais destinataire, émetteur inconnu, expiré, e-mail non confirmé, sans identifiant", () => {
  assert.throws(() => profileFromIdTokenClaims({ ...good(), aud: "autre.apps.googleusercontent.com" }, CLIENT, NOW), /autre application/);
  assert.throws(() => profileFromIdTokenClaims({ ...good(), iss: "evil.example" }, CLIENT, NOW), /Émetteur/);
  assert.throws(() => profileFromIdTokenClaims({ ...good(), exp: NOW - 1 }, CLIENT, NOW), /expiré/);
  assert.throws(() => profileFromIdTokenClaims({ ...good(), email_verified: "false" }, CLIENT, NOW), /non confirmé/);
  assert.throws(() => profileFromIdTokenClaims({ ...good(), sub: "" }, CLIENT, NOW), /illisible/);
  assert.throws(() => profileFromIdTokenClaims(good(), "", NOW), /autre application/);
});

test("verifyIdToken : Google refuse le jeton → erreur ; jeton accepté → profil", async () => {
  await assert.rejects(verifyIdToken("x", CLIENT, async () => ({ ok: false, json: async () => ({}) })), /refusé/);
  const profile = await verifyIdToken("x", CLIENT, async (url) => {
    assert.match(url, /tokeninfo\?id_token=x$/);
    return { ok: true, json: async () => good() };
  });
  assert.equal(profile.email, "ali@example.com");
});
