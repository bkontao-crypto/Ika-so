import { api, h, mount } from "/js/dom.js";
import { bulkImportBlock } from "/js/components/bulk-import.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

const STATUS = { PENDING: "En attente", PUBLISHED: "En ligne", REJECTED: "Refusées", EXPIRED: "Expirées", SOLD: "Vendues", RENTED: "Louées", ARCHIVED: "Archivées", DRAFT: "Brouillons" };

export async function agencyPage() {
  if (needLogin()) return;
  const stats = await api("/me/agency");
  const ui = await import("/js/components/espace.js"); ui.loadCss();
  const premiumBlock = ui.premiumCard(await api("/me/center/access").catch(() => null), "agence");
  mount(app,
    premiumBlock,
    h("h1", { class: "title" }, "Espace agence"),
    stats.agencyVerified
      ? h("p", null, h("span", { class: "pill pill-green" }, `Agence vérifiée : ${stats.agencyName ?? ""}`), " ", h("a", { href: stats.publicPage }, "Voir ma page publique"))
      : h("p", { class: "notice" }, "Votre agence n'est pas encore vérifiée. Envoyez votre registre de commerce depuis votre profil : une personne de l'équipe le contrôle avant tout badge."),
    h("div", { class: "stat-grid", role: "group", "aria-label": "Mes annonces" },
      Object.entries(stats.byStatus).map(([k, v]) => h("div", { class: "card stat" }, h("span", { class: "small muted" }, STATUS[k] ?? k), h("strong", null, String(v))))),
    h("section", { class: "card pad stack" },
      h("h2", null, "Importer des annonces en masse"),
      bulkImportBlock()),
    h("section", { class: "stack" },
      h("h2", null, "Contacts reçus (7 derniers jours)"),
      stats.listings.length
        ? h("ul", { class: "stack" }, stats.listings.map((l) => h("li", { class: "card pad row-between" }, h("a", { href: `#/annonce/${encodeURIComponent(l.id)}` }, l.title), h("span", { class: "small" }, `${l.contacts7d} contact(s) · ${l.contacts} au total`))))
        : h("p", { class: "card pad muted" }, "Aucune annonce en ligne ou en attente.")));
}
