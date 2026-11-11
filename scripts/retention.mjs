// Conservation des données : MANUEL. Simulation par défaut ; jamais appelé automatiquement.
//   Simulation :   DATABASE_URL=… node scripts/retention.mjs
//   Suppression :  DATABASE_URL=… node scripts/retention.mjs --apply --confirm=PURGER
// Durées : server/lib/retention.js (décision par défaut, à valider par un juriste malien). Faites une sauvegarde AVANT --apply.
import { RETENTION_CONFIRM_WORD, applyRetention, planRetention } from "../server/lib/retention.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirm = args.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";
const unknown = args.filter((a) => a !== "--apply" && !a.startsWith("--confirm="));
if (unknown.length) { console.error(`[conservation] option inconnue : ${unknown[0]}`); process.exit(2); }
if (apply && confirm !== RETENTION_CONFIRM_WORD) { console.error(`[conservation] suppression refusée : ajoutez --confirm=${RETENTION_CONFIRM_WORD} après avoir relu la simulation et vérifié une sauvegarde.`); process.exit(2); }
if (!apply && confirm) { console.error("[conservation] --confirm n'a de sens qu'avec --apply."); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error("[conservation] DATABASE_URL est obligatoire."); process.exit(2); }

// Import tardif : les garde-fous ci-dessus répondent sans avoir besoin de la base ni de son pilote.
const { createDb } = await import("../server/db.js");
const db = createDb(process.env.DATABASE_URL);
try {
  const plan = await planRetention(db);
  for (const p of plan) console.log(`  ${String(p.count).padStart(6)}  ${p.label}`);
  if (!apply) console.log("[conservation] SIMULATION : rien n'a été supprimé.");
  else {
    const done = await applyRetention(db, { actor: "cli" });
    console.log(`[conservation] supprimé : ${done.map((d) => `${d.key}=${d.count}`).join(", ")}. Trace RETENTION_PURGE dans ika_audit.`);
    console.log("[conservation] pensez à lancer ensuite : node scripts/cleanup-orphan-files.mjs (photos des annonces supprimées).");
  }
} catch (error) {
  console.error("[conservation] échec :", error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
