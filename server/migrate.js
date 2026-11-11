// Applique les migrations en attente (migrations/*.sql, par ordre de nom), une transaction par fichier.
// Usage : DATABASE_URL=… node server/migrate.js
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Fichiers .sql pas encore appliqués, triés par nom. */
export function pendingMigrations(files, applied) {
  const done = new Set(applied);
  return files
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .filter((name) => !done.has(name));
}

/** `db` : l'objet de createDb() (query + transaction). Renvoie les noms appliqués. */
export async function migrate(db, log = console.log, dir = MIGRATIONS_DIR) {
  await db.query(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = await readdir(dir);
  const applied = [];
  for (const name of pendingMigrations(files, (await db.query("select name from _migrations")).map((r) => r.name))) {
    const text = await readFile(join(dir, name), "utf8");
    try {
      await db.transaction(async (tx) => {
        // Un seul migrateur à la fois, même si deux instances démarrent ensemble ; on revérifie sous verrou.
        await tx.query("select pg_advisory_xact_lock(727001)");
        const already = await tx.query("select 1 from _migrations where name = $1", [name]);
        if (already.length) return;
        await tx.query(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
        applied.push(name);
      });
    } catch (error) {
      error.message = `Migration ${name} : ${error.message}`;
      throw error;
    }
    if (applied.includes(name)) log(`[migrate] appliquée : ${name}`);
  }
  log(applied.length ? `[migrate] ${applied.length} migration(s) appliquée(s).` : "[migrate] à jour.");
  return applied;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL est obligatoire.");
    process.exit(1);
  }
  const { createDb } = await import("./db.js");
  const db = createDb(url);
  try {
    await migrate(db);
  } catch (error) {
    console.error("[migrate] échec :", error.message);
    for (const key of ["code", "detail", "hint", "position"]) {
      if (error[key] != null) console.error(`[migrate]   ${key} : ${error[key]}`);
    }
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
