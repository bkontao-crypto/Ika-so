// Règles pures de recherche et de détection de doublons (testées sans base).
export const SORTS = { recent: "recent", priceAsc: "price_asc", priceDesc: "price_desc", relevance: "relevance" };
export const PAGE_MAX = 50;

/** Minuscules, sans accents, espaces simplifiés : même normalisation que ika_norm() côté SQL. */
export const normalizeText = (value) =>
  String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Nettoie les paramètres de recherche venant du navigateur. */
export function readSearch(raw = {}) {
  const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  const q = normalizeText(String(raw.query ?? "").slice(0, 80));
  const sort = Object.values(SORTS).includes(raw.sort) ? raw.sort : q ? SORTS.relevance : SORTS.recent;
  return {
    transaction: raw.transaction ?? "",
    category: raw.category ?? "",
    zone: raw.zone ? String(raw.zone).slice(0, 120) : "",
    maxPrice: positive(raw.maxPrice),
    minPrice: positive(raw.minPrice),
    minSurface: positive(raw.minSurface),
    bedrooms: positive(raw.bedrooms),
    q,
    sort: sort === SORTS.relevance && !q ? SORTS.recent : sort,
    limit: Math.min(positive(raw.limit) ?? 24, PAGE_MAX),
    offset: Math.min(positive(raw.offset) ?? 0, 10_000),
  };
}

const within = (a, b, ratio) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= ratio;

/**
 * Deux annonces sont « proches » quand elles décrivent probablement le même bien :
 * même transaction, même type, même quartier, prix à 5 % près et, si connues, superficies à 5 % près.
 */
export function looksLikeSameProperty(a, b) {
  if (a.transactionType !== b.transactionType || a.category !== b.category) return false;
  if (normalizeText(a.neighborhood) !== normalizeText(b.neighborhood)) return false;
  if (!within(Number(a.price), Number(b.price), 0.05)) return false;
  if (a.surfaceM2 && b.surfaceM2 && !within(Number(a.surfaceM2), Number(b.surfaceM2), 0.05)) return false;
  return true;
}

/**
 * Une recherche enregistrée correspond-elle à une annonce ? Même sens que les filtres du catalogue :
 * transaction, type, quartier, prix, superficie, chambres, mots (tous les mots doivent apparaître, sans accents).
 */
export function matchesSearch(filters, card) {
  const f = filters ?? {};
  if (f.transaction && f.transaction !== card.transactionType) return false;
  if (f.category && f.category !== card.category) return false;
  if (f.zone && f.zone !== card.neighborhood) return false;
  if (f.maxPrice && !(card.price <= Number(f.maxPrice))) return false;
  if (f.minPrice && !(card.price >= Number(f.minPrice))) return false;
  if (f.minSurface && !((card.surfaceM2 ?? 0) >= Number(f.minSurface))) return false;
  if (f.bedrooms && !((card.bedrooms ?? 0) >= Number(f.bedrooms))) return false;
  const words = normalizeText(f.q).split(" ").filter(Boolean);
  if (words.length) {
    const text = normalizeText(`${card.title} ${card.neighborhood} ${card.description}`);
    if (!words.every((w) => text.includes(w))) return false;
  }
  return true;
}

/** Ne garde que les filtres connus, bornés : ce qu'on enregistre vient du navigateur. */
export function cleanSearchFilters(raw = {}) {
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : undefined);
  const out = {
    transaction: raw.transaction ? String(raw.transaction).slice(0, 20) : undefined,
    category: raw.category ? String(raw.category).slice(0, 30) : undefined,
    zone: raw.zone ? String(raw.zone).slice(0, 120) : undefined,
    maxPrice: num(raw.maxPrice), minPrice: num(raw.minPrice), minSurface: num(raw.minSurface), bedrooms: num(raw.bedrooms),
    q: raw.q ? String(raw.q).slice(0, 80) : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ""));
}
