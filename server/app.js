import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, badRequest, unauthorized } from "./lib/errors.js";
import { createRateLimiter, parseCookies } from "./lib/security.js";
import { SESSION_COOKIE, clearedSessionCookie, securityHeaders, sameOriginOnly, sessionCookie } from "./lib/web.js";
import { createCounters, createLogger, requestLogger } from "./lib/logger.js";
import { buildRoutes } from "./routes/index.js";
import { buildSeoRoutes } from "./routes/seo.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

export function createApp({ services, config, logger = createLogger({ level: "error" }), health = async () => undefined }) {
  const app = express();
  const counters = createCounters();
  app.disable("x-powered-by");
  // Nombre de sauts de proxys de confiance (1 sur Render) ; false = lire l'adresse de la connexion elle-même.
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  const limiter = createRateLimiter();

  app.use("/api", requestLogger(logger, counters));
  app.use(securityHeaders(config));
  // Les agrégateurs de paiement (CinetPay, PayDunya) notifient en formulaire (application/x-www-form-urlencoded) : on garde le texte exact
  // de CETTE seule route, petit et borné. Le contenu n'est jamais cru tel quel : le fournisseur est ensuite interrogé pour confirmation.
  app.use("/api/payments/webhook", (req, res, next) => {
    if (req.method !== "POST" || !/application\/x-www-form-urlencoded/i.test(String(req.headers["content-type"] ?? ""))) return next();
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 32_768) { req.removeAllListeners("data"); req.resume(); return next(badRequest("Notification trop volumineuse.")); } chunks.push(c); });
    req.on("end", () => { if (size <= 32_768) { req.rawBody = Buffer.concat(chunks).toString("utf8"); req.body = {}; next(); } });
    req.on("error", () => next(badRequest("Notification illisible.")));
  });
  // Le texte exact reçu est gardé (req.rawBody) : la signature des paiements se calcule dessus.
  app.use(express.json({ limit: "3mb", verify: (req, res, buf) => { req.rawBody = buf.toString("utf8"); } }));
  app.use(sameOriginOnly);

  // Un caractère nul (%00) n'a aucune raison d'exister dans une requête, et PostgreSQL le refuse : réponse nette 400, pas une erreur serveur.
  app.use("/api", (req, res, next) => {
    let raw = "";
    try { raw = decodeURIComponent(req.originalUrl); } catch { /* adresse mal encodée : traitée plus loin */ }
    if (raw.includes("\u0000") || (req.rawBody ?? "").includes("\\u0000")) return next(badRequest("Caractère interdit dans la demande."));
    next();
  });

  // Limite générale par adresse, gardée en mémoire seulement (jamais stockée ni journalisée).
  // Les images ont leur propre compteur, plus large : une page d'annonces en charge une dizaine à la fois,
  // elles ne doivent pas épuiser le quota des vraies actions (connexion, publication, messages).
  app.use("/api", (req, res, next) => {
    try {
      if (String(req.originalUrl ?? req.url).split("?")[0].startsWith("/api/media/")) limiter.hit(`media:${req.ip}`, 1200, 60_000);
      else limiter.hit(`ip:${req.ip}`, 240, 60_000);
      next();
    } catch (error) {
      next(error);
    }
  });

  // Session : cookie opaque, seul son hachage est en base. Un compte bloqué n'a plus de session.
  app.use("/api", async (req, res, next) => {
    try {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      req.sessionToken = token;
      req.user = token ? await services.accounts.sessionUser(token) : null;
      next();
    } catch (error) {
      next(error);
    }
  });

  // Santé : pour l'hébergeur et la supervision. Aucune donnée personnelle.
  app.get("/api/health", async (req, res) => {
    try {
      await health();
      res.json({ ok: true, ...counters });
    } catch (error) {
      logger.error("sante_base_indisponible", { id: req.id, error: String(error?.message ?? error) });
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api", buildRoutes({ services, config, limiter, logger, counters, requireUser, setSession, clearSession }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Introuvable." }));
  if (services.seo) app.use(buildSeoRoutes({ seo: services.seo, config }));
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"], maxAge: config.production ? "1h" : 0 }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "Envoi trop volumineux." });
    if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "Requête illisible." });
    logger.error("erreur_serveur", { id: req.id, method: req.method, path: req.originalUrl.split("?")[0], error: String(error?.message ?? error), stack: String(error?.stack ?? "").split("\n").slice(0, 6).join(" | ") });
    res.status(500).json({ error: "Une erreur est survenue. Réessayez dans un instant.", requestId: req.id });
  });

  function requireUser(req) {
    if (!req.user) throw unauthorized();
    return req.user.id;
  }

  function setSession(res, token) {
    res.setHeader("Set-Cookie", sessionCookie(token, config));
  }

  function clearSession(res) {
    res.setHeader("Set-Cookie", clearedSessionCookie());
  }

  return app;
}
