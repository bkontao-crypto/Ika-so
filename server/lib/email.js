/**
 * Envoi d'e-mails transactionnels par API HTTP (aucune dépendance). Désactivé tant qu'EMAIL_PROVIDER n'est pas complet.
 * ⚠ Écrit d'après la documentation publique, testé avec un faux réseau, jamais exécuté contre le vrai service.
 * Un e-mail ne contient jamais le texte d'un message privé.
 */
import { emailConfigured } from "../config.js";

const FAIL = "Envoi de l'e-mail impossible.";

export function createBrevoSender(config, fetchImpl = fetch) {
  return async ({ to, subject, text }) => {
    const e = config.email;
    const r = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": e.brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: e.fromName, email: e.from }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(FAIL);
  };
}

export function createResendSender(config, fetchImpl = fetch) {
  return async ({ to, subject, text }) => {
    const e = config.email;
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${e.fromName} <${e.from}>`, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(FAIL);
  };
}

/** Retourne la fonction d'envoi, ou null si l'e-mail n'est pas (entièrement) configuré. */
export function createEmailSender(config, fetchImpl = fetch) {
  if (!emailConfigured(config)) return null;
  return config.email.provider === "brevo" ? createBrevoSender(config, fetchImpl) : createResendSender(config, fetchImpl);
}
