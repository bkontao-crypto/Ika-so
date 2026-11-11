// Nettoyage MANUEL des fichiers orphelins de stored_files. Simulation par défaut ; jamais appelé automatiquement.
//   Simulation :   DATABASE_URL=… node scripts/cleanup-orphan-files.mjs
//   Suppression :  DATABASE_URL=… node scripts/cleanup-orphan-files.mjs --apply --confirm=SUPPRIMER
// Options : --min-age-hours=72 (24 minimum)  --limit=200 (1000 maximum, un seul lot par exécution)
import { createDb } from "../server/db.js";
import { deleteOrphans, findOrphans, parseCleanupArgs } from "../server/lib/orphan-files.js";

let opts;
try {
  opts = parseCleanupArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[orphelins] ${error.message}`);
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[orphelins] DATABASE_URL est obligatoire.");
  process.exit(2);
}

const db = createDb(url);
try {
  const found = await findOrphans(db, opts);
  const kb = (n) => `${(n / 1024).toFixed(1)} Ko`;
  console.log(`[orphelins] ${found.totalCount} fichier(s) sans référence, âgés de plus de ${opts.minAgeHours} h (${kb(found.totalBytes)}).`);
  for (const f of found.candidates.slice(0, 20)) console.log(`  ${f.id}  ${f.mime_type}  ${kb(f.file_size)}  ${new Date(f.created_at).toISOString()}`);
  if (found.candidates.length > 20) console.log(`  … et ${found.candidates.length - 20} autre(s) dans ce lot.`);
  if (!opts.apply) {
    console.log("[orphelins] SIMULATION : rien n'a été supprimé. Relisez la liste, vérifiez une sauvegarde, puis relancez avec --apply --confirm=SUPPRIMER.");
  } else {
    const done = await deleteOrphans(db, { ...opts, actor: "cli" });
    console.log(`[orphelins] supprimé : ${done.deletedCount} fichier(s), ${kb(done.deletedBytes)} (trace ORPHAN_FILES_DELETE dans ika_audit).`);
    if (found.totalCount > done.deletedCount) console.log("[orphelins] il en reste : relancez la simulation pour le lot suivant.");
  }
} catch (error) {
  console.error("[orphelins] échec :", error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
