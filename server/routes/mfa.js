// Routes MFA : /api/mfa/*. Montées dans server/app.js avant les autres routes.
// /pending, /login et /cancel fonctionnent avec une session « en attente » (req.mfaPendingUserId) ; les autres exigent une session vérifiée.
import { Router } from "express";
import { badRequest } from "../lib/errors.js";

export function buildMfaRoutes({ mfa, accounts, requireUser, limiter, clearSession }) {
  const router = Router();
  const code = (req) => String(req.body?.code ?? "").slice(0, 40);

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store"); // secrets et codes de secours : jamais mis en cache
    limiter.hit(`mfa:${req.ip}`, 30, 60_000);
    next();
  });

  // Y a-t-il une vérification MFA à faire pour la session en cours ?
  router.get("/pending", (req, res) => res.json({ pending: Boolean(req.mfaPendingUserId) }));

  // Termine la connexion : le code (appli ou secours) rend la session pleinement valide.
  router.post("/login", async (req, res) => {
    if (!req.mfaPendingUserId) throw badRequest("Aucune vérification en attente.");
    const result = await mfa.service.verify(req.mfaPendingUserId, code(req));
    await mfa.sessions.markVerified(req.sessionToken);
    res.json(result);
  });

  // Abandon : ferme la session en attente.
  router.post("/cancel", async (req, res) => {
    if (!req.mfaPendingUserId) throw badRequest("Aucune vérification en attente.");
    await accounts.logout(req.sessionToken);
    clearSession(res);
    res.json({ ok: true });
  });

  // Réglage « MFA obligatoire » : Superadmin seulement (Superadmin dès l'activation ; Admin et Modérateurs après 14 jours).
  router.get("/required", async (req, res) => {
    await accounts.requireStaff(requireUser(req), "SUPERADMIN");
    res.json(await mfa.service.requirement());
  });
  router.put("/required", async (req, res) => {
    const userId = requireUser(req);
    await accounts.requireStaff(userId, "SUPERADMIN");
    if (typeof req.body?.required !== "boolean") throw badRequest("Indiquez required : true ou false.");
    res.json(await mfa.service.setRequired(userId, req.body.required));
  });

  // Emplacements Superadmin (principal, secondaire) : lecture seule, Superadmin seulement.
  router.get("/superadmins", async (req, res) => {
    await accounts.requireStaff(requireUser(req), "SUPERADMIN");
    res.json(await mfa.service.superadminSlots());
  });

  router.get("/status", async (req, res) => res.json(await mfa.service.status(requireUser(req))));

  router.post("/begin", async (req, res) => res.json(await mfa.service.begin(requireUser(req))));

  router.post("/confirm", async (req, res) => {
    const result = await mfa.service.confirm(requireUser(req), code(req));
    await mfa.sessions.markVerified(req.sessionToken); // la session qui active la MFA n'a pas à ressaisir un code
    res.json(result);
  });

  router.post("/backup-codes", async (req, res) => res.json(await mfa.service.regenerateBackupCodes(requireUser(req), code(req))));

  router.post("/disable", async (req, res) => res.json(await mfa.service.disable(requireUser(req), code(req))));

  return router;
}
