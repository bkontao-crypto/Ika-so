// Profil public d'un compte : champs permis selon le rôle affiché, validation et nettoyage. Module pur (sans base).
import { badRequest } from "./errors.js";

export const PROFILE_LIMITS = Object.freeze({ bio: 1500, address: 200, hours: 120, zones: 8, zoneLength: 60, yearMin: 1900, city: 60 });
export const PROFILE_REPORT_REASONS = Object.freeze([
  "Arnaque ou demande d'acompte",
  "Annonce trompeuse ou bien inexistant",
  "Faux profil ou usurpation d'identité",
  "Harcèlement ou insultes",
  "Autre",
]);
const BASE = ["bio", "city", "showPhone", "showWhatsapp"];
const BY_ROLE = {
  "Propriétaire direct": [...BASE],
  "Démarcheur mandaté": [...BASE, "zones"],
  "Agence immobilière": [...BASE, "zones", "foundedYear", "address", "hours"],
};

/** Champs modifiables pour un rôle affiché. Rôle inconnu : le minimum (refus par défaut). */
export const allowedFields = (role) => new Set(BY_ROLE[role] ?? BASE);

const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
/** Un numéro écrit dans le texte contournerait le contrôle d'affichage du téléphone. */
export const hasPhoneNumber = (value) => /(?:\d[\s.\-]?){8,}/.test(String(value ?? ""));

/** Renvoie les seuls champs fournis, nettoyés (null = effacer). Refuse un champ non permis pour ce rôle. */
export function sanitizeProfileInput(input, role, { now = new Date() } = {}) {
  const allowed = allowedFields(role);
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  const provided = (k) => Object.prototype.hasOwnProperty.call(src, k);
  const guard = (k, empty) => {
    if (!provided(k)) return false;
    if (!allowed.has(k)) {
      if (empty) return false; // vider un champ non permis est sans effet
      throw badRequest("Ce champ n'est pas disponible pour votre type de compte.");
    }
    return true;
  };

  if (guard("bio", !text(src.bio, 1))) {
    const bio = text(src.bio, PROFILE_LIMITS.bio);
    if (hasPhoneNumber(bio)) throw badRequest("N'écrivez pas de numéro de téléphone dans la présentation : utilisez l'option « Afficher mon téléphone ».");
    out.bio = bio || null;
  }
  if (guard("city", !text(src.city, 1))) out.city = text(src.city, PROFILE_LIMITS.city) || null;
  if (guard("address", !text(src.address, 1))) out.address = text(src.address, PROFILE_LIMITS.address) || null;
  if (guard("hours", !text(src.hours, 1))) out.hours = text(src.hours, PROFILE_LIMITS.hours) || null;
  if (guard("foundedYear", src.foundedYear == null || src.foundedYear === "")) {
    if (src.foundedYear == null || src.foundedYear === "") out.foundedYear = null;
    else {
      const year = Number(src.foundedYear);
      if (!Number.isInteger(year) || year < PROFILE_LIMITS.yearMin || year > now.getUTCFullYear()) throw badRequest("Année de création invalide.");
      out.foundedYear = year;
    }
  }
  if (guard("zones", Array.isArray(src.zones) && !src.zones.length)) {
    if (!Array.isArray(src.zones)) throw badRequest("Zones d'intervention invalides.");
    const seen = new Set();
    for (const z of src.zones) {
      const zone = text(z, PROFILE_LIMITS.zoneLength);
      if (zone) seen.add(zone);
    }
    if (seen.size > PROFILE_LIMITS.zones) throw badRequest(`${PROFILE_LIMITS.zones} zones au plus.`);
    out.zones = [...seen];
  }
  for (const k of ["showPhone", "showWhatsapp"]) if (guard(k, false)) out[k] = src[k] === true;
  return out;
}

/** wa.me n'accepte que des chiffres. Numéro trop court ou trop long : null. */
export function whatsappLink(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

/** Ce que voit le public. Adresse et horaires : agences vérifiées seulement. Numéros : jamais sans compte connecté. */
export function publicProfileView(row, { agencyVerified, signedIn, phone }) {
  const r = row ?? {};
  const wantsPhone = Boolean(r.show_phone && phone);
  const wantsWhatsapp = Boolean(r.show_whatsapp && whatsappLink(phone));
  return {
    bio: r.bio ?? null,
    city: r.city ?? null,
    coverUrl: r.images_hidden ? null : r.cover_url ?? null,
    avatarUrl: r.images_hidden ? null : r.avatar_url ?? null,
    foundedYear: r.founded_year ?? null,
    zones: r.zones ?? [],
    address: agencyVerified ? r.address ?? null : null,
    hours: agencyVerified ? r.opening_hours ?? null : null,
    contact: {
      canCall: wantsPhone, canWhatsapp: wantsWhatsapp,
      needsLogin: (wantsPhone || wantsWhatsapp) && !signedIn,
    },
  };
}
