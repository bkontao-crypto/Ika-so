// Journaux structurés : une ligne JSON par événement, sur la sortie standard (l'hébergeur les collecte).
// Règle de l'ordonnance : jamais d'adresse IP, de cookie, de mot de passe ni de contenu de requête dans les journaux.
import { randomUUID } from "node:crypto";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const FORBIDDEN = /^(ip|cookie|authorization|password|motdepasse|token|phone|email)$/i;

export function createLogger({ level = "info", write = (line) => process.stdout.write(`${line}\n`), now = () => new Date(), sinks = [] } = {}) {
  const min = LEVELS[level] ?? LEVELS.info;
  function log(lvl, msg, fields = {}) {
    if (LEVELS[lvl] < min) return;
    const safe = {};
    for (const [key, value] of Object.entries(fields)) if (!FORBIDDEN.test(key)) safe[key] = value;
    const event = { ts: now().toISOString(), level: lvl, msg, ...safe };
    write(JSON.stringify(event));
    // Services de suivi branchés (facultatif) : seulement les erreurs, sans attendre, sans jamais échouer.
    if (lvl === "error") for (const sink of sinks) Promise.resolve(sink(event)).catch(() => undefined);
  }
  return {
    debug: (m, f) => log("debug", m, f),
    info: (m, f) => log("info", m, f),
    warn: (m, f) => log("warn", m, f),
    error: (m, f) => log("error", m, f),
  };
}

/** Compteurs en mémoire (jamais stockés) pour /api/health : aide à voir si les erreurs montent. */
export function createCounters() {
  const c = { requests: 0, errors5xx: 0, clientErrors: 0, since: new Date().toISOString() };
  return c;
}

/** Journal de chaque requête /api : méthode, chemin sans paramètres, statut, durée, identifiant de requête. */
export function requestLogger(logger, counters) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    req.id = randomUUID().slice(0, 8);
    res.setHeader("X-Request-Id", req.id);
    res.on("finish", () => {
      counters.requests += 1;
      if (res.statusCode >= 500) counters.errors5xx += 1;
      const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
      const lvl = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      logger[lvl]("requete", { id: req.id, method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms });
    });
    next();
  };
}
