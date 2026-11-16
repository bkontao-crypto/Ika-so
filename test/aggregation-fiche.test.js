// BUG-003 lot 4 : server/lib/aggregation.js (agrégation journalière) et server/lib/fiche.js (fiche de parcelle).
import test from "node:test";
import assert from "node:assert/strict";
import { parseDay, planDays, aggregateDay, DAILY_QUERIES, METHOD_VERSION, MAX_DAYS } from "../server/lib/aggregation.js";
import { ficheHtml, fondCarteUrl, planSvg, MENTION_OBLIGATOIRE } from "../server/lib/fiche.js";

const NOW = new Date("2026-11-15T10:00:00Z");

test("parseDay : format AAAA-MM-JJ obligatoire, dates inexistantes refusées", () => {
  assert.equal(parseDay("2026-02-28").toISOString(), "2026-02-28T00:00:00.000Z");
  for (const bad of ["2026-2-1", "15/11/2026", "", undefined]) assert.throws(() => parseDay(bad), /Date invalide/, String(bad));
  assert.throws(() => parseDay("2026-02-30"), /Date inexistante/);
});

test("planDays : par défaut, les N derniers jours complets (jamais le jour en cours)", () => {
  assert.deepEqual(planDays({ days: 3, now: NOW }), ["2026-11-12", "2026-11-13", "2026-11-14"]);
  assert.deepEqual(planDays({ days: "1", now: NOW }), ["2026-11-14"]);
});

