// Annuaire des annonceurs (classement) et centre de contrôle Premium : logique pure + service sur fausse base (sans PostgreSQL).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WEIGHTS, bayesianRating, compareDirectory, filterDirectory, premiumAccess, scoreAdvertiser } from "../server/lib/advertiser-ranking.js";
import { createAdvertiserCenter } from "../server/services/advertiser-center.js";
import { forbidden } from "../server/lib/errors.js";

const base = { average: 4.5, reviewCount: 10, replied: 8, days: 400, live: 8, closed: 4, views30: 200, threads: 20, answered: 18, phoneBySms: true, titleChecked: 1, agencyVerified: false };
const entry = (over = {}) => ({ id: "a", name: "Alpha", role: "Agence immobilière", neighborhood: "ACI 2000", certified: false, boosted: false, score: 50, rating: { count: 0 }, ...over });

test("les poids font 100 % et le score reste entre 0 et 100", () => {
  assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const m of [base, { ...base, average: 0, reviewCount: 0, live: 0, days: 0, closed: 0, views30: 0, threads: 0, answered: 0, replied: 0, phoneBySms: false, titleChecked: 0 }, { ...base, views30: 99999, live: 999, days: 99999 }]) {
    const s = scoreAdvertiser(m).score;
    assert.ok(s >= 0 && s <= 100, String(s));
  }
});

test("un seul avis 5/5 ne place pas un inconnu devant un annonceur établi", () => {
  assert.ok(bayesianRating(5, 1) < 4);
  const newcomer = scoreAdvertiser({ ...base, average: 5, reviewCount: 1, replied: 0, days: 2, live: 1, closed: 0, views30: 3, threads: 0, answered: 0, phoneBySms: false, titleChecked: 0 });
  assert.ok(scoreAdvertiser(base).score > newcomer.score);
});

test("réactivité : peu de données = neutre (50), répondre à tout est récompensé", () => {
  assert.equal(scoreAdvertiser({ ...base, threads: 1, answered: 0, reviewCount: 1, replied: 0 }).parts.reactivity, 50);
  const silent = scoreAdvertiser({ ...base, answered: 0, replied: 0 });
  const quick = scoreAdvertiser({ ...base, answered: 20, replied: 10 });
  assert.ok(quick.parts.reactivity > silent.parts.reactivity);
  assert.equal(quick.responseRate, 100);
  assert.equal(scoreAdvertiser({ ...base, threads: 2, answered: 2 }).responseRate, null);
});

test("un annonceur boosté passe devant, quel que soit son statut ou son score", () => {
  const rows = [entry({ id: "top", name: "Top", score: 95, certified: true }), entry({ id: "boost", name: "Boosté", score: 12, boosted: true }), entry({ id: "mid", name: "Milieu", score: 60 })];
  assert.deepEqual(rows.sort(compareDirectory).map((r) => r.id), ["boost", "top", "mid"]);
  const ties = [entry({ id: "b", name: "Zoé", score: 70 }), entry({ id: "a", name: "Awa", score: 70 })];
  assert.deepEqual(ties.sort(compareDirectory).map((r) => r.id), ["a", "b"]);
});

test("filtres : recherche sans accents, types, certifiés, boostés", () => {
  const rows = [entry({ id: "1", name: "Agence Kanu", neighborhood: "Sébénikoro" }), entry({ id: "2", name: "Moussa", role: "Propriétaire direct", certified: true }), entry({ id: "3", name: "Fanta", role: "Démarcheur mandaté", boosted: true })];
  assert.deepEqual(filterDirectory(rows, { q: "sebenikoro" }).map((r) => r.id), ["1"]);
  assert.deepEqual(filterDirectory(rows, { kind: "individual" }).map((r) => r.id), ["2"]);
  assert.deepEqual(filterDirectory(rows, { kind: "agent" }).map((r) => r.id), ["3"]);
  assert.deepEqual(filterDirectory(rows, { kind: "certified" }).map((r) => r.id), ["2"]);
  assert.deepEqual(filterDirectory(rows, { kind: "boosted" }).map((r) => r.id), ["3"]);
  assert.equal(filterDirectory(rows, {}).length, 3);
});

test("accès Premium : abonnement en cours ET certification, sinon refus", () => {
  const now = Date.parse("2026-11-09T00:00:00Z");
  const future = "2026-12-15T00:00:00Z";
  assert.equal(premiumAccess({ premiumUntil: future, agencyVerified: true }, now).eligible, true);
  assert.equal(premiumAccess({ premiumUntil: future, agencyVerified: false, titleChecked: 1 }, now).eligible, true);
  assert.equal(premiumAccess({ premiumUntil: future, agencyVerified: false, titleChecked: 0 }, now).eligible, false);
  assert.equal(premiumAccess({ premiumUntil: "2026-10-01T00:00:00Z", agencyVerified: true }, now).eligible, false);
  assert.equal(premiumAccess({ premiumUntil: null, agencyVerified: true }, now).premium, false);
  assert.equal(premiumAccess({ premiumUntil: future, agencyVerified: true }, now).daysLeft, 36);
});

