// BUG-003 lot 3 : server/lib/csv.js (import d'annonces) et server/lib/logger.js (journaux). Sans base de données.
import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, csvToListings, csvTemplate, CSV_COLUMNS, IMPORT_MAX_ROWS } from "../server/lib/csv.js";
import { createLogger, requestLogger, createCounters } from "../server/lib/logger.js";

test("parseCsv : séparateur « ; » ou « , », guillemets, guillemets doublés, retours à la ligne, BOM, lignes vides ignorées", () => {
  assert.deepEqual(parseCsv("﻿a;b\n1;2\n\n3;4\r\n"), [["a", "b"], ["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv('t;"x; y ""z""";2\n"ligne\nsuite";k'), [["t", 'x; y "z"', "2"], ["ligne\nsuite", "k"]]);
  assert.deepEqual(parseCsv(null), []);
});

test("csvTemplate : le modèle officiel passe toutes les règles (aller-retour)", () => {
  const { items, problems } = csvToListings(csvTemplate(), { fullName: "Agence Test" });
  assert.deepEqual(problems, []);
  assert.equal(items.length, 2);
  assert.equal(items[0].input.category, "Terrain");
  assert.equal(items[0].input.roadAccess !== undefined, true);
  assert.equal(items[1].input.furnished, true);
  assert.equal(items[1].input.bedrooms, 3);
  assert.equal(items[0].input.fullName, "Agence Test");
  assert.equal(items[0].line, 2);
  assert.equal(items[1].line, 3);
  assert.equal(CSV_COLUMNS.length, 13);
});

test("csvToListings : en-tête vide ou colonnes obligatoires absentes", () => {
  assert.equal(csvToListings("titre;prix").problems[0].message, "Le fichier est vide ou n'a pas de ligne d'en-tête.");
  const r = csvToListings("titre;prix\nA;100");
  assert.match(r.problems[0].message, /^Colonnes obligatoires absentes : category, transactionType, neighborhood\.$/);
  assert.equal(r.items.length, 0);
});

test("csvToListings : colonne inconnue signalée mais non bloquante ; limite de lignes", () => {
  const head = "titre;type;transaction;quartier;prix;inconnue";
  const ok = csvToListings(`${head}\nA;Terrain;Vente;ACI 2000;100;x`);
  assert.match(ok.problems[0].message, /Colonne\(s\) inconnue\(s\), ignorée\(s\) : inconnue\./);
  assert.equal(ok.items.length, 1);
  const many = ["titre;type;transaction;quartier;prix", ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `A${i};Terrain;Vente;ACI 2000;${i + 1}`)].join("\n");
  const r = csvToListings(many);
  assert.equal(r.items.length, 0);
  assert.match(r.problems[0].message, /^Trop de lignes : 200 au plus/);
});

test("csvToListings : valeurs inconnues signalées ligne par ligne, prix invalide accepté en NaN pour refus ultérieur", () => {
  const text = "titre;type;transaction;quartier;prix;document;acces routier\nA;Bateau;Achat;Quartier inconnu;abc;Papier magique;Route fantôme";
  const { items, problems } = csvToListings(text);
  assert.equal(items.length, 1);
  assert.equal(items[0].input.category, "");
  assert.equal(items[0].input.transactionType, "");
  assert.ok(Number.isNaN(items[0].input.price));
  const msg = problems.find((p) => p.line === 2).message;
  assert.match(msg, /type « Bateau » inconnu/);
  assert.match(msg, /transaction « Achat » inconnue/);
  assert.match(msg, /document « Papier magique » inconnu/);
  assert.equal(items[0].input.neighborhood, "Quartier inconnu");
});

test("logger : niveaux, champs sensibles retirés, sortie JSON", () => {
  const lines = [];
  const log = createLogger({ level: "warn", write: (l) => lines.push(l), now: () => new Date("2026-11-15T10:00:00Z") });
  log.info("ignoré");
  log.warn("attention", { ip: "1.2.3.4", Cookie: "x", password: "p", email: "a@b", token: "t", route: "/x" });
  log.error("grave", { status: 500 });
  assert.equal(lines.length, 2);
  const warn = JSON.parse(lines[0]);
  assert.deepEqual(warn, { ts: "2026-11-15T10:00:00.000Z", level: "warn", msg: "attention", route: "/x" });
});

test("logger : seules les erreurs partent vers les services de suivi, et une panne du service n'arrête rien", async () => {
  const sent = [];
  const sinks = [(e) => sent.push(e.msg), () => Promise.reject(new Error("panne"))];
  const log = createLogger({ level: "debug", write: () => {}, sinks });
  log.info("info");
  log.warn("warn");
  log.error("erreur");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, ["erreur"]);
});

test("requestLogger : identifiant, en-tête, niveau selon le statut, chemin sans paramètres", () => {
  const lines = [];
  const logger = createLogger({ level: "debug", write: (l) => lines.push(JSON.parse(l)) });
  const counters = createCounters();
  const mw = requestLogger(logger, counters);
  const listeners = {};
  const res = { statusCode: 503, setHeader(k, v) { this.h = [k, v]; }, on(ev, fn) { listeners[ev] = fn; } };
  const req = { method: "GET", originalUrl: "/api/annonces?page=2&q=secret" };
  let nextCalled = false;
  mw(req, res, () => { nextCalled = true; });
  assert.ok(nextCalled);
  assert.match(req.id, /^[0-9a-f]{8}$/);
  assert.deepEqual(res.h, ["X-Request-Id", req.id]);
  listeners.finish();
  assert.equal(counters.requests, 1);
  assert.equal(counters.errors5xx, 1);
  assert.equal(lines[0].level, "error");
  assert.equal(lines[0].path, "/api/annonces");
  assert.equal(lines[0].status, 503);
  assert.ok(!JSON.stringify(lines[0]).includes("secret"), "aucun paramètre de requête dans le journal");
  assert.equal(createCounters().errors5xx, 0);
});
