// Service WhatsApp Business Cloud API (Meta) — E07
// Configuration attendue dans config :
//   whatsapp: { token, phoneNumberId, verifyToken, appSecret, apiVersion = "v21.0" }

import { createHmac, timingSafeEqual } from "node:crypto";

export function createWhatsApp({ config, logger = console }) {
  const wa = config?.whatsapp || {};
  const base = `https://graph.facebook.com/${wa.apiVersion || "v21.0"}`;

  async function request(path, options = {}) {
    if (!wa.token || !wa.phoneNumberId) {
      throw new Error("WhatsApp Business non configuré (token / phoneNumberId manquants)");
    }
    const url = path.startsWith("http") ? path : `${base}/${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${wa.token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error?.("WhatsApp API error", data);
      const err = new Error(data.error?.message || "Erreur WhatsApp API");
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data;
  }

  return {
    isConfigured() {
      return Boolean(wa.token && wa.phoneNumberId);
    },

    async sendText(to, text) {
      // to = numéro international sans + (ex. 2237xxxxxxx)
      return request(`${wa.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: String(to).replace(/\D/g, ""),
          type: "text",
          text: { body: String(text).slice(0, 4096) },
        }),
      });
    },

    async sendTemplate(to, templateName, language = "fr", components = []) {
      return request(`${wa.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: String(to).replace(/\D/g, ""),
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            components,
          },
        }),
      });
    },

    /** "ok" | "invalid" | "not_configured" : HMAC-SHA256 du texte brut avec le secret d'application Meta. */
    verifySignature(rawBody, header) {
      if (!wa.appSecret) return "not_configured";
      const m = /^sha256=([0-9a-f]{64})$/i.exec(String(header ?? ""));
      if (!m || typeof rawBody !== "string") return "invalid";
      const expected = createHmac("sha256", wa.appSecret).update(rawBody, "utf8").digest();
      const given = Buffer.from(m[1], "hex");
      return given.length === expected.length && timingSafeEqual(given, expected) ? "ok" : "invalid";
    },

    // Vérification du webhook (GET)
    verifyWebhook(mode, token, challenge) {
      if (mode === "subscribe" && wa.verifyToken && token === wa.verifyToken) {
        return challenge;
      }
      return null;
    },

    // Traitement basique d'un webhook entrant
    parseIncoming(body) {
      const messages = [];
      const entries = body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          for (const msg of value.messages || []) {
            messages.push({
              from: msg.from,
              id: msg.id,
              timestamp: msg.timestamp,
              type: msg.type,
              text: msg.text?.body || null,
              raw: msg,
            });
          }
        }
      }
      return messages;
    },
  };
}