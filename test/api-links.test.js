// Garde-fou : chaque appel api("/…") écrit dans le front (public/js) doit correspondre à une route réelle du serveur (méthode + chemin).
// Détecte un écran branché sur une route supprimée ou mal orthographiée ; ne contrôle pas le contenu des réponses.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const routes = [...fs.readFileSync(path.join(root, "server/routes/index.js"), "utf8").matchAll(/router\.(get|post|put|delete|patch)\(\s*"([^"]+)"/g)].map((m) => [m[1].toUpperCase(), m[2]]);
const seg = (p) => p.split("/").filter(Boolean);
const exists = (method, p) => routes.some(([rm, rp]) => rm === method && seg(rp).length === seg(p).length && seg(rp).every((s, i) => s.startsWith(":") || seg(p)[i].startsWith(":") || s === seg(p)[i]));

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) return /vendor|downloads/.test(p) ? [] : files(p);
    return p.endsWith(".js") ? [p] : [];
  });
}

test("tous les appels api() du front ont une route serveur", () => {
  const missing = [];
  let checked = 0;
  for (const f of files(path.join(root, "public/js"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bapi\(\s*([`"'])([^`"']+?)\1\s*(,\s*\{[^)]{0,300})?/g)) {
      let p = m[2];
      const open = p.indexOf("${");
      if (open !== -1 && !p.slice(open).includes("}")) p = p.slice(0, open);
      p = p.replace(/\$\{[^}]*\}/g, ":p").split("?")[0];
      if (!p.startsWith("/")) continue;
      const method = (/method:\s*"(\w+)"/.exec(m[3] ?? "")?.[1] ?? "GET").toUpperCase();
      checked++;
      if (!exists(method, p)) missing.push(`${method} ${p} (${path.relative(root, f)})`);
    }
  }
  assert.ok(checked > 200, `trop peu d'appels analysés (${checked})`);
  assert.deepEqual([...new Set(missing)], []);
});
