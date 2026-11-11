/**
 * Lecture publique de l'historique de prix.
 * `rows` : points { price, recorded_at } du plus récent au plus ancien.
 * Renvoie les points avec la variation par rapport au point précédent (en FCFA et en %),
 * ou une liste vide s'il n'y a pas eu de changement (un seul point : rien à montrer).
 */
export function buildPriceHistory(rows) {
  const points = rows
    .map((r) => ({ price: Number(r.price), at: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at) }))
    .filter((p) => Number.isFinite(p.price) && p.price > 0);
  if (points.length < 2) return [];
  return points.map((p, i) => {
    const before = points[i + 1];
    if (!before) return { ...p, change: null, changePercent: null };
    return { ...p, change: p.price - before.price, changePercent: Math.round(((p.price - before.price) / before.price) * 1000) / 10 };
  });
}
