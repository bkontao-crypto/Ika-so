// Branchement futur d'un service de suivi d'erreurs (Sentry, GlitchTip, webhook maison…).
// Aujourd'hui : les journaux JSON restent la référence. Un « sink » reçoit en plus chaque ligne de niveau error.
// Pour brancher un service plus tard : écrire une fonction (event) => Promise et la passer à createLogger({ sinks }).
// Règle : l'événement a déjà été nettoyé (jamais d'IP, de cookie ni de contenu de requête).

/** Envoi optionnel vers une adresse HTTPS de votre choix (variable ERROR_WEBHOOK_URL). Désactivé si la variable est vide. */
export function createWebhookSink(url, fetchImpl = fetch) {
  if (!url) return null;
  return async (event) => {
    try {
      await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), signal: AbortSignal.timeout(3000) });
    } catch {
      /* un suivi en panne ne doit jamais faire tomber le site */
    }
  };
}
