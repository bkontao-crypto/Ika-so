// État de session partagé par toutes les pages. Une seule source : le serveur (/api/me).
import { api } from "/js/dom.js";

export const app = document.getElementById("app");
export const S = { user: null, meta: null, unread: 0 }; // { user, meta } renvoyés par /api/me
export const DRAFT_KEY = "ika-so-draft";

const listeners = new Set();
export const onSession = (fn) => listeners.add(fn);

export async function refreshSession() {
  const data = await api("/me");
  S.user = data.user;
  S.meta = data.meta ?? null;
  listeners.forEach((fn) => fn());
}

export function clearSession() {
  S.user = null;
  S.meta = null;
  listeners.forEach((fn) => fn());
}

/** Nombre d'éléments à lire (alertes, messages, visites à traiter). Interrogé toutes les 30 s tant que la page est visible. */
export async function refreshUnread() {
  if (!S.user) { S.unread = 0; listeners.forEach((fn) => fn()); return; }
  try {
    const c = await api("/me/unread");
    const total = c.notifications + c.threads + c.visits;
    if (total !== S.unread) { S.unread = total; listeners.forEach((fn) => fn()); }
  } catch { /* hors connexion : on garde le dernier nombre */ }
}
setInterval(() => { if (!document.hidden) refreshUnread(); }, 30_000);
