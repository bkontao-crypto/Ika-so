// Routes de la gestion centralisée des contacts : /api/contact-central. Montées dans server/app.js avant les autres routes.
// Superadmin seulement : le contrôle est fait côté serveur par le service (requireStaff), jamais par le navigateur.
import { Router } from "express";

export function buildContactCentralRoutes({ contactCentral, requireUser, limiter }) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    limiter.hit(`contact-central:${req.ip}`, 60, 60_000);
    next();
  });
  // Réglage courant : interrupteur général, quatre catégories, mode par défaut, coordonnées d'IKA SÔ, destinataires désignés.
  router.get("/", async (req, res) => res.json(await contactCentral.getSettings(requireUser(req))));
  // Remplace le réglage complet après validation ; l'ancien et le nouvel état sont journalisés.
  router.put("/", async (req, res) => res.json(await contactCentral.saveSettings(requireUser(req), req.body)));
  return router;
}