function fakeDb(handlers = []) {
  const calls = [];
  const run = async (sql, params = []) => { calls.push({ sql, params }); for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params); return []; };
  return { calls, query: run, transaction: async (fn) => fn({ query: run }) };
}
const accounts = () => { const audits = []; return { audits, audit: async (...a) => { audits.push(a); }, requireStaff: async (id) => { if (id !== "root") throw forbidden("Réservé."); return {}; } }; };

test("centre de contrôle : refusé sans Premium, refusé sans certification, aucune autre requête n'est faite", async () => {
  for (const [row, msg] of [[{ premium_until: null, agency_verified_at: new Date(), title_checked: 0, account_status: "ACTIVE" }, /Premium/], [{ premium_until: new Date(Date.now() + 864e5), agency_verified_at: null, title_checked: 0, account_status: "ACTIVE" }, /certifi/]]) {
    const db = fakeDb([[/from ika_profiles p where p.user_id/, () => [row]]]);
    const svc = createAdvertiserCenter({ db, accounts: accounts() });
    await assert.rejects(svc.overview("u1"), (e) => e.status === 403 && msg.test(e.message));
    await assert.rejects(svc.mapPins("u1"), (e) => e.status === 403);
    assert.equal(db.calls.length, 2, "seul l'accès est lu");
  }
});

test("octroi Premium : super administrateur, motif et durée obligatoires, tracé", async () => {
  const acc = accounts();
  const db = fakeDb([[/update ika_profiles set premium_until/, () => [{ premium_until: new Date("2026-12-31T00:00:00Z") }]]]);
  const svc = createAdvertiserCenter({ db, accounts: acc });
  await assert.rejects(svc.grantPremium("someone", "u1", { days: 30, reason: "ok ok" }), (e) => e.status === 403);
  await assert.rejects(svc.grantPremium("root", "u1", { days: 0, reason: "ok ok" }), (e) => e.status === 400);
  await assert.rejects(svc.grantPremium("root", "u1", { days: 30, reason: " " }), (e) => e.status === 400);
  const out = await svc.grantPremium("root", "u1", { days: 30, reason: "Abonnement annuel" });
  assert.equal(out.ok, true);
  assert.equal(acc.audits[0][1], "PREMIUM_GRANT");
  assert.ok(db.calls.some((c) => /insert into ika_premium_grants/.test(c.sql)));
  const upd = db.calls.find((c) => /update ika_profiles/.test(c.sql));
  assert.deepEqual(upd.params, ["u1", "30"]);
});

test("annuaire : boostés d'abord, aucune donnée de contact, requête paramétrée", async () => {
  const row = (id, name, over = {}) => ({ id, name, full_name: name, display_role: "Agence immobilière", agency_verified_at: null, agency_name: null, phone_verified_at: new Date(), phone_channel: "SMS", profile_created: new Date(Date.now() - 400 * 864e5), avatar_url: null, images_hidden: false, live: 3, closed: 1, title_checked: 0, boosted_until: null, hood: "Hamdallaye", review_n: 0, review_avg: 0, replied: 0, threads: 0, answered: 0, views30: 0, phone: "+22370000000", ...over });
  const db = fakeDb([[/with cand as/, () => [row("a", "Alpha", { review_n: 20, review_avg: 4.9, title_checked: 2 }), row("b", "Bêta", { boosted_until: new Date(Date.now() + 864e5), review_n: 0 }), row("c", "Gamma", { avatar_url: "/api/media/x", images_hidden: true })]]]);
  const svc = createAdvertiserCenter({ db, accounts: accounts() });
  const { items, total } = await svc.directory({});
  assert.equal(total, 3);
  assert.equal(items[0].id, "b");
  assert.equal(items[0].boosted, true);
  assert.equal(items[2].photoUrl, null, "photo masquée par la modération : jamais affichée");
  assert.ok(!JSON.stringify(items).includes("2237"), "aucun numéro dans l'annuaire");
  assert.ok(!db.calls[0].sql.includes("undefined"));
  assert.equal((db.calls[0].sql.match(/\(/g) ?? []).length, (db.calls[0].sql.match(/\)/g) ?? []).length);
  const page = await svc.directory({ q: "gamma", limit: 1 });
  assert.deepEqual(page.items.map((i) => i.id), ["c"]);
});

