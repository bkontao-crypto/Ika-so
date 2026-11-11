/**
 * Envoi de SMS. Un fournisseur = une fonction (numéro, texte). Choisi par SMS_PROVIDER ; aucun n'est actif par défaut.
 * ⚠ Ces adaptateurs sont écrits d'après la documentation publique et testés avec un faux réseau : jamais exécutés
 * contre le vrai service. Premier essai réel à faire avec un numéro à vous (voir docs/fournisseurs.md).
 */
const FAIL = "Envoi du SMS impossible. Réessayez dans un instant.";

export function createTwilioSender(config, fetchImpl = fetch) {
  return async function sendSms(to, body) {
    const { accountSid, authToken, from } = config.sms;
    const response = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(FAIL);
  };
}

// Infobip : POST {baseUrl}/sms/2/text/advanced, en-tête « Authorization: App <clé> ». Groupes de statut refusés : 2 (non livrable), 4 (expiré), 5 (rejeté).
export function createInfobipSender(config, fetchImpl = fetch) {
  return async function sendSms(to, body) {
    const { infobipBaseUrl, infobipApiKey, infobipFrom } = config.sms;
    const response = await fetchImpl(`${infobipBaseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: { Authorization: `App ${infobipApiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messages: [{ from: infobipFrom, destinations: [{ to: String(to).replace(/[^\d]/g, "") }], text: body }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(FAIL);
    const data = await response.json().catch(() => null);
    const group = data?.messages?.[0]?.status?.groupId;
    if ([2, 4, 5].includes(group)) throw new Error(FAIL);
  };
}

/** Choisit l'envoi SMS selon SMS_PROVIDER. Sans fournisseur complet : une fonction qui refuse (aucun numéro n'est vérifié). */
export function createSmsSender(config, fetchImpl = fetch) {
  if (config.sms.provider === "twilio") return createTwilioSender(config, fetchImpl);
  if (config.sms.provider === "infobip") return createInfobipSender(config, fetchImpl);
  return async () => { throw new Error("SMS non configuré."); };
}
