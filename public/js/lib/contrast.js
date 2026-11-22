// Lisibilité des couleurs (WCAG 2.x) : fonctions pures, partagées par l'écran Owner (aperçu) et le serveur (blocage à la publication).
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const MIN_TEXT = 4.5;   // texte courant : illisible en dessous
export const MIN_LARGE = 3;    // grand texte / élément d'interface

export const isHex = (v) => HEX.test(String(v ?? "").trim());
export function normalizeHex(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!HEX.test(s)) return null;
  return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
}
const rgb = (hex) => { const n = normalizeHex(hex); return n ? [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16)) : null; };
const toHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
export function luminance(hex) {
  const c = rgb(hex); if (!c) return null;
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Rapport de contraste entre deux couleurs (1 à 21), ou null si une couleur est invalide. */
export function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  if (a == null || b == null) return null;
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
/** Niveau : "ok" (≥ 4,5), "low" (entre 3 et 4,5 : peu lisible), "bad" (< 3 : illisible). */
export const level = (r) => (r == null ? "bad" : r >= MIN_TEXT ? "ok" : r >= MIN_LARGE ? "low" : "bad");
/** Mélange d'une couleur sur un fond (opacité 0..1) : pour un voile posé sur une photo. */
export function blend(top, bottom, alpha) {
  const t = rgb(top), b = rgb(bottom); if (!t || !b) return null;
  return toHex(t.map((v, i) => v * alpha + b[i] * (1 - alpha)));
}
/** Couleur de texte lisible la plus proche du choix : garde la teinte, éclaircit ou fonce jusqu'à 4,5:1 (dans le sens qui y arrive) ; à défaut noir ou blanc, le plus contrasté. */
export function suggestInk(fg, bg) {
  const f = rgb(fg), b = rgb(bg); if (!b) return null;
  if (f && ratio(fg, bg) >= MIN_TEXT) return normalizeHex(fg);
  const white = [255, 255, 255], black = [0, 0, 0];
  const first = (luminance(bg) ?? 0) < 0.18 ? white : black; // fond sombre : on éclaircit d'abord
  for (const target of [first, first === white ? black : white]) {
    const base = f ?? target;
    for (let k = 0.05; k <= 1.0001; k += 0.05) {
      const c = toHex(base.map((v, i) => v + (target[i] - v) * k));
      if (ratio(c, bg) >= MIN_TEXT) return c;
    }
  }
  return ratio("#ffffff", bg) >= ratio("#000000", bg) ? "#ffffff" : "#000000";
}
