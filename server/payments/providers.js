import { createHmac } from "node:crypto";
import { sameHash as safeEqual } from "../lib/security.js";
import { createCinetpayProvider } from "./cinetpay.js";
import { createPaydunyaProvider } from "./paydunya.js";

/**
 * Un fournisseur de paiement = deux fonctions. Le vrai agrégateur mobile money sera ajouté ici
 * (décision du propriétaire) sans toucher au reste : il suffit de respecter ce contrat.
 *   createCheckout(payment) -> { providerRef, instructions }
 *   parseWebhook(rawBody, headers) -> { eventId, providerRef, status: "PAID"|"FAILED"|"REFUNDED", amountXof, refundRef? } ; lève une erreur si la signature est fausse
 */
export const sign = (secret, raw) => createHmac("sha256", secret).update(raw).digest("hex");

/** Fournisseur de démonstration : aucun argent réel. Refusé en production par `selectProvider`. */
export function createFakeProvider({ secret }) {
  return {
    name: "fake",
    async createCheckout(payment) {
      return { providerRef: `fake_${payment.id}`, instructions: "Paiement de démonstration : aucun argent n'est prélevé." };
    },
    parseWebhook(rawBody, headers) {
      const given = String(headers["x-ika-signature"] ?? "");
      if (!secret || !safeEqual(given, sign(secret, rawBody))) throw new Error("signature invalide");
      const body = JSON.parse(rawBody);
      const status = body.status === "PAID" ? "PAID" : body.status === "REFUNDED" ? "REFUNDED" : "FAILED";
      return { eventId: String(body.eventId ?? ""), providerRef: String(body.providerRef ?? ""), status, amountXof: Number(body.amountXof), refundRef: String(body.refundRef ?? "") };
    },
  };
}

/**
 * Choisit le fournisseur selon la configuration. Retourne null : paiements désactivés.
 * Un agrégateur réel n'est activé que si TOUTES ses clés sont posées et si PUBLIC_URL est une adresse https (en production).
 */
export function selectProvider(config, fetchImpl = fetch) {
  const p = config.payments;
  if (p.provider === "fake" && !config.production && p.webhookSecret) return createFakeProvider({ secret: p.webhookSecret });
  const httpsOk = config.publicUrl && (!config.production || config.publicUrl.startsWith("https://"));
  if (p.provider === "cinetpay" && p.cinetpay?.apiKey && p.cinetpay?.siteId && httpsOk) {
    return createCinetpayProvider({ apiKey: p.cinetpay.apiKey, siteId: p.cinetpay.siteId, publicUrl: config.publicUrl, channels: p.channels, fetchImpl });
  }
  if (p.provider === "paydunya" && p.paydunya?.masterKey && p.paydunya?.privateKey && p.paydunya?.token && httpsOk) {
    return createPaydunyaProvider({ ...p.paydunya, publicUrl: config.publicUrl, fetchImpl });
  }
  return null;
}
