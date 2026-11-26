// Connexion avec Google : flux « code d'autorisation » côté serveur (aucun secret dans le navigateur).
// Le secret client ne quitte jamais le serveur ; le jeton d'accès ne sert qu'à lire le profil, puis il est jeté.
import { randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const STATE_COOKIE = "ika_oauth";
export const STATE_MAX_AGE_S = 600;

export const newState = () => randomBytes(32).toString("base64url");

export function authorizationUrl({ clientId, redirectUri, state }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile",
    state, prompt: "select_account", access_type: "online",
  });
  return `${AUTH_URL}?${q}`;
}

/** Vrai si l'état reçu est exactement celui posé dans le cookie (comparaison à temps constant). */
export function sameState(received, expected) {
  const a = Buffer.from(String(received ?? ""));
  const b = Buffer.from(String(expected ?? ""));
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Cookie d'état : HttpOnly, SameSite=Lax (le retour de Google est une navigation de premier niveau), 10 minutes, porte aussi l'acceptation des conditions et la page d'arrivée. */
export function stateCookie(value, { production }) {
  // value est déjà encodé par packState : ne pas l'encoder une seconde fois.
  const parts = [`${STATE_COOKIE}=${value}`, "Path=/api/auth/google", "HttpOnly", "SameSite=Lax", `Max-Age=${STATE_MAX_AGE_S}`];
  if (production) parts.push("Secure");
  return parts.join("; ");
}
export const clearedStateCookie = () => `${STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Échange le code contre un jeton d'accès (appel serveur à serveur, TLS). */
export async function exchangeCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("Google a refusé l'échange du code.");
  return data.access_token;
}

/** Profil Google vérifié : identifiant stable (sub), e-mail confirmé par Google, nom. Sans e-mail confirmé, refus. */
export async function fetchProfile(accessToken, fetchImpl = fetch) {
  const res = await fetchImpl(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sub) throw new Error("Profil Google illisible.");
  if (data.email_verified !== true || !data.email) throw new Error("E-mail Google non confirmé.");
  return { sub: String(data.sub), email: String(data.email).trim().toLowerCase(), name: String(data.name ?? "").trim() };
}

/** Page d'arrivée sûre : chemin interne seulement (« /… », sans « // » ni adresse externe). */
export function safeNext(raw) {
  const v = String(raw ?? "");
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && v.length < 200 ? v : "/";
}

/**
 * Lit le cookie d'état : { s: état, n: page d'arrivée, t: acceptation des conditions, l: 1 si liaison depuis Mon profil, a: 1 si connexion lancée depuis l'application }, ou null.
 * t vaut 0 (conditions non acceptées), 1 (conditions + données indispensables) ou 2 (acceptation globale : conditions + données d'usage).
 * La valeur 2 doit être conservée : la ramener à 0 faisait refuser tous les nouveaux comptes Google après « Tout accepter ».
 */
export function readStateCookie(cookieHeader) {
  const raw = String(cookieHeader ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${STATE_COOKIE}=`));
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw.slice(STATE_COOKIE.length + 1)));
    return typeof v?.s === "string" ? { s: v.s, n: safeNext(v.n), t: v.t === 2 ? 2 : v.t === 1 ? 1 : 0, l: v.l === 1 ? 1 : 0, a: v.a === 1 ? 1 : 0 } : null;
  } catch { return null; }
}
export const packState = (obj) => encodeURIComponent(JSON.stringify(obj));

const escAttr = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Page de retour vers l'application Android. Une simple redirection 302 vers ikaso:// est souvent bloquée par le navigateur
 * (aucun geste de la personne) : on affiche donc un bouton « Ouvrir IKA SÔ » (le toucher autorise l'ouverture de l'application),
 * en tentant aussi l'ouverture automatique. Le lien « intent: » n'impose pas de nom de paquet (version normale ou debug).
 * Aucun script ni style en ligne (la politique de sécurité du site les interdit) : la mise en forme vient de /css/ika.css.
 */
export function appReturnPage(ticket) {
  const t = encodeURIComponent(ticket);
  const scheme = `ikaso://login?ticket=${t}`;
  const intent = `intent://login?ticket=${t}#Intent;scheme=ikaso;end`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${escAttr(scheme)}">
<title>Connexion réussie | IKA SÔ</title><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/ika.css"></head>
<body><main class="container stack">
<h1>Connexion réussie</h1>
<p>Appuyez sur le bouton pour revenir dans l'application IKA SÔ. Le lien expire dans une minute.</p>
<p><a class="btn btn-primary btn-block" href="${escAttr(intent)}">Ouvrir IKA SÔ</a></p>
<p class="small muted"><a href="${escAttr(scheme)}">Le bouton ne fonctionne pas ? Essayer ce lien</a></p>
</main></body></html>`;
}

const APP_FAIL = {
  "compte-existant": "Cette adresse e-mail a déjà un compte IKA SÔ protégé par un mot de passe. Pour votre sécurité, Google ne s'y connecte pas tout seul : ouvrez le site dans Chrome, connectez-vous avec votre mot de passe, puis liez Google depuis « Mon profil ».",
  conditions: "Les conditions d'utilisation n'ont pas été acceptées. Revenez dans l'application, cochez la case des conditions, puis recommencez.",
  bloque: "Ce compte est bloqué.",
  refus: "Connexion Google annulée.",
  etat: "La connexion Google a expiré. Revenez dans l'application et recommencez.",
  indisponible: "La connexion avec Google n'est pas disponible pour le moment.",
  echec: "La connexion Google a échoué. Revenez dans l'application et réessayez, ou utilisez votre mot de passe.",
};

/** Page affichée dans le navigateur quand la connexion Google lancée depuis l'application échoue : dit pourquoi et ramène à l'application (au lieu d'ouvrir le site, éventuellement connecté à un autre compte). */
export function appFailPage(code) {
  const msg = APP_FAIL[code] ?? APP_FAIL.echec;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Connexion Google impossible | IKA SÔ</title><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/ika.css"></head>
<body><main class="container stack">
<h1>Connexion Google impossible</h1>
<p role="alert">${escAttr(msg)}</p>
<p><a class="btn btn-primary btn-block" href="intent://login#Intent;scheme=ikaso;end">Retourner dans l'application</a></p>
</main></body></html>`;
}

// Connexion native (application Android) : l'identifiant Google (ID token) est vérifié côté serveur.
export const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
export const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/** Revendications d'un ID token Google : destinataire, émetteur, échéance, e-mail confirmé. Sinon erreur. */
export function profileFromIdTokenClaims(claims, clientId, nowS = Math.floor(Date.now() / 1000)) {
  if (!claims || typeof claims !== "object") throw new Error("Jeton Google illisible.");
  if (!clientId || claims.aud !== clientId) throw new Error("Jeton Google destiné à une autre application.");
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new Error("Émetteur Google inconnu.");
  if (!(Number(claims.exp) > nowS)) throw new Error("Jeton Google expiré.");
  if (!claims.sub) throw new Error("Profil Google illisible.");
  if (String(claims.email_verified) !== "true" || !claims.email) throw new Error("E-mail Google non confirmé.");
  return { sub: String(claims.sub), email: String(claims.email).trim().toLowerCase(), name: String(claims.name ?? "").trim() };
}

/** Vérifie un ID token auprès de Google (tokeninfo), puis ses revendications. */
export async function verifyIdToken(idToken, clientId, fetchImpl = fetch) {
  const res = await fetchImpl(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Jeton Google refusé.");
  return profileFromIdTokenClaims(data, clientId);
}
