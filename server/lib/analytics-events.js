// Événements analytiques côté serveur : liste blanche, nettoyage, classement (appareil, robot, origine). Module pur (sans base).
// Vie privée : jamais d'adresse IP, de cookie, de texte saisi ni d'adresse complète ; aucune collecte si « Ne pas suivre » ou GPC est envoyé.
// Liste identique à la contrainte de la migration 023 (un test le vérifie).
export const EVENT_TYPES = Object.freeze([
  "page_view", "listing_view", "contact_clicked", "phone_clicked", "whatsapp_clicked", "contact_request_created", "visit_requested", "message_sent",
  "listing_favorite_added", "listing_favorite_removed", "comment_created", "comment_deleted", "listing_created", "listing_updated", "listing_published", "listing_archived",
  "user_registered", "user_login", "user_logout", "verification_completed", "report_created", "payment_completed",
  "premium_cta_clicked", "premium_checkout_started",
]);
/** Emplacements d'invitation Premium suivis (liste fermée : toute autre valeur devient « autre »). */
export const PREMIUM_ORIGINS = Object.freeze(["espace-hero", "espace-teaser", "espace-card", "espace-sidebar", "espace-lock", "espace-lockline", "espace-perk", "partenaires", "agence", "compte", "centre", "page-premium", "autre"]);
export const premiumOrigin = (v) => (PREMIUM_ORIGINS.includes(v) ? v : "autre");
/** Clés de métadonnées permises par type ; toute autre clé est supprimée. */
const META_KEYS = { report_created: ["target"], phone_clicked: ["from"], whatsapp_clicked: ["from"], message_sent: ["from"], contact_clicked: ["from"], verification_completed: ["from"], premium_cta_clicked: ["from"], premium_checkout_started: ["from"], payment_completed: ["from", "kind"] };
const TARGETS = new Set(["listing", "profile", "user"]);

export function shouldTrack(headers = {}) {
  return String(headers.dnt ?? "") !== "1" && String(headers["sec-gpc"] ?? "") !== "1";
}
export function isBot(ua) {
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python-requests|httpclient/i.test(String(ua ?? ""));
}
export function classifyDevice(ua) {
  const s = String(ua ?? "");
  if (!s) return null;
  if (/ipad|tablet|kindle|silk/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/i.test(s)) return "mobile";
  return "desktop";
}
/** Origine du visiteur : une classe, jamais l'adresse de la page d'origine. */
export function classifySource(referer, ownHost) {
  let host;
  try { host = new URL(String(referer ?? "")).hostname.toLowerCase(); } catch { return "direct"; }
  if (!host || (ownHost && host === String(ownHost).split(":")[0].toLowerCase())) return "direct";
  if (/(^|\.)google\./.test(host) || /(^|\.)(bing|duckduckgo|yahoo)\./.test(host)) return "search";
  if (/(^|\.)(facebook|fb)\.com$|(^|\.)l\.facebook\.com$/.test(host)) return "facebook";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  return "other";
}
const text = (v, max) => { const s = String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max); return s || null; };

function cleanMetadata(type, metadata) {
  const out = {};
  for (const key of META_KEYS[type] ?? []) {
    const v = metadata?.[key];
    if (key === "target") { if (TARGETS.has(v)) out.target = v; } else if (typeof v === "string") { const t = text(v, 40); if (t) out[key] = t; }
  }
  return out;
}

/** Construit la ligne à enregistrer. Type inconnu : erreur (faute de programmation, jamais d'insertion silencieuse). */
export function buildEvent(type, fields = {}, { headers = {}, host = "", now = new Date(), eventId } = {}) {
  if (!EVENT_TYPES.includes(type)) throw new Error(`Type d'événement inconnu : ${type}`);
  if (!eventId) throw new Error("Identifiant d'événement manquant.");
  const ua = headers["user-agent"];
  return {
    event_id: eventId, event_type: type, occurred_at: now.toISOString(),
    user_id: text(fields.userId, 80), visitor_id: null, session_id: null, country_code: null, // visiteur anonyme et pays : après avis juridique
    listing_id: text(fields.listingId, 80), advertiser_id: text(fields.advertiserId, 80), agency_id: text(fields.agencyId, 80),
    page_path: type === "page_view" ? text(fields.pagePath, 160)?.split("?")[0]?.split("#")[0] ?? "/" : null, source: classifySource(headers.referer, host), device_type: classifyDevice(ua), is_bot: isBot(ua),
    metadata: cleanMetadata(type, fields.metadata),
  };
}
