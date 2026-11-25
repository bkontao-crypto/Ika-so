// Boîte WhatsApp : enregistre les messages reçus (webhook Meta) et envoyés (page d'administration), et met à jour leurs statuts.
// S'appuie sur server/services/whatsapp.js (appels Meta, signature) sans le modifier.
import { AppError, badRequest } from "../lib/errors.js";

const RANK = { received: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
const digits = (value) => String(value ?? "").replace(/\D/g, "");

export function createWhatsAppInbox({ db, whatsapp, logger = console }) {
  async function insert({ waId = null, direction, phone, name = null, text = "", status, error = null, sentBy = null, at = null }) {
    const rows = await db.query(
      `insert into ika_whatsapp_messages (wa_message_id, direction, phone_number, contact_name, message_text, status, error_text, sent_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()))
       on conflict (wa_message_id) do nothing returning id`,
      [waId, direction, phone, name, String(text ?? "").slice(0, 4096), status, error, sentBy, at],
    );
    return rows.length;
  }

  return {
    isConfigured: () => whatsapp.isConfigured(),

    /**
     * Enregistre ce que Meta envoie au webhook : messages reçus et mises à jour de statut des messages envoyés.
     * Rien n'est enregistré si la signature X-Hub-Signature-256 n'est pas valide (ou si le secret d'application n'est pas configuré).
     */
    async captureWebhook({ rawBody, signature, body }) {
      if (whatsapp.verifySignature(rawBody, signature) !== "ok") return { recorded: 0, updated: 0 };
      let recorded = 0;
      let updated = 0;
      for (const entry of body?.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const names = new Map((value.contacts ?? []).map((c) => [digits(c.wa_id), c.profile?.name ?? null]));
          for (const msg of value.messages ?? []) {
            const phone = digits(msg.from);
            if (!msg.id || !phone) continue;
            const seconds = Number(msg.timestamp);
            recorded += await insert({
              waId: String(msg.id),
              direction: "inbound",
              phone,
              name: names.get(phone) ?? null,
              text: msg.type === "text" ? (msg.text?.body ?? "") : `[${msg.type ?? "message"}]`,
              status: "received",
              at: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null,
            });
          }
          for (const st of value.statuses ?? []) {
            const next = String(st.status ?? "");
            if (!st.id || !Object.hasOwn(RANK, next) || next === "received") continue;
            const reason = st.errors?.[0] ? String(st.errors[0].message ?? st.errors[0].title ?? "").slice(0, 500) || null : null;
            // Un statut ne recule jamais (un « distribué » tardif n'écrase pas un « lu »).
            const rows = await db.query(
              `update ika_whatsapp_messages set status = $2, error_text = coalesce($3, error_text), updated_at = now()
               where wa_message_id = $1 and direction = 'outbound'
                 and (case status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end) < $4
               returning id`,
              [String(st.id), next, reason, RANK[next]],
            );
            updated += rows.length;
          }
        }
      }
      return { recorded, updated };
    },

    /** Historique, du plus ancien au plus récent (les `limit` derniers messages ; une seule conversation si `phone` est donné). */
    async list({ phone, limit } = {}) {
      const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
      const to = digits(phone);
      const rows = to
        ? await db.query("select * from ika_whatsapp_messages where phone_number = $1 order by created_at desc, id desc limit $2", [to, max])
        : await db.query("select * from ika_whatsapp_messages order by created_at desc, id desc limit $1", [max]);
      return rows.reverse().map((r) => ({
        id: String(r.id), waMessageId: r.wa_message_id, direction: r.direction, phone: r.phone_number, name: r.contact_name,
        text: r.message_text, status: r.status, error: r.error_text, sentBy: r.sent_by, createdAt: r.created_at,
      }));
    },

    /** Envoie un message texte via Meta et l'enregistre. Meta peut refuser (ex. contact sans échange depuis 24 h) : l'échec est enregistré et expliqué. */
    async send({ userId, phone, message }) {
      let to = digits(phone);
      if (to.length === 8) to = `223${to}`; // numéro local malien saisi sans indicatif
      if (to.length < 8 || to.length > 15) throw badRequest("Numéro invalide : indicatif du pays puis numéro, sans « + » (ex. 22370000000).");
      const text = String(message ?? "").trim();
      if (!text) throw badRequest("Le message est vide.");
      if (text.length > 4096) throw badRequest("Message trop long (4096 caractères au maximum).");
      if (!whatsapp.isConfigured()) throw new AppError(503, "WhatsApp n'est pas configuré sur ce serveur (WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID).");
      let data;
      try {
        data = await whatsapp.sendText(to, text);
      } catch (error) {
        const reason = String(error?.message ?? "Erreur WhatsApp").slice(0, 500);
        await insert({ direction: "outbound", phone: to, text, status: "failed", error: reason, sentBy: userId });
        logger.error?.("whatsapp_envoi_refuse", { status: error?.status, code: error?.details?.error?.code });
        const hint = error?.details?.error?.code === 131047 ? " Le contact n'a pas écrit depuis plus de 24 h : seul un modèle de message approuvé peut lui être envoyé." : "";
        throw new AppError(502, `Meta a refusé le message : ${reason}.${hint}`);
      }
      const waId = data?.messages?.[0]?.id ?? null;
      await insert({ waId, direction: "outbound", phone: to, text, status: "sent", sentBy: userId });
      return { ok: true, waMessageId: waId };
    },
  };
}
