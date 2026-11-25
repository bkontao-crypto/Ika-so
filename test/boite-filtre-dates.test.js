// Boîte > Alertes : filtre « Du … au … » (dates inclusives, heure locale, bornes inversées échangées).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/pages/inbox.js", import.meta.url), "utf8");

test("le filtre de dates est branché sur la liste des alertes", () => {
  assert.match(src, /let dateFrom = ""; let dateTo = "";/);
  assert.match(src, /return okF && okQ && inRange\(n\.createdAt\)/);
  assert.match(src, /type: "date"/);
  assert.match(src, /Effacer les dates/);
});
test("les bornes sont inclusives et échangées si inversées", () => {
  assert.match(src, /if \(a && b && a > b\) \[a, b\] = \[b, a\]/);
  assert.match(src, /T00:00:00/); assert.match(src, /T23:59:59\.999/);
});
