// Règles pures de la durée de publication (aucun accès base) : réglages, dates, prolongation, avertissements.
// Fuseau : le Mali est à UTC+0 toute l'année, donc « jour » = jour UTC.
export const EXPIRY_KEY = "listing_expiry";
export const HARD_MAX_EXTENSION_DAYS = 30; // plafond absolu validé : jamais plus de 30 jours par prolongation
export const DAY_MS = 86_400_000;

/** Valeurs initiales proposées (modifiables par le Superadmin). */
export const DEFAULT_EXPIRY_SETTINGS = Object.freeze({
  warningsEnabled: true,
  warningDays: [7, 3, 1],
  dayZeroWarning: true,
  autoArchiveDays: 30,
  maxExtensionDays: 30,
});

const isInt = (v) => Number.isInteger(v);

/**
 * Normalise les réglages. `strict` : lève une erreur (saisie du Superadmin) ; sinon valeur invalide = valeur initiale (lecture).
 * `base` : réglages actuels, conservés pour les champs absents.
 */
export function normalizeExpirySettings(raw, { strict = false, base = DEFAULT_EXPIRY_SETTINGS } = {}) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = { ...DEFAULT_EXPIRY_SETTINGS, ...(base && typeof base === "object" ? base : {}) };
  const bad = (message) => {
    if (strict) throw new Error(message);
  };
  if (src.warningsEnabled !== undefined) {
    if (typeof src.warningsEnabled === "boolean") out.warningsEnabled = src.warningsEnabled;
    else bad("Activation des avertissements invalide.");
  }
  if (src.dayZeroWarning !== undefined) {
    if (typeof src.dayZeroWarning === "boolean") out.dayZeroWarning = src.dayZeroWarning;
    else bad("Avertissement du jour J invalide.");
  }
  if (src.warningDays !== undefined) {
    const list = Array.isArray(src.warningDays) ? src.warningDays.map(Number) : null;
    if (list && list.length <= 6 && list.every((d) => isInt(d) && d >= 1 && d <= 60)) {
      out.warningDays = [...new Set(list)].sort((a, b) => b - a);
    } else bad("Délais d'avertissement : 6 valeurs au plus, entiers de 1 à 60 jours.");
  }
  if (src.autoArchiveDays !== undefined) {
    const n = Number(src.autoArchiveDays);
    if (isInt(n) && n >= 1 && n <= 365) out.autoArchiveDays = n;
    else bad("Délai d'archivage automatique : entier de 1 à 365 jours.");
  }
  if (src.maxExtensionDays !== undefined) {
    const n = Number(src.maxExtensionDays);
    if (isInt(n) && n >= 1 && n <= HARD_MAX_EXTENSION_DAYS) out.maxExtensionDays = n;
    else bad(`Durée maximale de prolongation : entier de 1 à ${HARD_MAX_EXTENSION_DAYS} jours.`);
  }
  out.maxExtensionDays = Math.min(out.maxExtensionDays, HARD_MAX_EXTENSION_DAYS);
  return out;
}

const pad = (n) => String(n).padStart(2, "0");
export function dayString(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** Fin de journée (UTC) d'une date « AAAA-MM-JJ », ou null si la date est invalide. */
export function endOfDay(dateText) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

/**
 * Prolongation : le propriétaire donne soit une date (`until`, AAAA-MM-JJ), soit un nombre de jours (`days`).
 * Le calcul part de la date réelle de validation (`nowMs`) ; la nouvelle date est strictement postérieure au jour de validation
 * et ne dépasse jamais le jour de validation + `maxDays` (30 au plus). Renvoie { expiresAt: Date, date }.
 */
export function resolveExtension({ nowMs, until = null, days = null, maxDays = HARD_MAX_EXTENSION_DAYS }) {
  const max = Math.min(Number(maxDays) || HARD_MAX_EXTENSION_DAYS, HARD_MAX_EXTENSION_DAYS);
  const today = dayString(nowMs);
  const lastAllowed = dayString(nowMs + max * DAY_MS);
  let date;
  if (until != null && until !== "") {
    date = String(until).slice(0, 10);
    if (endOfDay(date) == null) throw new Error("Date de prolongation invalide.");
  } else if (days != null && days !== "") {
    const n = Number(days);
    if (!isInt(n) || n < 1) throw new Error("Durée de prolongation invalide.");
    if (n > max) throw new Error(`Une prolongation ne peut pas dépasser ${max} jours.`);
    date = dayString(nowMs + n * DAY_MS);
  } else {
    date = lastAllowed; // sans précision : la durée maximale autorisée
  }
  if (date <= today) throw new Error("La nouvelle date doit être postérieure à aujourd'hui.");
  if (date > lastAllowed) throw new Error(`Une prolongation ne peut pas dépasser ${max} jours (jusqu'au ${lastAllowed}).`);
  return { expiresAt: new Date(endOfDay(date)), date };
}

const toMs = (v) => {
  if (v == null || v === "") return null;
  const ms = v instanceof Date ? v.getTime() : new Date(String(v)).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

/** Contrôle des dates de début et de fin (formulaire de publication). Renvoie { startsAt, expiresAt } (Date ou null). */
export function validatePublicationDates({ startsAt, expiresAt }, nowMs) {
  const s = toMs(startsAt);
  const e = toMs(expiresAt);
  if (Number.isNaN(s)) throw new Error("Date de début invalide.");
  if (Number.isNaN(e)) throw new Error("Date de fin invalide.");
  if (e != null && e <= nowMs) throw new Error("La date de fin doit être dans le futur.");
  if (s != null && e != null && e <= s) throw new Error("La date de fin doit être postérieure à la date de début.");
  return { startsAt: s == null ? null : new Date(s), expiresAt: e == null ? null : new Date(e) };
}

/** Jours d'avertissement applicables à une annonce publiée (du plus proche au plus lointain) ; vide si elle est déjà échue. */
export function applicableWarningDays(expiresAtMs, nowMs, days) {
  const left = expiresAtMs - nowMs;
  if (!(left > 0)) return [];
  return days.filter((d) => left <= d * DAY_MS).sort((a, b) => a - b);
}
export const warningKind = (days) => `BEFORE_${days}`;

/** Jours restants (arrondis au supérieur) ; négatif ou nul = échue. */
export function daysLeft(expiresAtMs, nowMs) {
  return Math.ceil((expiresAtMs - nowMs) / DAY_MS);
}

/** Libellé de statut affiché (§10) : « Programmée » et « Expire bientôt » se déduisent ; l'archivage dit s'il est automatique. */
export function displayStatus(row, nowMs, settings = DEFAULT_EXPIRY_SETTINGS) {
  if (row.status === "ARCHIVED") return row.archived_mode === "AUTO" ? "ARCHIVED_AUTO" : "ARCHIVED";
  if (row.status === "PUBLISHED" && row.expires_at) {
    const left = toMs(row.expires_at) - nowMs;
    if (left <= 0) return "EXPIRED";
    const window = Math.max(0, ...(settings.warningDays ?? [])) || 7;
    if (left <= window * DAY_MS) return "EXPIRING_SOON";
  }
  return row.status;
}
