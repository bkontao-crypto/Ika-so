// Réglages du badge Étoile décidés par le superadmin (clé « star_badge_policy » dans ika_superadmin_settings).
// Rien n'est figé dans le code : activation, pièces exigées par type de compte, prix, durée, délai, conservation et textes se règlent ici.
// Le badge est INDÉPENDANT du Premium : il atteste seulement qu'un compte est identifié.
export const STAR_POLICY_KEY = "star_badge_policy";
export const DOC_KINDS = Object.freeze({
  ID_CARD: "Carte d'identité",
  PHOTO: "Photo d'identité récente",
  SELFIE: "Selfie avec la pièce d'identité",
  RESIDENCE: "Certificat de résidence",
  COMPANY_REGISTER: "Registre de commerce (RCCM)",
  HQ_PROOF: "Justificatif de siège",
});
export const STAR_STEPS = Object.freeze({ 1: "Étude", 2: "Vérification", 3: "Confirmation" });
export const STAR_ACCOUNT_TYPES = ["INDIVIDUAL", "AGENCY", "OTHER"];

const REQUIREMENTS = Object.freeze({
  INDIVIDUAL: Object.freeze({ required: ["ID_CARD", "PHOTO", "RESIDENCE"], optional: ["SELFIE"] }),
  AGENCY: Object.freeze({ required: ["ID_CARD", "PHOTO", "COMPANY_REGISTER", "HQ_PROOF"], optional: ["SELFIE"] }),
  OTHER: Object.freeze({ required: ["ID_CARD", "PHOTO", "RESIDENCE"], optional: ["SELFIE"] }),
});
export const DEFAULT_STAR_POLICY = Object.freeze({
  enabled: false,            // éteint tant que le superadmin ne l'active pas
  requirePhone: true,        // numéro confirmé par code reçu
  paymentRequired: false,    // paiement (branché au lot suivant) ; le prix est déjà réglable
  priceXof: 0,               // prix du badge, en FCFA
  durationMonths: 12,        // validité du badge
  reviewDelayDays: 5,        // délai d'étude annoncé
  retentionDays: 0,          // conservation des pièces après décision, en jours ; 0 = jusqu'à suppression manuelle (à fixer selon la loi en vigueur)
  requiredSteps: [1, 2, 3],  // étapes à valider avant la décision finale (réglable : au moins une)
  requirements: REQUIREMENTS,
  infoTitle: "Qu'est-ce qu'un compte certifié ?",
  infoBody: "Le badge Étoile indique que l'identité du titulaire a été vérifiée par l'équipe IKA SO à partir de pièces justificatives. Il ne garantit ni la qualité d'un bien ni la réussite d'une transaction.",
  warningText: "Restez prudent : faites-vous toujours assister par un professionnel (notaire, avocat, agent immobilier agréé) avant de conclure quoi que ce soit avec un annonceur.",
});

const bounded = (v, min, max, fallback) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };
const text = (v, max, fallback) => { const s = String(v ?? "").trim().slice(0, max); return s || fallback; };
const kinds = (list) => (Array.isArray(list) ? [...new Set(list.map(String).filter((k) => Object.hasOwn(DOC_KINDS, k)))] : null);

export function normalizeStarPolicy(value) {
  const v = value && typeof value === "object" ? value : {};
  const requirements = {};
  for (const type of STAR_ACCOUNT_TYPES) {
    const given = v.requirements?.[type];
    const required = kinds(given?.required) ?? [...REQUIREMENTS[type].required];
    const optional = (kinds(given?.optional) ?? [...REQUIREMENTS[type].optional]).filter((k) => !required.includes(k));
    requirements[type] = { required, optional };
  }
  return {
    enabled: v.enabled === true,
    requirePhone: v.requirePhone === undefined ? DEFAULT_STAR_POLICY.requirePhone : v.requirePhone === true,
    paymentRequired: v.paymentRequired === true,
    priceXof: bounded(v.priceXof, 0, 100_000_000, DEFAULT_STAR_POLICY.priceXof),
    durationMonths: bounded(v.durationMonths, 1, 60, DEFAULT_STAR_POLICY.durationMonths),
    reviewDelayDays: bounded(v.reviewDelayDays, 1, 60, DEFAULT_STAR_POLICY.reviewDelayDays),
    retentionDays: bounded(v.retentionDays, 0, 3650, DEFAULT_STAR_POLICY.retentionDays),
    requiredSteps: (() => { const l = Array.isArray(v.requiredSteps) ? [...new Set(v.requiredSteps.map(Number).filter((n) => Object.hasOwn(STAR_STEPS, n)))].sort() : null; return l?.length ? l : [1, 2, 3]; })(),
    requirements,
    infoTitle: text(v.infoTitle, 80, DEFAULT_STAR_POLICY.infoTitle),
    infoBody: text(v.infoBody, 1200, DEFAULT_STAR_POLICY.infoBody),
    warningText: text(v.warningText, 600, DEFAULT_STAR_POLICY.warningText),
  };
}
