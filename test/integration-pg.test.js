// Intégration RÉELLE : PostgreSQL + Express, sans fausse base.
// Ignoré tant que DATABASE_URL_TEST est absent (poste de travail) ; la CI (.github/workflows/ci.yml) le fournit.
// Garde-fou : le nom de la base doit contenir « test », pour ne jamais migrer ou interroger une base de travail.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readdir } from "node:fs/promises";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test d'intégration PostgreSQL ignoré.";

function guard() {
  const name = new URL(url).pathname.replace(/^\//, "");
  assert.match(name, /test/i, `Base « ${name} » refusée : DATABASE_URL_TEST doit viser une base dont le nom contient « test ».`);
}

test("PostgreSQL : les migrations s'appliquent, puis une seconde exécution ne fait rien", { skip }, async () => {
  guard();
  const { createDb } = await import("../server/db.js");
  const { migrate, MIGRATIONS_DIR } = await import("../server/migrate.js");
  const db = createDb(url);
  try {
    const files = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith(".sql"));
    await migrate(db, () => {});
    assert.deepEqual(await migrate(db, () => {}), [], "une 2e exécution ne doit rien appliquer");
    const [row] = await db.query("select count(*)::int as n from _migrations");
    assert.equal(row.n, files.length, "chaque fichier de migrations est enregistré une fois");
  } finally { await db.close(); }
});

test("PostgreSQL : tout objet SQL cité par le code existe après migration", { skip }, async () => {
  guard();
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const db = createDb(url);
  try {
    await migrate(db, () => {});
    const tables = ["ika_listings", "ika_profiles", "ika_threads", "ika_messages", "ika_payments", "ika_security_log", "ika_proofs", "stored_files", "ika_settings"];
    const rows = await db.query("select name, to_regclass(name) is not null as ok from unnest($1::text[]) as name", [tables]);
    assert.deepEqual(rows.filter((r) => !r.ok).map((r) => r.name), []);
    const fn = await db.query("select 1 from pg_proc where proname = 'ika_norm'");
    assert.equal(fn.length, 1, "fonction de recherche ika_norm");
    const seq = await db.query("select 1 from pg_class where relkind = 'S' and relname = 'ika_invoice_seq'");
    assert.equal(seq.length, 1, "séquence des factures");
  } finally { await db.close(); }
});

test("HTTP réel : santé, annonces publiques, 404 JSON, CSRF, en-têtes", { skip }, async () => {
  guard();
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const db = createDb(url);
  let server;
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: url, BOOTSTRAP_ADMIN: "false" });
    const services = createServices({ db, config, sendSms: async () => ({}) });
    const app = createApp({ services, config, health: () => db.query("select 1") });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = (path) => fetch(base + path);

    const health = await get("/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    assert.match(health.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");

    const listings = await get("/api/listings");
    assert.equal(listings.status, 200);
    assert.ok(Array.isArray(await listings.json()));

    const settings = await get("/api/platform-settings");
    assert.equal(settings.status, 200);
    assert.equal(typeof (await settings.json()).platformName, "string");

    const missing = await get("/api/route-inconnue");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Introuvable." });

    const csrf = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    assert.equal(csrf.status, 403, "un corps non JSON est refusé avant toute logique métier");

    const anonymous = await fetch(base + "/api/me/favorites");
    assert.equal(anonymous.status, 401, "route privée sans session");
  } finally {
    if (server) { server.close(); await once(server, "close").catch(() => {}); }
    await db.close();
  }
});
