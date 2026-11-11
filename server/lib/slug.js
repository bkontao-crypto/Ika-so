import { ZONES } from "./places.js";

export const slugify = (value) =>
  String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const zoneSlug = (zone) => slugify(zone.name);
export const zoneFromSlug = (slug) => ZONES.find((z) => zoneSlug(z) === slugify(slug)) ?? null;

/** Texte d'adresse lisible pour une annonce (60 caractères au plus, coupé à un mot). Vide si le titre n'a rien d'exploitable. */
export function listingSlug(title) {
  const slug = slugify(title);
  if (slug.length <= 60) return slug;
  const cut = slug.slice(0, 60);
  return cut.includes("-") ? cut.slice(0, cut.lastIndexOf("-")) : cut;
}

/** Adresse publique d'une annonce : /a/<id>/<titre-lisible> (le titre est décoratif, l'identifiant décide). */
export function listingPath(item) {
  const slug = listingSlug(item?.title);
  return `/a/${encodeURIComponent(item.id)}${slug ? `/${slug}` : ""}`;
}
