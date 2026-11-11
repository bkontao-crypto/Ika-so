// Règles pures de la confiance (testées sans base).
export const PROOF_MAX_BYTES = 700 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Valide un justificatif reçu en « data URL ». Renvoie { type, bytes } ou lance une erreur lisible. */
export function parseProofFile(dataUrl) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ""));
  if (!m) throw new Error("Fichier illisible. Envoyez une photo ou un PDF.");
  if (!TYPES.includes(m[1])) throw new Error("Format refusé. Envoyez une photo (JPEG, PNG, WebP) ou un PDF.");
  const bytes = Math.floor((m[2].length * 3) / 4) - (m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0);
  if (bytes > PROOF_MAX_BYTES) throw new Error("Fichier trop lourd (700 Ko au plus).");
  if (bytes < 200) throw new Error("Fichier vide.");
  return { type: m[1], bytes };
}

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Prix anormal : moins de 40 % ou plus de 250 % de la médiane de comparables (au moins 3). */
export function priceAnomaly(value, comparables) {
  if (comparables.length < 3 || !(value > 0)) return null;
  const mid = median(comparables);
  if (!mid) return null;
  const ratio = value / mid;
  if (ratio < 0.4) return { ratio, label: "très inférieur au marché du quartier" };
  if (ratio > 2.5) return { ratio, label: "très supérieur au marché du quartier" };
  return null;
}
