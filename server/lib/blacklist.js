import { forbidden } from "./errors.js";

export const normalizeBlacklistValue = (kind, value) =>
  kind === "EMAIL" ? String(value ?? "").trim().toLowerCase() : String(value ?? "").replace(/[^\d+]/g, "");

/** Refuse un e-mail ou un numéro inscrit sur la liste noire. Message neutre : il ne révèle ni le motif ni qui a décidé. */
export async function assertNotBlacklisted(db, kind, value) {
  const v = normalizeBlacklistValue(kind, value);
  if (!v) return;
  const rows = await db.query("select 1 from ika_blacklist where kind = $1 and value = $2", [kind, v]);
  if (rows[0]) throw forbidden(kind === "EMAIL" ? "Cette adresse n'est pas autorisée sur Ika So." : "Ce numéro n'est pas autorisé sur Ika So.");
}