test("planDays : plage explicite, erreurs de saisie et jour en cours refusé", () => {
  assert.deepEqual(planDays({ from: "2026-11-01", to: "2026-11-03", now: NOW }), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.throws(() => planDays({ from: "2026-11-01", now: NOW }), /ensemble/);
  assert.throws(() => planDays({ from: "2026-11-05", to: "2026-11-01", now: NOW }), /précède/);
  assert.throws(() => planDays({ from: "2026-11-01", to: "2026-11-15", now: NOW }), /en cours/);
  assert.throws(() => planDays({ days: 0, now: NOW }), /entier positif/);
  assert.throws(() => planDays({ days: 1.5, now: NOW }), /entier positif/);
  assert.throws(() => planDays({ from: "2020-01-01", to: "2021-12-31", now: NOW }), /Plage trop longue/);
  assert.equal(planDays({ from: "2020-01-01", to: "2020-01-02", now: NOW }).length, 2);
  assert.ok(MAX_DAYS >= 365);
});

test("DAILY_QUERIES : aucune colonne d'identité de personne, et les robots sont exclus des indicateurs", () => {
  assert.ok(Object.isFrozen(DAILY_QUERIES));
  for (const q of DAILY_QUERIES) {
    assert.doesNotMatch(q.sql, /user_id|owner_id|ip_hash|session|email/i, q.label);
  }
  const usable = DAILY_QUERIES.filter((q) => !/qualit/.test(q.label) && !/registered|published/.test(q.sql));
  for (const q of usable.filter((x) => x.sql.includes("ika_analytics_events"))) assert.match(q.sql, /not is_bot/, q.label);
  assert.ok(DAILY_QUERIES.find((q) => /bot/.test(q.sql)).sql.includes("is_bot"));
});

/** Base simulée : renvoie le verrou, les totaux attendu / observé et enregistre les écritures. */
function fakeDb({ lock = true, expected = 5, observed = 5 } = {}) {
  const writes = []; const checks = [];
  const tx = {
    async query(sql, params) {
      if (sql.includes("pg_try_advisory_xact_lock")) return [{ ok: lock }];
      if (sql.startsWith("delete from ika_agg_daily")) { writes.push(["delete", params]); return []; }
      if (sql.startsWith("insert into ika_agg_daily")) { writes.push(["insert", params]); return [{ 1: 1 }]; }
      if (sql.includes("from ika_analytics_events where") && sql.includes("count(*)")) return [{ n: expected }];
      if (sql.includes("from ika_agg_daily where day")) return [{ n: observed }];
      if (sql.startsWith("insert into ika_analytics_checks")) { checks.push(params); return []; }
      throw new Error("requête inattendue : " + sql.slice(0, 60));
    },
  };
  return { writes, checks, transaction: async (fn) => fn(tx) };
}

test("aggregateDay : recalcul idempotent d'un jour, contrôle consigné (cohérent)", async () => {
  const db = fakeDb({ expected: 5, observed: 5 });
  const r = await aggregateDay(db, "2026-11-14", { newId: (p) => `${p}-1` });
  assert.equal(r.ok, true);
  assert.equal(r.lines, DAILY_QUERIES.length);
  assert.deepEqual(db.writes[0], ["delete", ["2026-11-14", METHOD_VERSION]], "supprime d'abord la même version du jour");
  assert.equal(db.writes.filter((w) => w[0] === "insert").length, DAILY_QUERIES.length);
  assert.deepEqual(db.checks[0].slice(0, 5), ["ck-1", "2026-11-14", 5, 5, true]);
  assert.equal(db.checks[0][5], null);
});

test("aggregateDay : écart consigné avec consigne d'enquête ; verrou déjà pris → rien n'est écrit", async () => {
  const bad = fakeDb({ expected: 7, observed: 6 });
  const r = await aggregateDay(bad, "2026-11-14", { newId: (p) => p });
  assert.equal(r.ok, false);
  assert.equal(bad.checks[0][4], false);
  assert.match(bad.checks[0][5], /recalculer et enquêter/);
  const locked = fakeDb({ lock: false });
  const s = await aggregateDay(locked, "2026-11-14", { newId: (p) => p });
  assert.match(s.skipped, /autre agrégation/);
  assert.equal(locked.writes.length, 0);
});

test("fiche : titre et texte saisis sont échappés, aucun script en ligne, mention obligatoire présente", () => {
  const html = ficheHtml({
    geo: { polygon: { coordinates: [[[-7.99, 12.6], [-7.98, 12.6], [-7.98, 12.61], [-7.99, 12.6]]] }, point: { lat: 12.6, lng: -7.99 }, category: "Terrain", areaM2: 1234.5, perimeterM: 150, computedAt: "2026-11-14T08:00:00Z", isPublic: false },
    listing: { title: "<img src=x onerror=alert(1)>", neighborhood: "ACI 2000", city: "Bamako", surface_label: "500 m²" },
    generatedAt: NOW,
  });
  assert.ok(!html.includes("<img src=x"), "le titre n'est pas injecté tel quel");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.doesNotMatch(html, /<script>(?!<\/script>)/i);
  assert.equal((html.match(/<script/g) ?? []).length, 1, "un seul script : fiche.js");
  assert.ok(html.includes('src="/js/fiche.js"'));
  assert.ok(html.includes('content="noindex,nofollow"'));
  assert.ok(html.includes("Position affichée aux visiteurs</th><td>Non (privée)"));
  assert.match(html, /1\s234,5 m²/u, "superficie au format français (espace insécable)");
  assert.ok(html.includes("Sommets (latitude, longitude)"));
  assert.ok(html.includes("class=\"plan\""), "plan SVG présent avec 3 sommets ou plus");
  assert.ok(!html.includes("fond-carte"), "pas de fond Mapbox sans jeton");
  assert.ok(html.includes(MENTION_OBLIGATOIRE.slice(0, 40).replace(/'/g, "&#39;")) || html.includes(MENTION_OBLIGATOIRE.slice(0, 40)), "mention présente");
});

test("fondCarteUrl : null sans jeton ni géométrie ; contour ou point selon les données", () => {
  const square = [{ lat: 12.6, lng: -7.99 }, { lat: 12.6, lng: -7.98 }, { lat: 12.61, lng: -7.98 }];
  assert.equal(fondCarteUrl({ vertices: square, token: "" }), null);
  assert.equal(fondCarteUrl({ vertices: [], point: null, token: "t" }), null);
  const poly = fondCarteUrl({ vertices: square, token: "pk.x" });
  assert.match(poly, /^https:\/\/api\.mapbox\.com\/styles\/v1\/mapbox\/satellite-streets-v12\/static\/geojson\(/);
  assert.match(poly, /pin-s-1\+0b1f4b\(-7\.990000,12\.600000\)/);
  assert.match(poly, /access_token=pk\.x/);
  const pt = fondCarteUrl({ vertices: [], point: { lat: 12.6, lng: -7.99 }, token: "pk.x" });
  assert.match(pt, /pin-l\+dc2626\(-7\.990000,12\.600000\)\/-7\.990000,12\.600000,17\//);
});

test("planSvg : un repère par sommet, barre d'échelle et nord", () => {
  const svg = planSvg([{ lat: 12.6, lng: -7.99 }, { lat: 12.6, lng: -7.98 }, { lat: 12.61, lng: -7.98 }, { lat: 12.61, lng: -7.99 }]);
  assert.equal((svg.match(/class="plan-dot"/g) ?? []).length, 4);
  assert.match(svg, /class="plan-txt"[^>]*>\d+ m</);
  assert.match(svg, /N ↑/);
  assert.match(svg, /aria-label="Plan de la parcelle, 4 sommets"/);
});
