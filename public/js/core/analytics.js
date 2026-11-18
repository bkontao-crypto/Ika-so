// Mesure de page vue (lot B). Aucune requête n'est envoyée sans l'accord « Statistiques » enregistré dans CE navigateur.
// Le serveur ne reçoit alors ni identifiant visiteur ni session : seulement le chemin de la page.
import { hasConsent } from "./consent.js";

/** Envoie la page vue seulement si « Statistiques » est accepté. Retourne vrai si une requête a été lancée. */
export function trackPageView(path, send, options) {
  if (!hasConsent("statistiques", options)) return false;
  try { Promise.resolve(send(path)).catch(() => undefined); } catch { /* la mesure ne doit jamais casser la page */ }
  return true;
}
