// Étape 1 : le plan du site et la matrice des droits restent alignés sur le code (aucun écran ni module oublié, aucun champ vide).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const sitemap = JSON.parse(read("docs/etape-1/sitemap.json"));
const matrix = JSON.parse(read("docs/etape-1/matrice-owner-center.json"));
const FIELDS = ["id", "title", "route", "status", "need", "journey", "source", "rights", "step"];

test("chaque écran a un besoin, un parcours, une source et des droits (aucun champ vide, identifiants uniques)", () => {
  assert.ok(sitemap.length >= 30);
  const ids = new Set();
  for (const s of sitemap) {
    for (const f of FIELDS) assert.ok(typeof s[f] === "string" && s[f].trim().length >= (f === "route" ? 2 : 3), `${s.id ?? "?"} : champ « ${f} » vide`);
    assert.ok(["Existant", "À refondre", "À créer"].includes(s.status), `${s.id} : statut ${s.status}`);
    assert.match(s.step, /^E\d{2}$/, `${s.id} : étape`);
    assert.ok(!ids.has(s.id), `identifiant en double ${s.id}`);
    ids.add(s.id);
  }
});

test("chaque route d'écran du code (app.js) apparaît dans le plan du site", () => {
  const app = read("public/js/app.js");
  const routes = [...app.matchAll(/^\s*\[\/\^[^\n]*?,\s*"([a-z0-9-]+)",\s*"[A-Za-z0-9_]+"\]/gm)].map((m) => m[1]);
  assert.ok(routes.length >= 20, `routes trouvées : ${routes.length}`);
  const sources = sitemap.map((s) => s.source).join(" ");
  const missing = [...new Set(routes)].filter((m) => !sources.includes(`${m}.js`));
  assert.deepEqual(missing, [], "modules d'écran absents du plan du site");
});

test("les fichiers cités comme source existent (public/ ou server/)", () => {
  const dirs = ["public/js/pages", "public/js", "public", "public/css", "public/js/owner", "public/js/components", "server/lib", "server/services"];
  const missing = [];
  for (const s of sitemap) for (const f of s.source.match(/[A-Za-z0-9_-]+\.(?:js|html|css)\b/g) ?? []) if (!dirs.some((d) => existsSync(join(ROOT, d, f)))) missing.push(`${s.id}:${f}`);
  assert.deepEqual(missing, []);
});

test("la matrice de l'Owner Center couvre exactement les segments /staff/owner/* du code, avec un accès et une raison", () => {
  const routes = read("server/routes/index.js");
  const segs = new Set([...routes.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*"\/staff\/owner\/([^"/]+)/g)].map((m) => m[1]));
  const mods = new Set(matrix.modules.map((m) => m.segment));
  assert.deepEqual([...segs].filter((s) => !mods.has(s)), [], "segments du code absents de la matrice");
  assert.deepEqual([...mods].filter((s) => !segs.has(s)), [], "modules de la matrice absents du code");
  assert.equal(mods.size, matrix.modules.length, "segment en double");
  for (const m of matrix.modules) { assert.ok(["delegable", "superadmin"].includes(m.access), m.segment); assert.ok(m.why.length > 10, m.segment); }
});

test("modules sensibles : sauvegarde, restauration, offres, réglages, marque, légal restent réservés au Superadmin", () => {
  const sensitive = ["backup", "backups", "restores", "offers", "settings", "logo", "legal", "countries", "security-log"];
  for (const seg of sensitive) assert.equal(matrix.modules.find((m) => m.segment === seg)?.access, "superadmin", seg);
});

test("les documents annoncent les mêmes totaux que la matrice", () => {
  const n = matrix.modules.length; const sup = matrix.modules.filter((m) => m.access === "superadmin").length;
  const line = `**${n - sup} modules délégables, ${sup} réservés au Superadmin** (total ${n}`;
  assert.ok(read("docs/etape-1/MATRICE_DROITS.md").includes(line), "MATRICE_DROITS.md");
  assert.ok(read("docs/etape-1/COMPARATIFS_ET_DECISIONS.md").includes(`${n - sup} modules délégables, ${sup} réservés au Superadmin`), "COMPARATIFS_ET_DECISIONS.md");
});
