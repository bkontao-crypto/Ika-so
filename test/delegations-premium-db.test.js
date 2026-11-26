// Plafond de 10 comptes délégués d'un compte Premium : contre un VRAI PostgreSQL (ignoré sans DATABASE_URL_TEST).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const outcome = async (p) => { try { return { ok: true, r: await p }; } catch (e) { return { ok: false, status: e.status, message: e.message }; } };

test("Premium : au plus 10 invitations d'équipe (en attente ou acceptées), une place revient après un refus ; hors Premium, pas de plafond", { skip }, async () => {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, "la base doit avoir « test » dans son nom");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createAccounts } = await import("../server/services/accounts.js");
  const { createReviews } = await import("../server/services/reviews.js");
  const db = createDb(url);
  await migrate(db, () => {});
  const accounts = createAccounts({ db, config: {} });
  const reviews = createReviews({ db }, accounts, null, null);
  const tag = `dg${Date.now()}`;
  const emails = [];
  const idOf = async (email) => (await db.query("select id from ika_users where email = $1", [email]))[0].id;
  const make = async (label) => {
    const email = `${tag}${label}@test.invalid`;
    emails.push(email);
    await accounts.register({ name: `Compte ${label}`, email, password: "motdepasse1", acceptTerms: true });
    return idOf(email);
  };
  try {
    const premium = await make("p");
    const plain = await make("n");
    const targets = [];
    for (let i = 0; i < 11; i += 1) targets.push(await make(`t${i}`));
    await db.query("update ika_profiles set premium_until = now() + interval '30 days' where user_id = $1", [premium]);

    // 10 invitations passent, la 11e est refusée avec un message clair.
    for (let i = 0; i < 10; i += 1) assert.equal((await reviews.sendTeamRequest(premium, targets[i])).status, "PENDING");
    const eleventh = await outcome(reviews.sendTeamRequest(premium, targets[10]));
    assert.equal(eleventh.ok, false);
    assert.equal(eleventh.status, 409);
    assert.match(eleventh.message, /10 comptes délégués/);
    assert.equal((await db.query("select count(*)::int as n from ika_team_links where requester_id = $1", [premium]))[0].n, 10);

    // Accepter une invitation déjà comptée ne change pas le compte ; un refus libère une place.
    const links = await db.query("select id, target_id from ika_team_links where requester_id = $1 order by created_at", [premium]);
    assert.equal((await reviews.respondTeamRequest(links[0].target_id, links[0].id, true)).status, "ACCEPTED");
    assert.equal((await outcome(reviews.sendTeamRequest(premium, targets[10]))).ok, false, "toujours 10 (1 acceptée + 9 en attente)");
    assert.equal((await reviews.respondTeamRequest(links[1].target_id, links[1].id, false)).status, "DECLINED");
    assert.equal((await reviews.sendTeamRequest(premium, targets[10])).status, "PENDING", "une place s'est libérée");

    // Un compte sans Premium actif n'est pas limité par cette règle (comportement existant conservé).
    for (let i = 0; i < 11; i += 1) assert.equal((await reviews.sendTeamRequest(plain, targets[i])).status, "PENDING");

    // Premium expiré : plus de plafond sur les nouvelles invitations, les liens existants restent intacts.
    await db.query("update ika_profiles set premium_until = now() - interval '1 day' where user_id = $1", [premium]);
    assert.equal((await db.query("select count(*)::int as n from ika_team_links where requester_id = $1 and status in ('PENDING', 'ACCEPTED')", [premium]))[0].n, 10);
  } finally {
    const ids = [];
    for (const e of emails) ids.push(...(await db.query("select id from ika_users where email = $1", [e]).catch(() => [])).map((r) => r.id));
    if (ids.length) await db.query("delete from ika_team_links where requester_id = any($1) or target_id = any($1)", [ids]).catch(() => undefined);
    for (const e of emails) await db.query("delete from ika_users where email = $1", [e]).catch(() => undefined);
    await db.close();
  }
});
