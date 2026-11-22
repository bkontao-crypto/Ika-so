// Conditions OFFICIELLES (réglages du superadmin, clé « account_rules ») et catalogue des exceptions possibles.
// Rien n'est figé dans le code : le code applique ce que le superadmin a décidé, sauf exception tracée sur un compte.
import { DEFAULT_GROUPS, normalizeGroups } from "./certification-criteria.js";

export const RULES_KEY = "account_rules";
export const STEP_KEYS = [1, 2, 3];
/** Qui peut accorder une exception : le superadmin seul (défaut) ou aussi les administrateurs (décision du superadmin). */
export const GRANTERS = ["SUPERADMIN", "ADMIN"];
export const DEFAULT_RULES = Object.freeze({
  phoneConfirmedForPremium: true,   // numéro confirmé (code reçu) pour demander ou payer le Premium
  certificationGroups: DEFAULT_GROUPS, // critères de certification du centre de contrôle : ET entre conditions, OU dans une condition (défaut : numéro confirmé)
  requiredSteps: [1, 2, 3],         // étapes d'étude à valider avant d'approuver un dossier Premium
  exceptionGrantedBy: "SUPERADMIN", // qui peut accorder une exception
  // « Découvrir » (publications de la communauté) : décisions du superadmin, modifiables sans toucher au code.
  discoverEnabled: true,            // ouvert : chacun peut lire et publier
  discoverMaxPhotos: 4,             // photos par publication (0 à 6)
  discoverPostsPerDay: 5,           // publications par compte et par 24 h (1 à 50)
  discoverRequirePhone: false,      // exiger un numéro confirmé pour publier
  discoverAutoBlockReports: 10,     // membres différents ayant signalé un même compte avant blocage automatique (0 = jamais)
  whatsappDecisionEnabled: false,   // WhatsApp à la décision finale Premium (activable seulement si jetons et modèle sont installés)
  discoverVideoLinks: false,        // liens vidéo YouTube / Facebook (éteint tant que le superadmin ne l'active pas)
});
/** Exceptions que l'on peut accorder à un compte : clé → libellé. « step1..3 » lève l'obligation de valider cette étape. */
export const EXCEPTION_RULES = Object.freeze({
  phone: "Numéro de téléphone non confirmé (Premium)",
  certification: "Conditions de certification du centre de contrôle non remplies",
  step1: "Étape « Étude » non exigée",
  step2: "Étape « Vérification » non exigée",
  step3: "Étape « Confirmation » non exigée",
});
export const stepRule = (n) => `step${n}`;

const bounded = (value, min, max, fallback) => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };

export function normalizeRules(value) {
  const v = value && typeof value === "object" ? value : {};
  const steps = Array.isArray(v.requiredSteps) ? [...new Set(v.requiredSteps.map((n) => Math.floor(Number(n))).filter((n) => STEP_KEYS.includes(n)))].sort() : [...DEFAULT_RULES.requiredSteps];
  return {
    phoneConfirmedForPremium: v.phoneConfirmedForPremium === undefined ? DEFAULT_RULES.phoneConfirmedForPremium : v.phoneConfirmedForPremium === true,
    certificationGroups: (() => { try { return normalizeGroups(v.certificationGroups ?? DEFAULT_GROUPS); } catch { return normalizeGroups(DEFAULT_GROUPS); } })(),
    requiredSteps: steps,
    exceptionGrantedBy: GRANTERS.includes(v.exceptionGrantedBy) ? v.exceptionGrantedBy : DEFAULT_RULES.exceptionGrantedBy,
    discoverEnabled: v.discoverEnabled === undefined ? DEFAULT_RULES.discoverEnabled : v.discoverEnabled === true,
    discoverMaxPhotos: bounded(v.discoverMaxPhotos, 0, 6, DEFAULT_RULES.discoverMaxPhotos),
    discoverPostsPerDay: bounded(v.discoverPostsPerDay, 1, 50, DEFAULT_RULES.discoverPostsPerDay),
    discoverRequirePhone: v.discoverRequirePhone === undefined ? DEFAULT_RULES.discoverRequirePhone : v.discoverRequirePhone === true,
    discoverVideoLinks: v.discoverVideoLinks === true,
    whatsappDecisionEnabled: v.whatsappDecisionEnabled === true,
    discoverAutoBlockReports: bounded(v.discoverAutoBlockReports, 0, 100, DEFAULT_RULES.discoverAutoBlockReports),
  };
}
