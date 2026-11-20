// Mesure de page vue (lot B). Aucune requête n'est envoyée sans l'accord « Statistiques » enregistré dans CE navigateur.
// Le serveur ne reçoit alors ni identifiant visiteur ni session : seulement le chemin de la page.
import { hasConsent } from "./consent.js";

/** Envoie la page vue seulement si « Statistiques » est accepté. Retourne vrai si une requête a été lancée. */
export function trackPageView(path, send, options) {
  if (!hasConsent("statistiques", options)) return false;
  try { Promise.resolve(send(path)).catch(() => undefined); } catch { /* la mesure ne doit jamais casser la page */ }
  return true;
}

/**
 * Durée de visionnage d'une fiche : ne compte que le temps où l'onglet est visible. Envoyée une seule fois à la sortie
 * (changement de page, fermeture, retour à l'écran d'accueil du téléphone). Moins de 2 secondes : ignorée.
 * Retourne une fonction d'arrêt (aucun envoi). Ne casse jamais la page.
 */
export function watchDwell(listingId) {
  let visibleMs = 0;
  let since = document.visibilityState === "visible" ? Date.now() : null;
  let done = false;
  const pause = () => { if (since != null) { visibleMs += Date.now() - since; since = null; } };
  const onVisibility = () => { if (document.visibilityState === "visible") { since ??= Date.now(); } else pause(); };
  const cleanup = () => {
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("hashchange", flush);
  };
  function flush() {
    if (done) return;
    pause();
    cleanup();
    const seconds = Math.min(1800, Math.round(visibleMs / 1000));
    if (seconds < 2) return;
    try {
      const url = `/api/listings/${encodeURIComponent(listingId)}/dwell`;
      const body = JSON.stringify({ seconds });
      if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" })))) {
        fetch(url, { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body }).catch(() => undefined);
      }
    } catch { /* la mesure ne doit jamais casser la page */ }
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  window.addEventListener("hashchange", flush);
  return () => { if (!done) cleanup(); };
}
