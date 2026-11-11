import { forbidden } from "./errors.js";

export const SESSION_COOKIE = "ika_session";

/**
 * Politique de contenu. Sans jeton Mapbox : AUCUNE ressource externe (valeur d'origine, verrouillée par web.test.js).
 * Avec un jeton public valide : uniquement les adresses Mapbox nécessaires au fond de carte ; le code de la bibliothèque
 * reste hébergé chez nous (public/vendor/), donc script-src ne change pas.
 */
export function contentSecurityPolicy(config = {}) {
  const mapbox = Boolean(config.mapbox?.token);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    mapbox ? "img-src 'self' data: blob: https://api.mapbox.com" : "img-src 'self' data:",
    "font-src 'self'",
    mapbox ? "connect-src 'self' https://api.mapbox.com https://events.mapbox.com" : "connect-src 'self'",
    ...(mapbox ? ["worker-src 'self' blob:", "child-src 'self' blob:"] : []),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** En-têtes de sécurité (voir contentSecurityPolicy). */
export function securityHeaders(config) {
  const csp = contentSecurityPolicy(config);
  return (req, res, next) => {
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("X-Frame-Options", "DENY");
    if (config.production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  };
}

/**
 * Protection CSRF en plus de SameSite=Lax : toute requête qui modifie des données doit
 * venir de notre propre origine et porter du JSON.
 */
export function sameOriginOnly(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      return next(forbidden("Origine refusée."));
    }
    if (host !== req.get("host")) return next(forbidden("Origine refusée."));
  }
  const length = Number(req.get("content-length") ?? 0);
  // Seule exception : la notification des agrégateurs de paiement (formulaire, sans en-tête Origin), dont la vérité vient du fournisseur interrogé ensuite.
  const isWebhookForm = !origin && req.originalUrl?.split("?")[0] === "/api/payments/webhook" && /application\/x-www-form-urlencoded/i.test(String(req.headers?.["content-type"] ?? ""));
  if (length > 0 && !req.is("application/json") && !isWebhookForm) return next(forbidden("Format refusé."));
  next();
}

export function sessionCookie(token, config) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${30 * 24 * 3600}`];
  if (config.production) parts.push("Secure");
  return parts.join("; ");
}

export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

const clean = (value, max = 200) => String(value ?? "").slice(0, max);
const num = (value) => (value == null || value === "" ? null : Number(value));

/** Lit un brouillon d'annonce reçu du navigateur. La validation métier est faite par les services. */
export function readDraft(body = {}) {
  return {
    title: clean(body.title, 300),
    description: clean(body.description, 4000),
    category: clean(body.category),
    transactionType: clean(body.transactionType),
    neighborhood: clean(body.neighborhood),
    countryCode: clean(body.countryCode, 2),
    price: Number(body.price),
    surfaceLabel: clean(body.surfaceLabel),
    surfaceM2: num(body.surfaceM2),
    roadAccess: body.roadAccess ? clean(body.roadAccess) : null,
    bedrooms: num(body.bedrooms),
    bathrooms: num(body.bathrooms),
    furnished: typeof body.furnished === "boolean" ? body.furnished : null,
    declaredDocument: body.declaredDocument ? clean(body.declaredDocument) : null,
    imageUrl: clean(body.imageUrl, 2_800_000),
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 10).map((u) => clean(u, 2_800_000)) : undefined,
    ownerRole: clean(body.ownerRole),
    fullName: clean(body.fullName, 120),
  };
}

export { clean };
