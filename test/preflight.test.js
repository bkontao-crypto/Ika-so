// Contrôle de configuration avant mise en ligne (fonction pure) : cas liés à l'incohérence « production sur poste local ».
import test from "node:test";
import assert from "node:assert/strict";
import { getConfig } from "../server/config.js";
import { checkEnvironment } from "../server/lib/preflight.js";

const codes = (env) => checkEnvironment(getConfig(env), env).map((f) => `${f.level}:${f.code}`);

test("hors production : un seul avis « mode local », rien d'autre", () => {
  assert.deepEqual(codes({ NODE_ENV: "development", DATABASE_URL: "postgresql://u:p@localhost:5432/ika" }), ["attention:MODE_LOCAL"]);
});

test("production + base sur localhost : avertissement BASE_LOCALE (non bloquant)", () => {
  const found = codes({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost:5432/ika_so_dev", TRUST_PROXY: "1" });
  assert.ok(found.includes("attention:BASE_LOCALE"));
  assert.ok(!found.includes("bloquant:DATABASE_SSL"));
});

test("production + base distante sans SSL : bloquant, pas d'avertissement BASE_LOCALE", () => {
  const found = codes({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db.example:5432/ika", TRUST_PROXY: "1" });
  assert.ok(found.includes("bloquant:DATABASE_SSL"));
  assert.ok(!found.includes("attention:BASE_LOCALE"));
});

test("production : TRUST_PROXY absent et démo OTP sont bloquants", () => {
  const found = codes({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost/x", ALLOW_DEMO_OTP: "true" });
  assert.ok(found.includes("bloquant:TRUST_PROXY"));
  assert.ok(found.includes("bloquant:DEMO_OTP"));
});

test("production : le faux fournisseur de paiement est bloquant", () => {
  const found = codes({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost/x", TRUST_PROXY: "1", PAYMENT_PROVIDER: "fake", PAYMENT_WEBHOOK_SECRET: "x".repeat(30) });
  assert.ok(found.includes("bloquant:PAIEMENT_FAKE"));
});

test("modèle .env.example : valeurs par défaut sûres pour un poste local", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseEnv } = await import("node:util");
  const env = parseEnv(readFileSync(new URL("../.env.example", import.meta.url), "utf8"));
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.TRUST_PROXY, "0");
  assert.equal(env.ANALYTICS_ENABLED, "false");
  assert.ok(!("SESSION_SECRET" in env), "variable inutilisée par le code");
  assert.ok(!/[0-9a-f]{32}-[0-9a-f]{8}-/.test(readFileSync(new URL("../.env.example", import.meta.url), "utf8")), "aucune clé réelle dans le modèle");
});
