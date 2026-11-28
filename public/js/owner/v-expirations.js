// Durées de publication & expirations (Superadmin) : réglages, indicateurs, filtres, liste et historique par annonce.
// Le contrôle d'accès est fait par le serveur (rôle SUPERADMIN revérifié à chaque appel) ; ici on n'affiche que ce qu'il accepte.
import { api, h, panel, toast, empty } from "./ui.js";

const STATUS = { DRAFT: "Brouillon", SCHEDULED: "Programmée", PUBLISHED: "Publiée", EXPIRING_SOON: "Expire bientôt", EXPIRED: "Expirée", SOLD: "Vendue", RENTED: "Louée", ARCHIVED: "Archivée", ARCHIVED_AUTO: "Archivée automatiquement" };
const ACTION = { PUBLICATION_START: "Début de publication", WARNING_SENT: "Avertissement envoyé", EXPIRE: "Expiration", SOLD: "Confirmation de vente", RENTED: "Confirmation de location", ARCHIVE_MANUAL: "Archivage manuel", ARCHIVE_AUTO: "Archivage automatique", EXTEND: "Prolongation", DATES_CHANGE: "Modification des dates" };
const fr = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "UTC" }) : "—");

export function expirationsView(ctx) {
  const view = h("div", { class: "view stack" });
  const filters = {};
  const settingsBox = h("div"); const statsBox = h("div"); const listBox = h("div");

  function settingsForm(s) {
    const enabled = h("input", { type: "checkbox", checked: s.warningsEnabled });
    const days = h("input", { class: "input", type: "text", value: s.warningDays.join(", "), "aria-label": "Délais d'avertissement en jours" });
    const dayZero = h("input", { type: "checkbox", checked: s.dayZeroWarning });
    const archive = h("input", { class: "input", type: "number", min: 1, max: 365, value: s.autoArchiveDays, "aria-label": "Archivage automatique après expiration (jours)" });
    const ext = h("input", { class: "input", type: "number", min: 1, max: 30, value: s.maxExtensionDays, "aria-label": "Durée maximale de prolongation (jours)" });
    const save = h("button", { class: "btn primary", type: "button" }, "Enregistrer les réglages");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const warningDays = days.value.split(/[,\s;]+/).filter(Boolean).map(Number);
        const next = await api("/superadmin/expirations/settings", { method: "PUT", body: { warningsEnabled: enabled.checked, warningDays, dayZeroWarning: dayZero.checked, autoArchiveDays: Number(archive.value), maxExtensionDays: Number(ext.value) } });
        toast("Réglages enregistrés.");
        settingsBox.replaceChildren(settingsForm(next));
      } catch (e) { toast(e.message || "Enregistrement impossible.", true); } finally { save.disabled = false; }
    });
    return h("div", { class: "stack" },
      h("label", { class: "row" }, enabled, h("span", null, "Envoyer les avertissements avant expiration")),
      h("label", { class: "stack" }, h("span", null, "Jours avant l'échéance (ex. 7, 3, 1)"), days),
      h("label", { class: "row" }, dayZero, h("span", null, "Avertissement du jour J (à l'expiration)")),
      h("label", { class: "stack" }, h("span", null, "Archivage automatique, jours après l'expiration"), archive),
      h("label", { class: "stack" }, h("span", null, "Prolongation maximale par opération (30 jours au plus)"), ext),
      h("div", null, save));
  }

  function statCard(label, value) { return h("div", { class: "card panel" }, h("small", { class: "tiny muted" }, label), h("strong", { style: "font-size:1.6rem" }, String(value ?? 0))); }

  async function showHistory(id, holder) {
    if (holder.childElementCount) { holder.replaceChildren(); return; }
    try {
      const { events } = await api(`/superadmin/expirations/${encodeURIComponent(id)}/history`);
      holder.replaceChildren(events.length ? h("ul", { class: "stack" }, events.map((e) => h("li", { class: "small" },
        `${fr(e.createdAt)} · ${ACTION[e.action] ?? e.action} · ${e.automatic ? "Automatique" : e.actorKind === "OWNER" ? "Propriétaire" : "Équipe"}`,
        e.oldValue || e.newValue ? ` · ${e.oldValue ?? "—"} → ${e.newValue ?? "—"}` : ""))) : h("small", { class: "muted" }, "Aucun événement enregistré."));
    } catch (e) { toast(e.message || "Historique indisponible.", true); }
  }

  function table(items) {
    if (!items.length) return empty("Aucune annonce ne correspond.", "search");
    return h("div", { style: "overflow:auto" }, h("table", { class: "table" },
      h("thead", null, h("tr", null, ["Annonce", "Propriétaire", "Type", "Statut", "Début", "Fin", ""].map((t) => h("th", null, t)))),
      h("tbody", null, items.flatMap((it) => {
        const holder = h("div");
        return [h("tr", null,
          h("td", null, h("b", null, it.title), h("br"), h("small", { class: "muted" }, it.id)),
          h("td", null, it.ownerName), h("td", null, it.transactionType),
          h("td", null, STATUS[it.status] ?? it.status), h("td", null, fr(it.startsAt)), h("td", null, fr(it.expiresAt)),
          h("td", null, h("button", { class: "btn", type: "button", onClick: () => showHistory(it.id, holder) }, "Historique"))),
        h("tr", null, h("td", { colspan: 7 }, holder))];
      }))));
  }

  function filterBar() {
    const f = (name, input) => { input.addEventListener("input", () => { filters[name] = input.type === "checkbox" ? (input.checked ? "1" : "") : input.value; }); return input; };
    const select = (name, options) => f(name, h("select", { class: "input", "aria-label": name }, options.map(([v, t]) => h("option", { value: v }, t))));
    const go = h("button", { class: "btn primary", type: "button", onClick: load }, "Filtrer");
    return h("div", { class: "row", style: "flex-wrap:wrap;gap:8px" },
      f("from", h("input", { class: "input", type: "date", "aria-label": "Fin de publication à partir du" })),
      f("to", h("input", { class: "input", type: "date", "aria-label": "Fin de publication jusqu'au" })),
      f("ownerId", h("input", { class: "input", type: "text", placeholder: "Identifiant du propriétaire", "aria-label": "Propriétaire" })),
      select("category", [["", "Tous types de bien"], ["Terrain", "Terrain"], ["Maison", "Maison"], ["Appartement", "Appartement"], ["Studio", "Studio"]]),
      select("transaction", [["", "Vente et location"], ["Vente", "Vente"], ["Location", "Location"]]),
      select("status", [["", "Tous statuts"], ["PUBLISHED", "Publiée"], ["SCHEDULED", "Programmée"], ["EXPIRED", "Expirée"], ["SOLD", "Vendue"], ["RENTED", "Louée"], ["ARCHIVED", "Archivée"]]),
      h("label", { class: "row" }, f("expired", h("input", { type: "checkbox" })), h("span", null, "Expirées")),
      h("label", { class: "row" }, f("expiring", h("input", { type: "checkbox" })), h("span", null, "Bientôt expirées")),
      go);
  }

  async function load() {
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
      const d = await api(`/superadmin/expirations${qs ? `?${qs}` : ""}`);
      settingsBox.replaceChildren(settingsForm(d.settings));
      const s = d.stats;
      statsBox.replaceChildren(h("div", { class: "grid" }, statCard("Proches de l'expiration", s.expiringSoon), statCard("Expirées", s.expired), statCard("Vendues", s.sold), statCard("Louées", s.rented),
        statCard("Archivées manuellement", s.archivedManual), statCard("Archivées automatiquement", s.archivedAuto), statCard("Prolongations", s.extensions)));
      listBox.replaceChildren(table(d.items));
    } catch (e) { listBox.replaceChildren(empty(e.message || "Chargement impossible.", "shield")); }
  }

  view.append(
    panel("Gestion des expirations", "Avertissements, archivage automatique et plafond de prolongation. Aucune annonce n'est jamais supprimée automatiquement.", settingsBox),
    panel("Indicateurs", "Selon les filtres choisis ci-dessous (période = date de fin de publication).", statsBox),
    panel("Annonces", "Détail et historique de chaque annonce.", h("div", { class: "stack" }, filterBar(), listBox)));
  load();
  return view;
}
