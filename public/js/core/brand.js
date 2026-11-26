// Nom de la plateforme côté navigateur. Le serveur l'écrit dans <meta name="site-name"> (réglage du Superadmin) :
// il est donc connu dès le premier affichage, sans attendre une requête.
const DEFAULT = "Ika So";
const read = () => { try { return document.querySelector('meta[name="site-name"]')?.content?.trim() || ""; } catch { return ""; } };
let current = (() => { const v = read(); return v && !v.startsWith("{{") ? v : DEFAULT; })();

export const brand = () => current;
export const brandUpper = () => current.toLocaleUpperCase("fr");
export const brandSlug = () => current.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plateforme";
export function setBrand(name) {
  const v = String(name ?? "").trim();
  if (v) current = v;
  return current;
}
