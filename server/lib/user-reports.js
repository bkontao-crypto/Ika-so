export const USER_REPORT_REASONS = ["Harcèlement ou insultes", "Arnaque ou demande d'acompte", "Spam ou publicité", "Autre"];
export const EXCERPT_MESSAGES = 10;
export const EXCERPT_CHARS = 300;

/**
 * Extrait transmis à la modération : les derniers messages seulement, tronqués, avec « qui » (signalant / signalé).
 * `messages` : { sender_id, body, created_at } du plus ancien au plus récent.
 */
export function buildExcerpt(messages, reporterId) {
  return messages.slice(-EXCERPT_MESSAGES).map((m) => ({
    from: m.sender_id === reporterId ? "reporter" : "reported",
    body: String(m.body ?? "").slice(0, EXCERPT_CHARS),
    at: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
  }));
}
