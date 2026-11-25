// Routes de la boîte WhatsApp : /api/whatsapp/*. Réservées au personnel autorisé (permission « contenu.gerer »), refus par défaut.
// Le webhook Meta reste celui qui existe déjà (/api/webhooks/whatsapp) : server/app.js y enregistre les messages avant son traitement habituel.
import { Router } from "express";

export function buildWhatsAppInboxRoutes({ inbox, accounts, requireUser, limiter }) {
  const router = Router();

  router.use(async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store"); // messages de tiers : jamais mis en cache
    const userId = requireUser(req);
    await accounts.requirePermission(userId, "contenu.gerer");
    req.waUserId = userId;
    next();
  });

  router.get("/status", (req, res) => res.json({ configured: inbox.isConfigured(), webhookPath: "/api/webhooks/whatsapp" }));

  router.get("/messages", async (req, res) => res.json({ messages: await inbox.list({ phone: req.query.phone, limit: req.query.limit }) }));

  router.post("/send", async (req, res) => {
    limiter.hit(`wasend:${req.waUserId}`, 20, 60_000);
    res.json(await inbox.send({ userId: req.waUserId, phone: req.body?.phone, message: req.body?.message }));
  });

  return router;
}
