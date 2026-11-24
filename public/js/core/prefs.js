// Service « Préférences » : mémorise sur CET appareil des réglages d'affichage (thème, filtres de recherche, mode d'affichage).
// Actif seulement si le Super Administrateur a activé le service (Owner center > Personnalisation > Services et consentement)
// ET si l'utilisateur a accepté « Préférences ». Retiré dès le retrait de l'accord.
import { hasConsent } from "./consent.js";

export const PREFS_KEY = "ika-so-prefs";
export const THEME_KEY = "ika_theme"; // lu aussi par les pages rendues par le serveur (seo-theme.js)

let serviceOn = false;
export function setPrefsService(on) { serviceOn = on === true; }
export const prefsService = () => serviceOn;

/** Vrai si l'on a le droit de mémoriser maintenant. */
export function prefsActive(options) { return serviceOn && hasConsent("preferences", options); }

function store() { try { return globalThis.localStorage ?? null; } catch { return null; } }
function readAll() { try { return JSON.parse(store()?.getItem(PREFS_KEY) ?? "{}") ?? {}; } catch { return {}; } }

/** Valeur mémorisée, ou `fallback` si le service est éteint, refusé ou la valeur absente. */
export function getPref(name, fallback = null) {
  if (!prefsActive()) return fallback;
  const v = readAll()[name];
  return v === undefined ? fallback : v;
}

/** Mémorise une valeur (sans effet si le service est éteint ou refusé). */
export function setPref(name, value) {
  if (!prefsActive()) return false;
  try { store()?.setItem(PREFS_KEY, JSON.stringify({ ...readAll(), [name]: value })); return true; } catch { return false; }
}

/** Efface tout ce que le service a mémorisé (retrait de l'accord ou service éteint). */
export function clearPrefs() {
  try { store()?.removeItem(PREFS_KEY); store()?.removeItem(THEME_KEY); } catch { /* ignoré */ }
}

/** Thème au démarrage : service actif → le choix mémorisé ; service éteint → comportement d'origine (mémorisé comme avant) ; service actif mais refusé → clair. */
export function savedTheme() {
  try {
    if (serviceOn && !hasConsent("preferences")) return "light";
    const t = store()?.getItem(THEME_KEY);
    return t === "dark" ? "dark" : "light";
  } catch { return "light"; }
}

/** Mémorise le thème : toujours si le service est éteint (comportement d'origine), seulement avec l'accord s'il est actif. */
export function saveTheme(theme) {
  if (serviceOn && !hasConsent("preferences")) return;
  try { store()?.setItem(THEME_KEY, theme); } catch { /* ignoré */ }
}
