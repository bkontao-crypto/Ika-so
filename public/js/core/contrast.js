// Couleur de texte lisible sur une couleur de fond (norme WCAG) : blanc ou vert très sombre, selon le meilleur contraste.
const DARK = "#04130c";
const lum = ([r, g, b]) => [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
function rgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export const contrastRatio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Texte à poser sur `hex` : "#ffffff" ou "#04130c" ; null si la couleur est invalide. */
export function readableOn(hex) {
  const bg = rgb(hex);
  if (!bg) return null;
  return contrastRatio(bg, [255, 255, 255]) >= contrastRatio(bg, rgb(DARK)) ? "#ffffff" : DARK;
}
