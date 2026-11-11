import { pricePerSquareMeter } from "../lib/rules.js";

const PLAIN = `id, owner_id, title, category, transaction_type, price, neighborhood, city,
  surface_label, surface_m2, road_access, bedrooms, bathrooms, furnished,
  description, declared_document, latitude, longitude, image_url, status,
  moderation_note, visibility, owner_name, owner_phone, owner_role, phone_verified,
  featured_until, created_at, expires_at, document_verified_at`;

/** Colonnes lues pour une annonce (jamais de SELECT *). `alias` : nom de la table dans la requête. */
export const listingColumns = (alias = "") => {
  const q = alias ? `${alias}.` : "";
  const t = alias || "ika_listings";
  // Position affichée sur la carte d'accueil : la position EXACTE posée avec « Localiser » quand l'annonceur l'a rendue publique,
  // sinon le point approximatif du quartier (ika_listings.latitude/longitude).
  const exact = (col) => `coalesce((select g.${col} from ika_listing_geo g where g.listing_id = ${t}.id and g.is_public), ${t}.${col}) as ${col}`;
  return `${PLAIN.split(",").map((c) => c.trim()).filter((c) => c !== "latitude" && c !== "longitude").map((c) => `${q}${c}`).join(", ")},
  ${exact("latitude")}, ${exact("longitude")},
  (select p.agency_verified_at is not null from ika_profiles p where p.user_id = ${q}owner_id) as agency_verified,
  (select p.agency_name from ika_profiles p where p.user_id = ${q}owner_id and p.agency_verified_at is not null) as agency_name`;
};
export const LISTING_COLUMNS = listingColumns();

export const iso = (value) => {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
};

export function isLive(value) {
  if (!value) return false;
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(time) && time > Date.now();
}

/**
 * Forme publique d'une annonce.
 * Le numéro du propriétaire n'est jamais inclus par défaut : il ne sort que par
 * « contact » (compté et limité), pour le propriétaire lui-même ou pour la modération.
 */
export function toCard(row, { revealPhone = false } = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    category: row.category,
    transactionType: row.transaction_type,
    price: Number(row.price),
    neighborhood: row.neighborhood,
    countryCode: row.country_code ?? "ML",
    city: row.city,
    surfaceLabel: row.surface_label,
    surfaceM2: row.surface_m2 == null ? null : Number(row.surface_m2),
    roadAccess: row.road_access,
    bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    furnished: row.furnished,
    description: row.description,
    declaredDocument: row.declared_document,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: row.image_url,
    status: row.status,
    moderationNote: row.moderation_note,
    ownerName: row.owner_name,
    ownerPhone: revealPhone ? row.owner_phone : "",
    ownerRole: row.owner_role,
    phoneVerified: row.phone_verified,
    documentVerified: Boolean(row.document_verified_at),
    agencyVerified: Boolean(row.agency_verified),
    agencyName: row.agency_verified ? row.agency_name ?? null : null,
    pricePerM2: pricePerSquareMeter(Number(row.price), row.surface_m2, row.category),
    featured: isLive(row.featured_until),
    photos: [row.image_url],
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  };
}
