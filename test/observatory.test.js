import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { resolveRange, bucketOf, bucketsOf, deltaPct, METRICS } from "../server/services/observatory.js";

const NOW = new Date("2026-11-27T15:00:00Z");

test("Observatoire : période par défaut, période précédente de même durée, granularité", () => {
  const r = resolveRange({}, NOW);
  assert.deepEqual([r.from, r.to, r.days, r.previousFrom, r.previousTo, r.granularity], ["2026-10-29", "2026-11-27", 30, "2026-09-29", "2026-10-28", "day"]);
  assert.equal(resolveRange({ from: "2026-01-01", to: "2026-06-30" }, NOW).granularity, "week");
  assert.equal(resolveRange({ from: "2025-01-01", to: "2026-06-30" }, NOW).granularity, "month");
});

test("Observatoire : dates invalides, inversées, futures ou période trop longue refusées", () => {
  for (const q of [{ from: "2026-02-30" }, { from: "hier" }, { from: "2026-11-20", to: "2026-11-10" }, { to: "2026-11-28" }, { from: "2020-01-01" }]) {
    assert.throws(() => resolveRange(q, NOW), (e) => e.status === 400 || e.statusCode === 400, JSON.stringify(q));
  }
});

test("Observatoire : tranches (semaine au lundi, jamais avant le début) et variation", () => {
  assert.equal(bucketOf("2026-11-27", "week", "2026-01-01"), "2026-11-23");
  assert.equal(bucketOf("2026-11-27", "week", "2026-11-25"), "2026-11-25");
  assert.equal(bucketOf("2026-11-27", "month", "2026-01-01"), "2026-11-01");
  assert.equal(bucketsOf({ from: "2026-11-25", days: 3, granularity: "day" }).length, 3);
  assert.equal(deltaPct(15, 10), 50);
  assert.equal(deltaPct(5, 0), null);
  assert.equal(new Set(METRICS.map((m) => m.key)).size, METRICS.length);
});

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test d'intégration PostgreSQL ignoré.";

test("Observatoire sur PostgreSQL : chiffres exacts, robots écartés, aucune donnée personnelle, accès réservé", { skip }, async () => {
  assert.match(new URL(url).pathname, /test/i);
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createObservatory } = await import("../server/services/observatory.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const db = createDb(url);
  let server;
  try {
    await migrate(db, () => {});
    // Fenêtre isolée dans le passé : les autres tests n'y écrivent rien.
    const clock = () => new Date("2001-03-10T12:00:00Z");
    const observatory = createObservatory({ db, clock });
    const clean = () => db.query("delete from ika_analytics_events where event_id like 'obs-test-%'");
    await clean();
    const add = (id, type, at, extra = {}) => db.query(
      "insert into ika_analytics_events (event_id, event_type, occurred_at, source, device_type, is_bot, page_path, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
      [`obs-test-${id}`, type, at, extra.source ?? "direct", extra.device ?? "mobile", extra.bot ?? false, type === "page_view" ? "/" : null, JSON.stringify(extra.meta ?? {})]);
    await add(1, "page_view", "2001-03-09T00:00:00Z");
    await add(2, "page_view", "2001-03-10T11:50:00Z", { source: "facebook", device: "desktop" });
    await add(3, "page_view", "2001-03-10T11:55:00Z", { bot: true });
    await add(4, "listing_dwell", "2001-03-09T23:59:59Z", { meta: { seconds: 30 } });
    await add(5, "page_view", "2001-03-08T23:59:59Z"); // période précédente
    await add(6, "page_view", "2001-03-06T10:00:00Z"); // avant la période précédente
    const r = await observatory.report({ from: "2001-03-09", to: "2001-03-10" });
    const pv = r.metrics.find((m) => m.key === "pageViews");
    assert.deepEqual([pv.total, pv.previous, pv.values, pv.deltaPct], [2, 1, [1, 1], 100]);
    assert.equal(r.metrics.find((m) => m.key === "events").total, 3);
    assert.equal(r.breakdowns.botEvents, 1);
    assert.deepEqual(r.breakdowns.dwell, { count: 1, averageSeconds: 30 });
    assert.deepEqual(r.breakdowns.sources.map((x) => [x.label, x.n]), [["direct", 2], ["facebook", 1]]);
    assert.equal(r.breakdowns.heat.reduce((a, c) => a + c.n, 0), 3);
    assert.equal(r.live.last30m >= 1, true);
    await clean();

    // Toutes les requêtes s'exécutent aussi sur une période récente ; aucun champ personnel dans la réponse.
    const recent = await createObservatory({ db }).report({});
    assert.equal(recent.metrics.length, METRICS.length);
    assert.doesNotMatch(JSON.stringify(recent), /"(email|phone|password|owner_phone|user_id|userId|visitor_id|name)"/);

    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false" });
    const app = createApp({ services: createServices({ db, config, sendSms: async () => ({}) }), config, health: () => db.query("select 1") });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/staff/owner/observatory`);
    assert.equal(res.status, 401, "anonyme refusé");
  } finally {
    if (server) { server.close(); await once(server, "close").catch(() => {}); }
    await db.close();
  }
});

test("Observatoire : module non délégable (réservé au Super Administrateur)", async () => {
  const { DELEGABLE_MODULES } = await import("../server/services/owner-delegations.js");
  assert.equal(DELEGABLE_MODULES.has("observatory"), false);
});
