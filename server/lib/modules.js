// Coupures de modules réglées par le Super Administrateur (réglage « main », onglet « Apparence & modules »).
// Activé par défaut : seul un « false » explicite coupe. Lu à chaque contrôle, sans cache : la coupure est immédiate.
// Une coupure ferme l'accès ; elle ne supprime ni ne modifie aucune donnée ni aucun droit acquis.
import { forbidden } from "./errors.js";

export const MODULE_CLOSED = Object.freeze({
  crm: "Le module CRM est désactivé pour le moment.",
  premium: "L'offre Premium est désactivée pour le moment.",
});

export function createModules(superadminSettings) {
  const isOpen = async (key) => (await superadminSettings.get("main"))?.modules?.[key] !== false;
  return {
    isOpen,
    async assertOpen(key) { if (!(await isOpen(key))) throw forbidden(MODULE_CLOSED[key]); },
  };
}
