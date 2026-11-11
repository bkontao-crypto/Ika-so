// Agrégation journalière des statistiques : MANUELLE. Simulation par défaut ; jamais appelée automatiquement.
//   Simulation :  DATABASE_URL=… node scripts/aggregate.mjs                       (3 derniers jours complets)
//   Écriture :    DATABASE_URL=… node scripts/aggregate.mjs --apply
//   Plage :       DATABASE_URL=… node scripts/aggregate.mjs --from=2026-11-01 --to=2026-11-05 --apply
//   Options :     --days=N (défaut 3, jours complets, le jour en cours est exclu)
// Réécrit seulement les lignes de ces jours (même version de méthode) : sans risque pour les événements bruts. Aucune donnée personnelle.
import { MAX_DAYS, aggregateDay, planDays, simulateDay } from "../server/lib/aggregation.js";

const args = process.argv.slice(2);
const known = ["--apply", "--days=", "--from=", "--to="];
const unknown = args.filter((a) => !known.some((k) => a === k || (k.endsWith("=") && a.startsWith(k))));
if (unknown.length) { console.error(`[agrégation] option inconnue : ${unknown[0]}`); process.exit(2); }
const opt = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const apply = args.includes("--apply");
let days;
try { days = planDays({ from: opt("--from"), to: opt("--to"), days: opt("--days") ?? 3 }); } catch (error) { console.error(`[agrégation] ${error.message} (plage maximale : ${MAX_DAYS} jours)`); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error("[agrégation] DATABASE_URL est obligatoire."); process.exit(2); }

// Import tardif : les contrôles ci-dessus répondent sans base ni pilote.
const { createDb } = await import("../server/db.js");
const { newId } = await import("../server/lib/security.js");
const db = createDb(process.env.DATABASE_URL);
try {
  for (const day of days) {
    if (!apply) {
      const parts = await simulateDay(db, day);
      console.log(`${day} : ${parts.map((p) => `${p.label}=${p.lines} ligne(s)`).join(" ; ")}`);
    } else {
      const r = await aggregateDay(db, day, { newId });
      console.log(r.skipped ? `${day} : ignoré — ${r.skipped}` : `${day} : ${r.lines} ligne(s) écrite(s), contrôle ${r.ok ? "OK" : "ÉCART"} (attendu ${r.expected}, obtenu ${r.observed})`);
      if (r.ok === false) process.exitCode = 1;
    }
  }
  if (!apply) console.log("[agrégation] SIMULATION : rien n'a été écrit. Ajoutez --apply pour écrire.");
} catch (error) {
  console.error("[agrégation] échec :", error.message);
  process.exitCode = 1;
} finally {
  await db.close?.();
}
