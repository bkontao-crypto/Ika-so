// Gestion centralisée des contacts (ordonnance du 27 nov. 2026). Fonctions pures : aucune lecture de base ici.
// Règle de sécurité : tout ce qui est absent, mal formé ou douteux donne « désactivé » = fonctionnement normal vers le propriétaire.

export const CONTACT_CENTRAL_KEY = "contact_central";
/** Catégories de compte couvertes, chacune avec son propre interrupteur. */
export const CATEGORY_KEYS = Object.freeze(["STANDARD", "ADVERTISER", "AGENCY", "PREMIUM"]);
export const CATEGORY_LABELS = Object.freeze({ STANDARD: "Compte standard", ADVERTISER: "Compte annonceur", AGENCY: "Compte agence", PREMIUM: "Compte premium" });
/** A : propriétaire. B : coordonnées centralisées d'IKA SÔ. C : contact personnalisé de l'annonce. */
export const CONTACT_MODES = Object.freeze(["OWNER", "CENTRAL", "CUSTOM"]);
export const MAX_RECIPIENTS = 10;

export const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  categories: Object.freeze({ STANDARD: false, ADVERTISER: false, AGENCY: false, PREMIUM: false }),
  defaultMode: "CENTRAL",
  central: Object.freeze({ phone: "", whatsapp: "" }),
  recipients: Object.freeze([]),
});

/** Numéro international : « + » (ou « 00 ») puis 8 à 15 chiffres, premier chiffre non nul. Sinon chaîne vide. */
export function normalizePhone(value) {
  if (typeof value !== "string") return "";
  let s = value.trim().replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : "";
}

const isId = (v) => typeof v === "string" && v.length > 0 && v.length <= 80;

/** Lecture tolérante d'un réglage enregistré : ne lève jamais, retombe sur « tout désactivé ». */
export function normalizeConfig(raw) {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cats = v.categories && typeof v.categories === "object" ? v.categories : {};
  const central = v.central && typeof v.central === "object" ? v.central : {};
  return {
    enabled: v.enabled === true,
    categories: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, cats[k] === true])),
    defaultMode: CONTACT_MODES.includes(v.defaultMode) ? v.defaultMode : DEFAULT_CONFIG.defaultMode,
    central: { phone: normalizePhone(central.phone), whatsapp: normalizePhone(central.whatsapp) },
    recipients: Array.isArray(v.recipients) ? [...new Set(v.recipients.filter(isId))].slice(0, MAX_RECIPIENTS) : [],
  };
}

/**
 * Contrôle d'une saisie du Superadmin avant enregistrement. Retourne { value, errors }.
 * Un numéro saisi mais invalide est une erreur (jamais corrigé en silence).
 */
export function validateConfigInput(raw) {
  const errors = [];
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!v) return { value: normalizeConfig(null), errors: ["Réglage invalide."] };
  for (const k of ["enabled"]) if (v[k] !== undefined && typeof v[k] !== "boolean") errors.push("L'interrupteur général doit être activé ou désactivé.");
  if (v.categories !== undefined) {
    if (!v.categories || typeof v.categories !== "object") errors.push("Catégories invalides.");
    else for (const [k, on] of Object.entries(v.categories)) {
      if (!CATEGORY_KEYS.includes(k)) errors.push(`Catégorie inconnue : ${k}.`);
      else if (typeof on !== "boolean") errors.push(`${CATEGORY_LABELS[k]} : valeur invalide.`);
    }
  }
  if (v.defaultMode !== undefined && !CONTACT_MODES.includes(v.defaultMode)) errors.push("Mode de contact inconnu.");
  const central = v.central && typeof v.central === "object" ? v.central : {};
  for (const [k, label] of [["phone", "Téléphone"], ["whatsapp", "WhatsApp"]]) {
    const given = central[k];
    if (given !== undefined && given !== null && String(given).trim() !== "" && !normalizePhone(given)) errors.push(`${label} centralisé : numéro invalide (format international, par exemple +223 70 00 00 00).`);
  }
  if (v.recipients !== undefined) {
    if (!Array.isArray(v.recipients) || !v.recipients.every(isId)) errors.push("Liste de destinataires invalide.");
    else if (new Set(v.recipients).size > MAX_RECIPIENTS) errors.push(`Au plus ${MAX_RECIPIENTS} destinataires.`);
  }
  const value = normalizeConfig(v);
  const anyCategory = CATEGORY_KEYS.some((k) => value.categories[k]);
  // Le mode centralisé doit avoir des coordonnées validées avant d'être utilisable.
  if (value.enabled && anyCategory && value.defaultMode === "CENTRAL" && !value.central.phone) errors.push("Renseignez et validez le téléphone centralisé avant d'activer une catégorie en mode centralisé.");
  return { value, errors };
}

/** La centralisation s'applique-t-elle aux annonces de cette catégorie ? Catégorie inconnue = non. */
export function isCentralActive(config, category) {
  const c = normalizeConfig(config);
  return c.enabled === true && CATEGORY_KEYS.includes(category) && c.categories[category] === true;
}

/**
 * Mode effectif d'un contact. Entrées : réglage, catégorie du propriétaire, annonce { contactMode, customPhone, customWhatsapp }, téléphone du propriétaire.
 * Retourne { active, mode, routing, phone, whatsapp } où phone/whatsapp valent null quand aucun bouton sûr n'est possible
 * (le bouton est alors masqué : jamais de lien cassé, jamais de numéro non autorisé).
 * routing : « OWNER » (messagerie vers le propriétaire) ou « CENTRAL » (boîte commune des comptes désignés).
 */
export function resolveContact({ config, category, listing = {}, ownerPhone = "" } = {}) {
  const c = normalizeConfig(config);
  const owner = typeof ownerPhone === "string" && ownerPhone.trim() ? ownerPhone : null;
  if (!isCentralActive(c, category)) return { active: false, mode: "OWNER", routing: "OWNER", phone: owner, whatsapp: owner };
  const wanted = CONTACT_MODES.includes(listing.contactMode) ? listing.contactMode : c.defaultMode;
  const central = { phone: c.central.phone || null, whatsapp: c.central.whatsapp || c.central.phone || null };
  if (wanted === "OWNER") return { active: true, mode: "OWNER", routing: "OWNER", phone: owner, whatsapp: owner };
  if (wanted === "CUSTOM") {
    const phone = normalizePhone(listing.customPhone);
    if (phone) return { active: true, mode: "CUSTOM", routing: "CENTRAL", phone, whatsapp: normalizePhone(listing.customWhatsapp) || phone };
    // Contact personnalisé incomplet : repli sur les coordonnées centralisées si elles sont valides, sinon aucun bouton.
    return { active: true, mode: "CENTRAL", routing: "CENTRAL", ...central };
  }
  return { active: true, mode: "CENTRAL", routing: "CENTRAL", ...central };
}
