// Routes des expirations d'annonces. Montées dans server/app.js AVANT les routes générales :
// POST /listings/:id/outcome traite ici Vendu / Louée / Archiver / Prolonger (règles côté serveur) et laisse
// les autres actions (ex. « Renvoyer ») au gestionnaire existant.
import { Router } from "express";

const OWN_OUTCOMES = new Set(["SOLD", "RENTED", "ARCHIVED", "RENEW"]);
const clean = (v, n = 80) => String(v ?? "").slice(0, n);

export function buildExpirationRoutes({ expiry, accounts, analytics = null, requireUser, limiter }) {
  const router = Router();
  const hit = (userId) => limiter.hit(`expiry:${userId}`, 60, 60_000);

  // ----- Propriétaire -----
  router.get("/me/expiry-alerts", async (req, res) => {
    const userId = requireUser(req);
    hit(userId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ items: await expiry.ownerAlerts(userId) });
  });

  router.post("/listings/:id/outcome", async (req, res, next) => {
    const outcome = clean(req.body?.outcome, 20);
    if (!OWN_OUTCOMES.has(outcome)) return next(); // RESUBMIT et actions inconnues : gestionnaire existant
    const userId = requireUser(req);
    hit(userId);
    const out = await expiry.outcome(userId, clean(req.params.id), { outcome, until: req.body?.until ?? null, days: req.body?.days ?? null });
    if (outcome === "ARCHIVED") {
      try { analytics?.emit?.("listing_archived", { userId, listingId: clean(req.params.id) }); } catch { /* statistiques facultatives */ }
    }
    res.json(out);
  });

  router.get("/listings/:id/dates", async (req, res) => {
    const userId = requireUser(req);
    hit(userId);
    const rows = await expiry.ownDates(userId, clean(req.params.id));
    res.setHeader("Cache-Control", "no-store");
    res.json(rows);
  });

  router.put("/listings/:id/dates", async (req, res) => {
    const userId = requireUser(req);
    hit(userId);
    res.json(await expiry.setDates(userId, clean(req.params.id), { startsAt: req.body?.startsAt ?? null, expiresAt: req.body?.expiresAt ?? null }));
  });

  router.get("/listings/:id/history", async (req, res) => {
    const userId = requireUser(req);
    hit(userId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ events: await expiry.history(userId, clean(req.params.id)) });
  });

  // ----- Superadmin (rôle revérifié dans le service) -----
  router.get("/superadmin/expirations", async (req, res) => {
    const staffId = requireUser(req);
    hit(staffId);
    const q = req.query ?? {};
    res.setHeader("Cache-Control", "no-store");
    res.json(await expiry.dashboard(staffId, {
      from: clean(q.from, 40), to: clean(q.to, 40), ownerId: clean(q.ownerId), category: clean(q.category, 40),
      transaction: clean(q.transaction, 20), status: clean(q.status, 20), expired: q.expired === "1", expiring: q.expiring === "1",
    }));
  });

  router.get("/superadmin/expirations/settings", async (req, res) => {
    const staffId = requireUser(req);
    await accounts.requireStaff(staffId, "SUPERADMIN");
    res.setHeader("Cache-Control", "no-store");
    res.json(await expiry.getSettings());
  });

  router.put("/superadmin/expirations/settings", async (req, res) => {
    const staffId = requireUser(req);
    hit(staffId);
    res.json(await expiry.saveSettings(staffId, req.body?.value ?? req.body));
  });

  router.get("/superadmin/expirations/:id/history", async (req, res) => {
    const staffId = requireUser(req);
    hit(staffId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ events: await expiry.history(staffId, clean(req.params.id), { staff: true }) });
  });

  return router;
}