test("interface : pages branchées, aucune ressource externe, carte non chargée à l'ouverture", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const files = ["public/js/pages/annonceurs.js", "public/js/pages/centre.js", "public/js/pages/premium.js", "public/js/components/espace.js", "public/css/espace.css"];
  for (const f of files) assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(read(f)), `ressource externe dans ${f}`);
  const app = read("public/js/app.js");
  assert.match(app, /annonceursPage/); assert.match(app, /centrePage/);
  const sw = read("public/sw.js");
  for (const f of ["/js/pages/annonceurs.js", "/js/pages/centre.js", "/css/espace.css"]) assert.ok(sw.includes(f), f);
  const centre = read("public/js/pages/centre.js");
  assert.ok(!/\/me\/center\/map/.test(centre.split("mapBtn")[0].split("export async function centrePage")[0]));
  assert.match(centre, /Afficher la carte/);
  assert.ok(centre.indexOf('api("/me/center/map")') > centre.indexOf("onClick: async () =>"), "la carte n'est demandée qu'au clic");
  assert.match(read("public/js/components/chrome.js"), /#\/annonceurs/);
});

test("carte « Passez Premium » : présente chez tous les annonceurs, page des avantages sans promesse non tenue", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("public/js/app.js"), /premiumPage/);
  assert.ok(read("public/sw.js").includes("/js/pages/premium.js"));
  for (const f of ["public/js/pages/centre.js", "public/js/pages/account.js", "public/js/pages/agency.js"]) assert.match(read(f), /premiumCard/, f);
  const page = read("public/js/pages/premium.js");
  assert.match(page, /option payante/, "la mise à la une est présentée comme distincte du Premium");
  assert.ok(!/(prioritaire|en tête de l'annuaire des annonceurs)/.test(page.split("const FAQ")[0]), "aucun avantage de classement promis dans le tableau");
});

test("espace standard : ouvert sans Premium, aucune donnée de vues ni de carte, complétion du profil calculée", async () => {
  const profile = { premium_until: null, agency_verified_at: null, title_checked: 0, account_status: "ACTIVE", full_name: "Awa Traoré" };
  const db = fakeDb([
    [/from ika_profiles p where p.user_id/, () => [profile]],
    [/count\(\*\)::int as total/, () => [{ total: 2, live: 1, pending: 1, favorites: 7, visits: 3, unread: 1, contacts7: 4 }]],
    [/from ika_listings l where l.owner_id = \$1 and l.status in .* limit 4/s, () => [{ id: "l1", title: "Villa", price: "850000", transaction_type: "RENT", neighborhood: "Cocody", image_url: "/x.jpg", status: "PUBLISHED", contacts: 6 }]],
    [/from ika_threads t join ika_users u/, () => []],
    [/from ika_notifications/, () => []],
    [/from ika_profiles p left join ika_advertiser_profiles ap/, () => [{ phone_verified_at: new Date(), avatar_url: null, has_bio: false }]],
  ]);
  const out = await createAdvertiserCenter({ db, accounts: accounts() }).standardOverview("u1");
  assert.equal(out.access.eligible, false);
  assert.equal(out.contacts7, 4);
  assert.equal(out.kpis.favorites, 7);
  assert.equal(out.profile.percent, 40, "téléphone + annonce en ligne = 2 étapes sur 5");
  assert.deepEqual(out.profile.steps.filter((s) => s.done).map((s) => s.key), ["phone", "listing"]);
  assert.ok(!/analytics_events|ika_listing_geo/.test(db.calls.map((c) => c.sql).join(" ")), "ni vues ni carte côté standard");
  assert.ok(!("stats" in out) && !("alerts" in out) && !("deadlines" in out));
  const blocked = createAdvertiserCenter({ db: fakeDb([[/from ika_profiles p where p.user_id/, () => [{ ...profile, account_status: "SUSPENDED" }]]]), accounts: accounts() });
  await assert.rejects(blocked.standardOverview("u1"), (e) => e.status === 403);
});

test("espace standard : page branchée, chargée à la demande, verrous vers #/premium", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const page = read("public/js/pages/centre-standard.js");
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(page));
  assert.match(read("public/js/pages/centre.js"), /centre-standard\.js/);
  assert.ok(read("public/sw.js").includes("/js/pages/centre-standard.js"));
  assert.ok(!/\/me\/center\/(map|\?)|\/me\/center`/.test(page), "la page standard n'appelle aucune route Premium");
  assert.ok((page.match(/\bup\(/g) ?? []).length >= 7, "invitations Premium nombreuses");
});
