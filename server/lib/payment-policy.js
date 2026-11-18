// Réglages de paiement décidés par le superadmin (clé « payments_policy » dans ika_superadmin_settings).
// - onlineEnabled : paiement en ligne ouvert aux annonceurs (sinon : demandes approuvées à la main).
// - manualPremiumMaxMonths : durée maximale qu'un administrateur peut accorder à la main (1, 2 ou 3 mois).
export const POLICY_KEY = "payments_policy";
export const DEFAULT_POLICY = Object.freeze({ onlineEnabled: false, manualPremiumMaxMonths: 3 });

export function normalizePolicy(value) {
  const v = value && typeof value === "object" ? value : {};
  const months = Math.floor(Number(v.manualPremiumMaxMonths));
  return {
    onlineEnabled: v.onlineEnabled === true,
    manualPremiumMaxMonths: Number.isFinite(months) && months >= 1 && months <= 3 ? months : DEFAULT_POLICY.manualPremiumMaxMonths,
  };
}
