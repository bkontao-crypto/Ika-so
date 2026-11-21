// Conditions OFFICIELLES (réglages du superadmin, clé « account_rules ») et catalogue des exceptions possibles.
// Rien n'est figé dans le code : le code applique ce que le superadmin a décidé, sauf exception tracée sur un compte.
export const RULES_KEY = "account_rules";
export const STEP_KEYS = [1, 2, 3];
/** Qui peut accorder une exception : le superadmin seul (défaut) ou aussi les administrateurs (décision du superadmin). */
export const GRANTERS = ["SUPERADMIN", "ADMIN"];
export const DEFAULT_RULES = Object.freeze({
  phoneConfirmedForPremium: true,   // numéro confirmé (code reçu) pour demander ou payer le Premium
  requiredSteps: [1, 2, 3],         // étapes d'étude à valider avant d'approuver un dossier Premium
  exceptionGrantedBy: "SUPERADMIN", // qui peut accorder une exception
});
/** Exceptions que l'on peut accorder à un compte : clé → libellé. « step1..3 » lève l'obligation de valider cette étape. */
export const EXCEPTION_RULES = Object.freeze({
  phone: "Numéro de téléphone non confirmé (Premium)",
  step1: "Étape « Étude » non exigée",
  step2: "Étape « Vérification » non exigée",
  step3: "Étape « Confirmation » non exigée",
});
export const stepRule = (n) => `step${n}`;

export function normalizeRules(value) {
  const v = value && typeof value === "object" ? value : {};
  const steps = Array.isArray(v.requiredSteps) ? [...new Set(v.requiredSteps.map((n) => Math.floor(Number(n))).filter((n) => STEP_KEYS.includes(n)))].sort() : [...DEFAULT_RULES.requiredSteps];
  return {
    phoneConfirmedForPremium: v.phoneConfirmedForPremium === undefined ? DEFAULT_RULES.phoneConfirmedForPremium : v.phoneConfirmedForPremium === true,
    requiredSteps: steps,
    exceptionGrantedBy: GRANTERS.includes(v.exceptionGrantedBy) ? v.exceptionGrantedBy : DEFAULT_RULES.exceptionGrantedBy,
  };
}
