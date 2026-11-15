// BUG-002 : chaque migration (017 et suivantes) doit avoir un script de retour arrière correct.
// Test statique, sans base de données. Le contenu des scripts a été validé sur un vrai PostgreSQL (voir Important/SUIVI.md).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const migDir = new URL("../migrations/", import.meta.url);
const rbDir = new URL("../scripts/rollback/", import.meta.url);
const migrations = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
const rollbacks = readdirSync(rbDir).filter((f) => f.endsWith("_down.sql")).sort();

// Socle volontairement SANS script : 001-015 (utilisateurs, annonces, paiements...) et 016 (nom du client sur les factures,
// état des suppressions de compte : données comptables et légales). Leur seul retour sûr est la restauration d'une sauvegarde.
const SANS_SCRIPT = new Set(Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(3, "0")));
const num = (f) => f.slice(0, 3);

test("chaque migration à partir de 017 a son script de retour arrière", () => {
  const manquants = migrations.filter((m) => !SANS_SCRIPT.has(num(m)) && !rollbacks.includes(m.replace(/\.sql$/, "_down.sql")));
  assert.deepEqual(manquants, [], "migrations sans scripts/rollback/<nom>_down.sql (voir scripts/rollback/LISEZ-MOI.md)");
});

test("aucun script de retour arrière orphelin (migration inexistante)", () => {
  const orphelins = rollbacks.filter((r) => !migrations.includes(r.replace(/_down\.sql$/, ".sql")));
  assert.deepEqual(orphelins, []);
});

test("chaque script efface sa ligne dans _migrations (sinon npm run migrate ne peut pas la rejouer)", () => {
  const fautifs = [];
  for (const r of rollbacks) {
    const mig = r.replace(/_down\.sql$/, ".sql");
    if (num(r) < "017") continue;
    const sql = readFileSync(new URL(r, rbDir), "utf8");
    if (!sql.includes(`delete from _migrations where name = '${mig}'`)) fautifs.push(r);
  }
  assert.deepEqual(fautifs, []);
});

test("les scripts à plusieurs instructions sont dans une transaction (tout ou rien)", () => {
  const fautifs = [];
  for (const r of rollbacks.filter((x) => num(x) >= "059" || (num(x) >= "017" && num(x) <= "019") || (num(x) >= "029" && num(x) <= "057"))) {
    const sql = readFileSync(new URL(r, rbDir), "utf8").toLowerCase();
    if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) fautifs.push(r);
  }
  // les scripts antérieurs à BUG-002 (039-045, 050, 051, 058) n'ont pas de transaction : ils ne sont pas réécrits ici
  const anciens = new Set(["039", "042", "043", "044", "045", "050", "051"]);
  assert.deepEqual(fautifs.filter((f) => !anciens.has(num(f))), []);
});

test("aucun script n'utilise cascade (une dépendance inattendue doit bloquer, pas tout supprimer)", () => {
  const fautifs = rollbacks.filter((r) => /\bcascade\b/i.test(readFileSync(new URL(r, rbDir), "utf8").replace(/--.*$/gm, "").replace(/on delete cascade/gi, "")));
  assert.deepEqual(fautifs, []);
});
