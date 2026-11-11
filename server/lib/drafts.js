import { CATEGORIES, DOCUMENTS, ROAD_ACCESS, TRANSACTIONS } from "./rules.js";

/** Taille maximale du brouillon une fois nettoyé (octets). Au-delà, la demande est refusée. */
export const DRAFT_MAX_BYTES = 20_000;
export const DRAFT_MAX_PHOTOS = 10;

const text = (value, max) => (typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : undefined);
const digitsOnly = (value, max) => (typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "").slice(0, max) : undefined);
const oneOf = (value, list) => (list.includes(value) ? value : undefined);

/** Les photos du brouillon : seulement des images du site (/media/nom.jpg). Une photo envoyée n'est pas gardée ici. */
const SITE_PHOTO = /^\/media\/[A-Za-z0-9._-]{1,120}$/;

/**
 * Nettoie un brouillon reçu du navigateur. Liste blanche : tout champ inconnu est ignoré,
 * toute valeur hors liste est retirée (le formulaire retombera sur sa valeur par défaut).
 * Aucune règle métier ici : un brouillon peut être incomplet, c'est la soumission qui valide.
 */
export function sanitizeDraft(body) {
  const src = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const out = {
    title: text(src.title, 300),
    description: text(src.description, 4000),
    transaction: oneOf(src.transaction, TRANSACTIONS),
    category: oneOf(src.category, CATEGORIES),
    zone: text(src.zone, 120),
    price: digitsOnly(src.price, 15),
    surface: text(src.surface, 60),
    surfaceM2: digitsOnly(src.surfaceM2, 9),
    road: oneOf(src.road, ROAD_ACCESS),
    bedrooms: digitsOnly(src.bedrooms, 3),
    bathrooms: digitsOnly(src.bathrooms, 3),
    furnished: oneOf(src.furnished, ["oui", "non"]),
    declaredDocument: oneOf(src.declaredDocument, DOCUMENTS),
    photos: Array.isArray(src.photos)
      ? src.photos.filter((u) => typeof u === "string" && SITE_PHOTO.test(u)).slice(0, DRAFT_MAX_PHOTOS)
      : undefined,
  };
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
  return out;
}

/** Vrai si le brouillon ne contient rien d'utile (rien à enregistrer). */
export function isEmptyDraft(draft) {
  return !["title", "description", "price", "surface", "surfaceM2", "zone"].some((k) => String(draft[k] ?? "").trim());
}
