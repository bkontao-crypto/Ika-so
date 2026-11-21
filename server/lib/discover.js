// « Découvrir » : publications de la communauté (actualité, information, demande), distinctes des annonces professionnelles.
export const KINDS = Object.freeze({ ACTUALITE: "Actualité", RECHERCHE: "Je cherche", INFORMATION: "Information" });
export const CATEGORIES = Object.freeze(["Terrain", "Maison", "Appartement", "Studio", "Local commercial", "Bureau"]);
export const REPORT_REASONS = Object.freeze(["Annonce déguisée ou publicité", "Arnaque ou demande d'argent", "Contenu choquant ou insultant", "Numéro de téléphone ou contact direct", "Autre"]);
export const TEXT_MIN = 5;
export const TEXT_MAX = 2000;

/**
 * Détecte un numéro de téléphone saisi dans le texte (les échanges passent par la messagerie du site) :
 * indicatif +223 / 00223 ; 8 chiffres groupés par deux avec le même séparateur (76 00 00 00) ; 8 chiffres collés commençant par 5, 6, 7 ou 9.
 * Un prix groupé par trois (« 25 000 000 ») n'est pas pris pour un numéro.
 */
export function containsPhone(text) {
  const t = String(text ?? "");
  return /(?:\+|00)\s*223/.test(t)
    || /(?<!\d)\d{2}([\s.\-])\d{2}\1\d{2}\1\d{2}(?!\d)/.test(t)
    || /(?<!\d)[5679]\d{7}(?!\d)/.test(t);
}

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const FB_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"]);
export const VIDEO_PROVIDERS = Object.freeze({ youtube: "YouTube", facebook: "Facebook" });

/**
 * Valide et nettoie un lien vidéo YouTube ou Facebook. Seuls ces deux sites sont acceptés, en https, sans identifiant ni port.
 * Les paramètres de suivi sont retirés. Renvoie { provider, url } ou null. Aucune vidéo n'est stockée chez nous.
 */
export function parseVideoLink(input) {
  const raw = String(input ?? "").trim();
  if (!raw || raw.length > 300) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    const id = host === "youtu.be" ? u.pathname.split("/")[1] : u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(shorts|live|embed)\//.test(u.pathname) ? u.pathname.split("/")[2] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube", url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (FB_HOSTS.has(host)) {
    const path = u.pathname.replace(/\/+$/, "");
    const okPath = host === "fb.watch" ? /^\/[A-Za-z0-9_-]{4,40}$/.test(path)
      : /^\/(watch|reel\/\d+|share\/[vr]\/[A-Za-z0-9_-]+|[A-Za-z0-9.\-_]+\/videos\/(?:[^/]+\/)?\d+)$/.test(path);
    if (!okPath) return null;
    const v = path === "/watch" ? u.searchParams.get("v") : null;
    if (path === "/watch" && !/^\d{5,25}$/.test(v ?? "")) return null;
    return { provider: "facebook", url: `https://${host === "fb.watch" ? "fb.watch" : "www.facebook.com"}${path}${v ? `?v=${v}` : ""}` };
  }
  return null;
}
