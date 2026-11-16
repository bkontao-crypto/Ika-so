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

/** Lit le cookie d'état : { s: état, n: page d'arrivée, t: 1 si conditions acceptées, l: 1 si liaison depuis Mon profil, a: 1 si connexion lancée depuis l'application }, ou null. */
export function readStateCookie(cookieHeader) {
  const raw = String(cookieHeader ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${STATE_COOKIE}=`));
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw.slice(STATE_COOKIE.length + 1)));
    return typeof v?.s === "string" ? { s: v.s, n: safeNext(v.n), t: v.t === 1 ? 1 : 0, l: v.l === 1 ? 1 : 0, a: v.a === 1 ? 1 : 0 } : null;
  } catch { return null; }
}
export const packState = (obj) => encodeURIComponent(JSON.stringify(obj));
