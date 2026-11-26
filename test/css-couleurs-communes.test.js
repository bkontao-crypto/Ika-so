// Lot B1 : la palette principale n'est définie qu'à un seul endroit, tokens.css.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8");
const tokens = lire("css/tokens.css");
const refonte = lire("css/refonte.css");

test("chaque couleur commune utilisée est définie dans tokens.css", () => {
  const definies = new Set([...tokens.matchAll(/(--is-[\w-]+):/g)].map((m) => m[1]));
  const utilisees = [...refonte.matchAll(/var\((--is-[\w-]+)\)/g)].map((m) => m[1]);
  assert.ok(utilisees.length > 20);
  assert.deepEqual(utilisees.filter((n) => !definies.has(n)), []);
});

test("les blocs de variables de refonte.css ne contiennent plus de couleur écrite en dur", () => {
  const blocs = [...refonte.matchAll(/^:root[^{]*\{([^}]*)\}/gm)].slice(0, 2);
  for (const [, corps] of blocs) assert.doesNotMatch(corps, /--(?!shadow|ring)[\w-]+:\s*(#|rgba?\()/);
});

test("tokens.css est chargé avant les autres feuilles et disponible hors connexion", () => {
  const page = lire("index.html");
  assert.ok(page.indexOf("/css/tokens.css") > 0 && page.indexOf("/css/tokens.css") < page.indexOf("/css/ika.css"));
  assert.match(lire("sw.js"), /"\/css\/tokens\.css"/);
});

test("modern.css ne redéfinit plus la palette commune (lot B2)", () => {
  assert.doesNotMatch(lire("css/modern.css"), /(^|[;{\s])--(green|green-2|green-soft|gold|gold-soft|ink|muted|line|surface|page)\s*:/);
});

test("lot B3 : pages SEO, fiche, retour Google et pages isolées chargent la palette commune", () => {
  const source = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  for (const f of ["server/seo/render.js", "server/lib/fiche.js", "server/lib/google-oauth.js", "public/crm-leads.html", "public/admin-audit.html"]) {
    assert.match(source(f), /\/css\/tokens\.css/, f);
  }
  assert.doesNotMatch(lire("css/fiche.css"), /#1559bd|#102b55/i);
  assert.doesNotMatch(lire("css/seo.css").split("html { background")[0], /--s-(bg|ink|link|btn|line|muted):\s*#/);
});
