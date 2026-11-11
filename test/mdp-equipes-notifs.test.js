// Mot de passe oublié, équipes entre comptes, notification du staff : fausse base, on vérifie la logique et le SQL émis.
import test from "node:test";
import assert from "node:assert/strict";
import { createAccounts } from "../server/services/accounts.js";
import { createAdvertiserApplications } from "../server/services/advertiser-applications.js";
import { createReviews } from "../server/services/reviews.js";
import { sha256 } from "../server/lib/security.js";

function fakeDb(handlers = []) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params);
    return [];
  };
  return { calls, query, transaction: async (fn) => fn({ query }) };
}
const config = { publicUrl: "https://ika.test" };

test("mot de passe oublié : e-mail inconnu = même réponse, rien d'envoyé", async () => {
  const sent = [];
  const acc = createAccounts({ db: fakeDb(), config, sendEmail: async (m) => sent.push(m) });
  assert.deepEqual(await acc.requestPasswordReset({ email: "inconnu@ex.com" }), { sent: true });
  assert.equal(sent.length, 0);
});

test("mot de passe oublié : le lien part par e-mail, seul le hachage du jeton est stocké", async () => {
  const sent = [];
  const db = fakeDb([
    [/select id from ika_users where email/, () => [{ id: "u1" }]],
    [/select \* from ika_profiles/, () => [{ user_id: "u1", account_status: "ACTIVE" }]],
    [/count\(\*\)::int as n from ika_password_resets/, () => [{ n: 0 }]],
  ]);
  const acc = createAccounts({ db, config, sendEmail: async (m) => sent.push(m) });
  assert.deepEqual(await acc.requestPasswordReset({ email: "Awa@Ex.com " }), { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "awa@ex.com");
  const token = /token=([\w-]+)/.exec(sent[0].text)[1];
  const insert = db.calls.find((c) => /insert into ika_password_resets/.test(c.sql));
  assert.equal(insert.params[0], sha256(token));
  assert.notEqual(insert.params[0], token);
});

test("mot de passe oublié : au plus 3 demandes par heure", async () => {
  const sent = [];
  const db = fakeDb([
    [/select id from ika_users where email/, () => [{ id: "u1" }]],
    [/select \* from ika_profiles/, () => [{ user_id: "u1", account_status: "ACTIVE" }]],
    [/count\(\*\)::int as n from ika_password_resets/, () => [{ n: 3 }]],
  ]);
  await createAccounts({ db, config, sendEmail: async (m) => sent.push(m) }).requestPasswordReset({ email: "awa@ex.com" });
  assert.equal(sent.length, 0);
});

test("réinitialisation : jeton périmé ou déjà utilisé refusé ; sinon mot de passe changé et sessions fermées", async () => {
  const bad = createAccounts({ db: fakeDb(), config });
  await assert.rejects(bad.resetPassword({ token: "x", password: "nouveau-mdp-1" }), /plus valable/);
  await assert.rejects(bad.resetPassword({ token: "x", password: "court" }), /8 caractères/);
  const db = fakeDb([[/update ika_password_resets set used_at/, () => [{ user_id: "u1" }]]]);
  assert.deepEqual(await createAccounts({ db, config }).resetPassword({ token: "abc", password: "nouveau-mdp-1" }), { ok: true });
  assert.ok(db.calls.some((c) => /update ika_users set password_hash/.test(c.sql)));
  assert.ok(db.calls.some((c) => /delete from ika_sessions where user_id/.test(c.sql)));
});

test("demande annonceur : tout le staff est notifié", async () => {
  const notes = [];
  const db = fakeDb([[/select user_id from ika_profiles where staff_role/, () => [{ user_id: "m1" }, { user_id: "a1" }, { user_id: "s1" }]]]);
  const accounts = { ensureProfile: async () => ({ account_status: "ACTIVE", full_name: "Awa" }) };
  const svc = createAdvertiserApplications({ db, accounts, notify: async (u, n) => notes.push([u, n]) });
  await svc.submit("u1", { type: "AGENCE", agencyName: "Kanu Immo" });
  assert.deepEqual(notes.map(([u]) => u), ["m1", "a1", "s1"]);
  assert.equal(notes[0][1].kind, "ADVERTISER_APPLICATION");
  assert.match(notes[0][1].title, /Kanu Immo/);
});

test("demande annonceur : une panne de notification n'annule pas la demande", async () => {
  const db = fakeDb([[/select user_id from ika_profiles where staff_role/, () => [{ user_id: "a1" }]]]);
  const svc = createAdvertiserApplications({ db, accounts: { ensureProfile: async () => ({ account_status: "ACTIVE" }) }, notify: async () => { throw new Error("panne"); } });
  assert.equal((await svc.submit("u1", { type: "PARTICULIER" })).status, "PENDING");
});

const advertiserRow = { id: "u2", name: "Moussa", full_name: "Moussa K", display_role: "Particulier", account_status: "ACTIVE" };
test("équipe : on ne s'invite pas soi-même, pas de doublon, la personne invitée est prévenue", async () => {
  const notes = [];
  const reviews = createReviews({ db: fakeDb([[/from ika_users u join ika_profiles p/, () => [advertiserRow]]]) }, {}, null, async (u, n) => notes.push([u, n]));
  await assert.rejects(reviews.sendTeamRequest("u2", "u2"), /vous-même/);
  const dup = createReviews({ db: fakeDb([[/from ika_users u join ika_profiles p/, () => [advertiserRow]], [/status in \('PENDING', 'ACCEPTED'\)/, () => [{ status: "PENDING" }]]]) }, {}, null);
  await assert.rejects(dup.sendTeamRequest("u1", "u2"), /déjà en attente/);
  const ok = await reviews.sendTeamRequest("u1", "u2", { role: "Agent" });
  assert.equal(ok.status, "PENDING");
  assert.equal(notes[0][0], "u2"); assert.equal(notes[0][1].kind, "TEAM_REQUEST");
});

test("équipe : seul l'invité accepte ; l'acceptation prévient celui qui a invité", async () => {
  const notes = [];
  const db = fakeDb([[/update ika_team_links set status = \$3/, (s, p) => (p[1] === "u2" ? [{ requester_id: "u1" }] : [])]]);
  const reviews = createReviews({ db }, {}, null, async (u, n) => notes.push([u, n]));
  await assert.rejects(reviews.respondTeamRequest("u9", "tl1", true), /introuvable/);
  assert.equal((await reviews.respondTeamRequest("u2", "tl1", true)).status, "ACCEPTED");
  assert.equal(notes[0][0], "u1");
  assert.equal((await reviews.respondTeamRequest("u2", "tl1", false)).status, "DECLINED");
});
