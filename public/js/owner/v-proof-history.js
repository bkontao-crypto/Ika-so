// Historique des demandes de pièces justificatives (onglet « Confiance & vérifications ») : reçues, acceptées, refusées.
// Un clic sur une ligne ouvre le détail avec le motif ou le contrôle noté. Les droits restent contrôlés côté serveur (GET /staff/proofs/history).
import { api, h, ico, panel, errorBox, pill, dateTime, dateOnly, openDrawer, fail } from "./ui.js";
import { previewDocument } from "./proof-viewer.js";

const KIND = { AGENCE: "Agence (RCCM)", DOCUMENT_FONCIER: "Titre foncier" };
const STATE = { PENDING: { label: "Reçue", tone: "gold" }, ACCEPTED: { label: "Acceptée", tone: "ok" }, REFUSED: { label: "Refusée", tone: "red" } };
const FILTERS = [["ALL", "Toutes"], ["PENDING", "Reçues"], ["ACCEPTED", "Acceptées"], ["REFUSED", "Refusées"]];

async function seeFile(p) {
  try { const { fileData } = await api(`/staff/proofs/${encodeURIComponent(p.id)}/file`); await previewDocument(fileData, p.title); } catch (error) { fail(error); }
}

function detail(p) {
  const s = STATE[p.status] ?? STATE.PENDING;
  const row = (label, value) => (value ? [h("dt", null, label), h("dd", null, value)] : []);
  openDrawer(p.title,
    h("div", { class: "row" }, pill(s.tone, s.label), pill("neutral", KIND[p.kind] ?? p.kind)),
    h("dl", { class: "kv" },
      ...row("Propriétaire", p.ownerName),
      ...row("Reçue le", p.createdAt ? dateTime(p.createdAt) : ""),
      ...row("Document déclaré", p.declaredDocument),
      ...row("Nom d'agence retenu", p.agencyName),
      ...row("Traitée le", p.reviewedAt ? dateTime(p.reviewedAt) : ""),
      ...row("Traitée par", p.reviewerName)),
    p.status === "PENDING"
      ? h("p", { class: "note" }, "En attente de contrôle : aucun motif pour l'instant. Utilisez « Contrôlée : accepter » ou « Refuser » dans la liste « Pièces à contrôler ».")
      : h("div", { class: "note" }, h("b", null, p.status === "ACCEPTED" ? "Contrôle effectué" : "Motif du refus"), h("p", null, p.note || "Aucune note enregistrée.")),
    h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: () => seeFile(p) }, ico("eye"), "Voir la pièce")));
}

/** pending = pièces reçues et pas encore traitées (déjà chargées par la page) ; les pièces traitées sont lues à part. */
export function proofHistoryPanel(pending) {
  let filter = "ALL";
  let decided = null; // null = chargement en cours
  const box = h("div", { class: "stack" });
  const received = pending.map((p) => ({ id: p.id, kind: p.kind, status: "PENDING", title: p.listingTitle ?? `Agence de ${p.ownerName}`, ownerName: p.ownerName, createdAt: p.createdAt, declaredDocument: p.declaredDocument ?? "" }));

  function draw() {
    if (decided === null) { box.replaceChildren(h("p", { class: "muted small" }, "Chargement de l'historique…")); return; }
    const all = [...received, ...decided].sort((a, b) => new Date(b.reviewedAt ?? b.createdAt) - new Date(a.reviewedAt ?? a.createdAt));
    const count = (k) => (k === "ALL" ? all.length : all.filter((p) => p.status === k).length);
    const shown = filter === "ALL" ? all : all.filter((p) => p.status === filter);
    const tabs = h("div", { class: "row", role: "group", "aria-label": "Filtrer les demandes" }, FILTERS.map(([k, l]) =>
      h("button", { class: `btn sm${filter === k ? " primary" : ""}`, type: "button", "aria-pressed": String(filter === k), onClick: () => { filter = k; draw(); } }, `${l} (${count(k)})`)));
    const line = (p) => {
      const s = STATE[p.status] ?? STATE.PENDING;
      const preview = p.status === "REFUSED" && p.note ? `Motif : ${p.note.length > 90 ? `${p.note.slice(0, 87)}…` : p.note}` : null;
      return h("button", { class: "card panel row", type: "button", style: "width:100%;text-align:left;cursor:pointer", onClick: () => detail(p) },
        h("div", { class: "grow stack" },
          h("div", { class: "row" }, pill(s.tone, s.label), pill("neutral", KIND[p.kind] ?? p.kind)),
          h("b", null, p.title),
          h("p", { class: "muted small" }, `${p.ownerName} · reçue le ${dateOnly(p.createdAt)}${p.reviewedAt ? ` · traitée le ${dateOnly(p.reviewedAt)}` : ""}`),
          preview ? h("p", { class: "small" }, preview) : null));
    };
    box.replaceChildren(tabs, shown.length ? h("div", { class: "stack" }, shown.map(line)) : h("p", { class: "muted small" }, "Aucune demande dans cette catégorie."));
  }

  async function load() {
    decided = null; draw();
    try {
      const rows = await api("/staff/proofs/history");
      decided = rows.map((p) => ({ id: p.id, kind: p.kind, status: p.status, title: p.listingTitle ?? (p.agencyName || `Agence de ${p.ownerName}`), ownerName: p.ownerName, createdAt: p.createdAt, reviewedAt: p.reviewedAt, note: p.note, reviewerName: p.reviewerName, agencyName: p.agencyName, declaredDocument: p.declaredDocument ?? "" }));
      draw();
    } catch (error) { box.replaceChildren(errorBox(error.message || "Chargement impossible.", load)); }
  }
  load();
  return panel("Historique des demandes de pièces", "Reçues, acceptées et refusées. Cliquez sur une ligne pour voir le motif ou le contrôle effectué.", box);
}
