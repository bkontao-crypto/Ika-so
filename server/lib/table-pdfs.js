// PDF des deux exports autrefois faits dans le navigateur : leads CRM et audit de modération.
import { buildPdf, fmtDate, fmtDateTime, fmtLong, fmtNumber } from "./simple-pdf.js";

const MAX = 500;
const scoreLabel = (s) => { const n = Number(s) || 0; return n >= 80 ? { t: `Chaud ${n}`, c: "bad" } : n >= 50 ? { t: `Tiède ${n}`, c: "warn" } : { t: `Froid ${n}`, c: "muted" }; };

export function leadsToPdf(leads, { generatedAt = new Date() } = {}) {
  const all = Array.isArray(leads) ? leads : [];
  const list = all.slice(0, MAX);
  const hot = all.filter((l) => (Number(l.score) || 0) >= 80).length;
  const byStatus = new Map();
  for (const l of all) byStatus.set(l.status || "—", (byStatus.get(l.status || "—") || 0) + 1);
  return buildPdf({
    eyebrow: "Espace professionnel · CRM", title: "Mes contacts (leads)", generatedAt,
    subtitle: `Généré le ${fmtLong(generatedAt)} (UTC). ${list.length} contact(s) imprimé(s) sur ${all.length}${all.length > MAX ? ` ; l'export CSV contient la liste complète` : ""}.`,
    sections: [
      { heading: "Vue d'ensemble", kpis: { items: [
        { label: "Contacts", value: fmtNumber(all.length) },
        { label: "Chauds · score 80+", value: fmtNumber(hot), tone: hot ? "bad" : undefined },
        { label: "Statuts distincts", value: fmtNumber(byStatus.size) },
      ] } },
      { heading: "Répartition par statut", table: { head: ["Statut", "Contacts"], widths: [0.7, 0.3], align: ["l", "r"], rows: [...byStatus].map(([s, n]) => [s, fmtNumber(n)]) } },
      { heading: "Liste des contacts", table: { head: ["Date", "Nom", "Score", "Statut", "Source", "Téléphone", "Email"], widths: [0.115, 0.17, 0.09, 0.125, 0.11, 0.15, 0.24],
        rows: list.map((l) => [fmtDate(l.created_at), l.contact_name || "Anonyme", scoreLabel(l.score), l.status || "", l.source || "", l.contact_phone || "", l.contact_email || ""]) } },
    ],
  });
}

export function moderationAuditToPdf(rows, { generatedAt = new Date() } = {}) {
  const all = Array.isArray(rows) ? rows : [];
  const list = all.slice(0, MAX);
  const actors = new Set(all.map((r) => r.actor_id).filter(Boolean)).size;
  const byAction = new Map();
  for (const r of all) byAction.set(r.action || "—", (byAction.get(r.action || "—") || 0) + 1);
  return buildPdf({
    eyebrow: "Administration · Modération", title: "Audit de modération", generatedAt,
    subtitle: `Généré le ${fmtLong(generatedAt)} (UTC). ${list.length} ligne(s) imprimée(s).`,
    sections: [
      { heading: "Vue d'ensemble", kpis: { items: [
        { label: "Lignes", value: fmtNumber(all.length) }, { label: "Actions distinctes", value: fmtNumber(byAction.size) }, { label: "Acteurs distincts", value: fmtNumber(actors) },
      ] } },
      { heading: "Répartition par action", table: { head: ["Action", "Lignes"], widths: [0.7, 0.3], align: ["l", "r"], rows: [...byAction].map(([a, n]) => [a, fmtNumber(n)]) } },
      { heading: "Journal", table: { head: ["Date (UTC)", "Action", "Cible", "Acteur", "Détails"], widths: [0.15, 0.17, 0.18, 0.1, 0.4],
        rows: list.map((r) => [fmtDateTime(r.created_at), r.action || "", `${r.target_type || ""}${r.target_id ? " · " + String(r.target_id).slice(0, 8) : ""}`, r.actor_id ? String(r.actor_id).slice(0, 8) : "—", r.details ? JSON.stringify(r.details) : "—"]) } },
    ],
  });
}
