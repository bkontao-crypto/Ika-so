// Boîte : filtre « Du … au … » commun aux alertes, messages et visites (dates inclusives, heure locale).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/pages/inbox.js", import.meta.url), "utf8");

test("le filtre de dates est branché sur les trois onglets", () => {
  assert.match(src, /return okF && okQ && inRange\(n\.createdAt\)/);
  assert.match(src, /inRange\(t\.lastMessageAt\)/);
  assert.match(src, /visits\.filter\(\(v\) => inRange\(v\.proposedAt\)\)/);
  assert.match(src, /type: "date"/);
  assert.match(src, /Effacer les dates/);
});
test("les bornes sont inclusives (jour local entier)", () => {
  assert.match(src, /T00:00:00/); assert.match(src, /T23:59:59\.999/);
});
test("une seule implémentation du filtre (pas de doublon)", () => assert.equal((src.match(/const inRange =/g) ?? []).length, 1));
