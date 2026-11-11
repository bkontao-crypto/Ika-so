// Avant de mettre en ligne : node scripts/check-env.mjs  (lit les variables d'environnement, ne se connecte à rien, n'affiche aucun secret)
import { getConfig } from "../server/config.js";
import { checkEnvironment, formatReport } from "../server/lib/preflight.js";

let findings;
try { findings = checkEnvironment(getConfig(process.env), process.env); }
catch (error) { console.error(`BLOQUANT  configuration illisible — ${error.message}`); process.exit(1); }
console.log(formatReport(findings));
process.exit(findings.some((f) => f.level === "bloquant") ? 1 : 0);
