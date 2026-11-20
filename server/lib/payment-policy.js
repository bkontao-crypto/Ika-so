// Réglages de paiement décidés par le superadmin (clé « payments_policy » dans ika_superadmin_settings).
// - onlineEnabled : paiement en ligne ouvert aux annonceurs (sinon : demandes approuvées à la main).
// - manualPremiumMaxMonths : durée maximale qu'un administrateur peut accorder à la main pour le Premium (1, 2 ou 3 mois).
// - manualFeaturedMaxMonths : durée maximale d'une mise à la une accordée à la main (1, 2 ou 3 mois).
export const POLICY_KEY = "payments_policy";
// - reviewDelayDays : délai d'étude d'un dossier Premium annoncé à l'annonceur (1 à 30 jours).
// - payButtonLabel / payButtonNote : texte du bouton de paiement Premium et note affichée dessous (personnalisables).
//   Paiement en ligne ouvert = l'annonceur paie d'abord, les 3 étapes d'étude viennent après ; fermé = étude d'abord, puis activation à la main.
export const DEFAULT_POLICY = Object.freeze({ onlineEnabled: false, manualPremiumMaxMonths: 3, manualFeaturedMaxMonths: 1, reviewDelayDays: 3, payButtonLabel: "Activer mon Premium", payButtonNote: "" });

export function normalizePolicy(value) {
  const v = value && typeof value === "object" ? value : {};
  const months = Math.floor(Number(v.manualPremiumMaxMonths));
  const featured = Math.floor(Number(v.manualFeaturedMaxMonths));
  const delay = Math.floor(Number(v.reviewDelayDays));
  return {
    onlineEnabled: v.onlineEnabled === true,
    manualPremiumMaxMonths: Number.isFinite(months) && months >= 1 && months <= 3 ? months : DEFAULT_POLICY.manualPremiumMaxMonths,
    manualFeaturedMaxMonths: Number.isFinite(featured) && featured >= 1 && featured <= 3 ? featured : DEFAULT_POLICY.manualFeaturedMaxMonths,
    reviewDelayDays: Number.isFinite(delay) && delay >= 1 && delay <= 30 ? delay : DEFAULT_POLICY.reviewDelayDays,
    payButtonLabel: String(v.payButtonLabel ?? "").trim().slice(0, 40) || DEFAULT_POLICY.payButtonLabel,
    payButtonNote: String(v.payButtonNote ?? "").trim().slice(0, 200),
  };
}
