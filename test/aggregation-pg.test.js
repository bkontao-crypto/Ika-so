// Audit A-03 : l'agrégation alimente l'horaire, les utilisateurs actifs, les spectateurs par annonce et (si identifiant) les visiteurs distincts.
// PostgreSQL réel ; ignoré sans DATABASE_URL_TEST (base dont le nom contient « test »).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";

test("agrégation : horaire, utilisateurs actifs, spectateurs, visiteurs distincts, contrôles, idempotence", { skip }, async () => {
  assert.match(new URL(url).pathname.replace(/^\//, ""), /test/i, "DATABASE_URL_TEST doit viser une base « test »");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { aggregateDay, METHOD_VERSION } = await import("../server/lib/aggregation.js");
  const db = createDb(url);
  try {
    await migrate(db, () => {});
    const day = "2026-01-15"; // jour passé fixe
    await db.query("delete from ika_analytics_events where event_id like 'agtest-%'");
    const ev = (id, type, at, { user = null, visitor = null, listing = null, bot = false } = {}) =>
      db.query(
        "insert into ika_analytics_events (event_id, event_type, occurred_at, user_id, visitor_id, listing_id, is_bot) values ($1, $2, $3, $4, $5, $6, $7)",
        [`agtest-${id}`, type, `${day}T${at}Z`, user, visitor, listing, bot]);
    await ev("1", "listing_view", "09:10:00", { user: "u1", listing: "L1" });
    await ev("2", "listing_view", "09:40:00", { user: "u1", listing: "L1" });          // même personne, même annonce : 1 spectateur
    await ev("3", "listing_view", "09:50:00", { user: "u2", listing: "L1" });
    await ev("4", "page_view", "14:05:00");                                            // anonyme : compté, pas identifié
    await ev("5", "page_view", "14:06:00", { bot: true });                             // robot : exclu
    await ev("6", "listing_view", "14:30:00", { visitor: "v1", listing: "L2" });
    await ev("7", "listing_view", "14:31:00", { visitor: "v2", listing: "L2" });

    const newId = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
    const r1 = await aggregateDay(db, day, { newId });
    assert.equal(r1.ok, true, "contrôles journalier et horaire cohérents");
    assert.equal(r1.expected, 6, "6 événements hors robot");

    const hourly = await db.query("select extract(hour from hour_start)::int as h, sum(value)::int as n from ika_agg_hourly where hour_start >= $1::timestamptz and hour_start < $2::timestamptz and method_version = $3 and metric like 'event.%' group by 1 order by 1", [`${day}T00:00:00Z`, `${day}T23:59:59Z`, METHOD_VERSION]);
    assert.deepEqual(hourly.map((r) => [r.h, r.n]), [[9, 3], [14, 3]], "heures de pointe : 9 h et 14 h");

    const daily = async (metric, dim = "") => (await db.query("select dim_id, value::int as value from ika_agg_daily where day = $1::date and metric = $2 and dim_type = $3 and method_version = $4 order by dim_id", [day, metric, dim, METHOD_VERSION]));
    assert.equal((await daily("users.active"))[0].value, 2, "2 comptes connectés actifs");
    assert.equal((await daily("visitors.unique"))[0].value, 2, "2 visiteurs distincts identifiés");
    assert.deepEqual((await daily("listing.unique_viewers", "listing")).map((r) => [r.dim_id, r.value]), [["L1", 2], ["L2", 2]]);

    assert.equal((await db.query("select count(*)::int as n from ika_visitor_days where day = $1::date", [day]))[0].n, 2);
    assert.equal((await db.query("select count(*)::int as n from ika_listing_viewer_days where day = $1::date", [day]))[0].n, 2);

    const r2 = await aggregateDay(db, day, { newId }); // rejouer ne double rien
    assert.equal(r2.ok, true);
    assert.equal((await daily("visitors.unique"))[0].value, 2);
    assert.equal((await db.query("select count(*)::int as n from ika_visitor_days where day = $1::date", [day]))[0].n, 2);
    assert.equal((await db.query("select sum(value)::int as n from ika_agg_hourly where hour_start >= $1::timestamptz and hour_start < $2::timestamptz and metric like 'event.%'", [`${day}T00:00:00Z`, `${day}T23:59:59Z`]))[0].n, 6);

    await db.query("delete from ika_analytics_events where event_id like 'agtest-%'");
    await db.query("delete from ika_agg_daily where day = $1::date", [day]);
    await db.query("delete from ika_agg_hourly where hour_start >= $1::timestamptz and hour_start < $2::timestamptz", [`${day}T00:00:00Z`, `${day}T23:59:59Z`]);
    await db.query("delete from ika_visitor_days where day = $1::date", [day]);
    await db.query("delete from ika_listing_viewer_days where day = $1::date", [day]);
  } finally { await db.close?.(); }
});
