// Nom de la plateforme : réglage « platform_name » (modifiable par le Superadmin dans Owner Control).
// Une seule source côté serveur : tous les textes (e-mails, SMS, PDF, pages SEO, notifications) lisent brand().
export const DEFAULT_BRAND = "Ika So";
let current = DEFAULT_BRAND;

export const cleanBrand = (v) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
export const setBrand = (v) => { current = cleanBrand(v) || DEFAULT_BRAND; return current; };
export const brand = () => current;
export const brandUpper = () => current.toLocaleUpperCase("fr");
/** Pour les noms de fichiers : minuscules, sans accents, tirets. */
export const brandSlug = () => current.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plateforme";

/** Charge le nom enregistré (au démarrage). Une base indisponible laisse le nom courant. */
export async function loadBrand(db) {
  try {
    const rows = await db.query("select value from ika_settings where key = 'platform_name'");
    setBrand(rows[0]?.value);
  } catch { /* nom par défaut */ }
  return current;
}

/** Remplace, dans un texte écrit avec le nom d'origine (pages juridiques, documents), toutes ses graphies. À appliquer UNE seule fois, à la sortie. */
export function applyBrand(text) {
  if (current === DEFAULT_BRAND) return String(text ?? "");
  return String(text ?? "").replace(/IKA S[OÔ] Immobilier/gu, current).replace(/\bIKA S[OÔ](?![\p{L}])/gu, brandUpper()).replace(/\bIka S[oô](?![\p{L}])/gu, current);
}

/** Nom en majuscules pour le logo : le dernier mot en doré (ex. « IKA <span>SO</span> »). `esc` protège le texte. */
export function brandLogoHtml(esc) {
  const words = brandUpper().split(" ");
  if (words.length < 2) return esc(words[0]);
  const last = words.pop();
  return `${esc(words.join(" "))} <span class="logo-gold">${esc(last)}</span>`;
}
