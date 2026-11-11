import { S } from "/js/core/state.js";

export function currentRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}

export function go(path) {
  location.hash = `#${path}`;
}

/** Page réservée aux comptes connectés : renvoie vers la connexion, puis revient ici. */
export function needLogin() {
  if (S.user) return false;
  const { path } = currentRoute();
  go(`/connexion?next=${encodeURIComponent(path)}`);
  return true;
}
