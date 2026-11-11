// Classement de l'annuaire des annonceurs. Module pur (sans base) : testé seul.
// Quatre critères, tous constatés par Ika So : confiance, visibilité, fidélité, réactivité aux clients.
// Règle d'or : un annonceur « boosté » (annonce mise à la une en cours) passe devant, quel que soit son statut ou son score.
import { trustSummary } from "../services/reviews.js";

export const WEIGHTS = Object.freeze({ trust: 0.4, visibility: 0.2, loyalty: 0.2, reactivity: 0.2 });
const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

/** Note ramenée vers 3,5/5 quand il y a peu d'avis : un seul « 5 » ne place pas un inconnu devant tout le monde. */
export function bayesianRating(average, count, prior = 3.5, weight = 5) {
  const n = Math.max(0, Number(count) || 0);
  return n ? ((Number(average) || 0) * n + prior * weight) / (n + weight) : prior;
}

/** `m` : { average, reviewCount, replied, days, live, closed, views30, threads, answered, phoneBySms, titleChecked, agencyVerified } */
export function scoreAdvertiser(m) {
  const trust = trustSummary({ phoneBySms: m.phoneBySms, days: m.days, publishedNow: m.live, titleChecked: m.titleChecked, agencyVerified: m.agencyVerified, reviewCount: m.reviewCount, average: m.average });
  const trustPart = clamp(0.6 * (bayesianRating(m.average, m.reviewCount) / 5) * 100 + 0.4 * (trust.met / trust.total) * 100);
  const visibility = clamp((Math.min(m.live, 20) / 20) * 50 + (Math.min(m.views30, 500) / 500) * 50);
  const loyalty = clamp((Math.min(m.days, 730) / 730) * 50 + (Math.min(m.closed, 10) / 10) * 30 + (Math.min(m.reviewCount, 20) / 20) * 20);
  // Réactivité : part des conversations où l'annonceur a répondu, et part des avis auxquels il a répondu. Peu de données = neutre (50).
  const answeredRate = m.threads >= 3 ? (m.answered / m.threads) * 100 : null;
  const replyRate = m.reviewCount >= 3 ? (m.replied / m.reviewCount) * 100 : null;
  const reactivity = clamp(answeredRate == null && replyRate == null ? 50 : answeredRate != null && replyRate != null ? 0.7 * answeredRate + 0.3 * replyRate : (answeredRate ?? replyRate));
  const score = Math.round(trustPart * WEIGHTS.trust + visibility * WEIGHTS.visibility + loyalty * WEIGHTS.loyalty + reactivity * WEIGHTS.reactivity);
  return { score, trust, parts: { trust: Math.round(trustPart), visibility: Math.round(visibility), loyalty: Math.round(loyalty), reactivity: Math.round(reactivity) }, responseRate: answeredRate == null ? null : Math.round(answeredRate) };
}

/** Boostés d'abord, puis score, puis nombre d'avis, puis nom. */
export function compareDirectory(a, b) {
  return (Number(b.boosted) - Number(a.boosted)) || (b.score - a.score) || (b.rating.count - a.rating.count) || a.name.localeCompare(b.name, "fr");
}

export const KINDS = Object.freeze({ agency: /agence/i, individual: /propri[eé]taire/i, agent: /d[eé]marcheur/i });
const plain = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Filtre « q » (nom, quartier) et « kind » (agency | individual | agent | certified | boosted). */
export function filterDirectory(rows, { q = "", kind = "" } = {}) {
  const needle = plain(q).trim();
  return rows.filter((r) => {
    if (needle && !plain(`${r.name} ${r.neighborhood}`).includes(needle)) return false;
    if (kind === "certified") return r.certified;
    if (kind === "boosted") return r.boosted;
    if (KINDS[kind]) return KINDS[kind].test(r.role);
    return true;
  });
}

/** Accès au centre de contrôle : Premium en cours ET annonceur certifié. */
export function premiumAccess({ premiumUntil, agencyVerified, titleChecked }, now = Date.now()) {
  const until = premiumUntil ? new Date(premiumUntil).getTime() : 0;
  const premium = until > now;
  const certified = Boolean(agencyVerified) || Number(titleChecked) > 0;
  return { premium, certified, eligible: premium && certified, premiumUntil: until ? new Date(until).toISOString() : null, daysLeft: premium ? Math.ceil((until - now) / 86_400_000) : 0 };
}
