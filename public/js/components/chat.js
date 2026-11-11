import { h } from "/js/dom.js";
import { icon } from "/js/icons.js";

const COLORS = ["#1e6b50", "#0f766e", "#6d28d9", "#b45309", "#be123c", "#475569"];

/** Pastille ronde avec les initiales ; la couleur dépend du nom (toujours la même pour une même personne). */
export function avatar(name, cls = "") {
  const text = String(name || "?").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  let sum = 0; for (const ch of text) sum = (sum * 31 + ch.codePointAt(0)) >>> 0;
  return h("span", { class: `avatar av-${sum % COLORS.length} ${cls}`, "aria-hidden": "true" }, initials);
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const pad = (n) => String(n).padStart(2, "0");
export const clock = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ""; };

/** Heure du jour, « Hier », nom du jour dans la semaine, sinon jj/mm/aa — comme dans la liste de WhatsApp. */
export function listTime(iso, now = new Date()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (diff <= 0) return clock(iso);
  if (diff === 1) return "Hier";
  if (diff < 7) return d.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

/** Séparateur de jour dans la conversation. */
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Une coche = envoyé ; deux coches dorées = lu par l'autre personne. */
export function ticks(read) {
  return h("span", { class: `ticks ${read ? "read" : ""}`, role: "img", "aria-label": read ? "Lu" : "Envoyé" },
    icon("check"), read ? icon("check") : null);
}
