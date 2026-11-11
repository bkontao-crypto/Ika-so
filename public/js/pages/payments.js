// Paiements de l'utilisateur et factures. La mise à la une n'est donnée qu'après la confirmation du fournisseur.
import { api, fail, formatDate, h, mount } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

const LABEL = { PENDING: "En attente de confirmation", PAID: "Payé", FAILED: "Échoué", MISMATCH: "Montant à vérifier", REFUNDED: "Remboursé", EXPIRED: "Expiré (aucune confirmation reçue)" };
const fcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;

export async function paymentsPage() {
  if (needLogin()) return;
  const rows = await api("/me/payments");
  async function showInvoice(id) {
    try {
      const f = await api(`/me/payments/${encodeURIComponent(id)}/invoice`);
      mount(app, h("article", { class: "card pad stack invoice" },
        h("h1", { class: "title" }, `Facture ${f.number}`),
        h("p", null, `Client : ${f.customer}`), h("p", null, `${f.label} : ${fcfa(f.amountXof)}`),
        h("p", { class: "small muted" }, `Émise le ${formatDate(f.issuedAt)}. ${f.note}`),
        h("div", { class: "row" }, h("button", { class: "btn btn-primary", type: "button", onClick: () => window.print() }, "Imprimer"), h("button", { class: "btn", type: "button", onClick: paymentsPage }, "Retour"))));
    } catch (error) { fail(error); }
  }
  mount(app, h("h1", { class: "title" }, "Paiements"),
    rows.length ? h("ul", { class: "stack" }, rows.map((p) => h("li", { class: "card pad row-between" },
      h("div", null, h("strong", null, `${p.kind === "PREMIUM" ? "Premium" : "À la une"} · ${p.days} jours · ${fcfa(p.amountXof)}`), h("p", { class: "small muted" }, `${LABEL[p.status] ?? p.status} · ${formatDate(p.createdAt)}`)),
      p.status === "PENDING" && p.checkoutUrl ? h("a", { class: "btn btn-small btn-primary", href: p.checkoutUrl }, "Terminer le paiement") : null,
      p.invoice ? h("button", { class: "btn btn-small", type: "button", onClick: () => showInvoice(p.id) }, `Facture ${p.invoice}`) : null)))
      : h("p", { class: "card pad muted" }, "Aucun paiement pour le moment."));
}
