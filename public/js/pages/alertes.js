// Onglet « Alerte » (#/alertes) : programmer une recherche surveillée sur une période, la suspendre, la prolonger, voir l'historique.
import { CATEGORIES, TRANSACTIONS, ZONES, api, fail, h, mount, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

const STATUS = { ACTIVE: "Active", SCHEDULED: "Programmée", PAUSED: "En pause", SUSPENDED: "Suspendue par l'équipe", EXPIRED: "Expirée" };
const ACTIONS = { CREATED: "Création", UPDATED: "Modification", PAUSED: "Mise en pause", RESUMED: "Reprise", EXTENDED: "Prolongation", SUSPENDED_BY_STAFF: "Suspendue par l'équipe", UNSUSPENDED_BY_STAFF: "Rétablie par l'équipe" };
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR") : "—");
const money = (n) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
const todayIso = () => new Date().toISOString().slice(0, 10);

function summary(a) {
  const f = a.filters ?? {};
  const price = f.minPrice || f.maxPrice ? `${f.minPrice ? `de ${money(f.minPrice)} ` : ""}${f.maxPrice ? `jusqu'à ${money(f.maxPrice)}` : ""}`.trim() : "tous les prix";
  return [f.transaction, f.category || "tous les biens", f.zone || "tous les quartiers", price].filter(Boolean).join(" · ");
}

function form(existing, maxDays, onDone) {
  const f = existing?.filters ?? {};
  const sel = (label, name, opts, value) => h("label", { class: "field" }, label, h("select", { class: "input", name }, h("option", { value: "" }, "Tous"), opts.map((o) => h("option", { value: o, selected: o === value }, o))));
  const num = (label, name, value) => h("label", { class: "field" }, label, h("input", { class: "input", name, type: "number", min: "0", inputmode: "numeric", value: value ?? "" }));
  const el = h("form", { class: "card pad stack", novalidate: true, onSubmit: async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(el));
    const body = { label: d.label, startsOn: d.startsOn, endsOn: d.endsOn, filters: { transaction: d.transaction, category: d.category, zone: d.zone, minPrice: d.minPrice, maxPrice: d.maxPrice } };
    if (!d.startsOn || !d.endsOn) return fail(new Error("Indiquez la date de début et la date de fin."));
    if (d.minPrice && d.maxPrice && Number(d.minPrice) > Number(d.maxPrice)) return fail(new Error("Le prix minimum dépasse le prix maximum."));
    try {
      await api(existing ? `/me/alerts/${encodeURIComponent(existing.id)}` : "/me/alerts", { method: existing ? "PUT" : "POST", body });
      toast(existing ? "Alerte modifiée." : "Alerte programmée."); onDone();
    } catch (error) { fail(error); }
  } },
  h("h2", null, existing ? "Modifier l'alerte" : "Programmer une alerte"),
  h("p", { class: "small muted" }, `Les champs laissés sur « Tous » ou vides signifient « sans restriction ». Vous êtes prévenu uniquement des annonces publiées pendant la période${maxDays ? ` (${maxDays} jours au maximum)` : ""}. Gratuit.`),
  h("label", { class: "field" }, "Nom (facultatif)", h("input", { class: "input", name: "label", maxlength: "80", value: existing?.label ?? "" })),
  h("div", { class: "row" },
    h("label", { class: "field" }, "Date de début", h("input", { class: "input", name: "startsOn", type: "date", required: true, min: existing ? undefined : todayIso(), value: existing?.startsOn ?? todayIso() })),
    h("label", { class: "field" }, "Date de fin", h("input", { class: "input", name: "endsOn", type: "date", required: true, min: todayIso(), value: existing?.endsOn ?? "" }))),
  h("div", { class: "row" }, sel("Transaction", "transaction", TRANSACTIONS, f.transaction), sel("Type de bien", "category", CATEGORIES, f.category), sel("Quartier", "zone", ZONES.map((z) => z.name), f.zone)),
  h("div", { class: "row" }, num("Prix minimum (FCFA)", "minPrice", f.minPrice), num("Prix maximum (FCFA)", "maxPrice", f.maxPrice)),
  h("div", { class: "row" }, h("button", { class: "btn btn-primary", type: "submit" }, existing ? "Enregistrer" : "Programmer"), h("button", { class: "btn btn-quiet", type: "button", onClick: onDone }, "Annuler")));
  return el;
}

async function historyDialog(a) {
  let rows = [];
  try { rows = await api(`/me/alerts/${encodeURIComponent(a.id)}/history`); } catch (error) { return fail(error); }
  const d = h("dialog", { "aria-label": "Historique de l'alerte" }, h("div", { class: "pad stack" }, h("h2", null, "Historique"),
    rows.length ? h("ul", { class: "stack" }, rows.map((r) => h("li", null, h("strong", null, ACTIONS[r.action] ?? r.action), " — ", new Date(r.at).toLocaleString("fr-FR")))) : h("p", { class: "muted" }, "Rien pour le moment."),
    h("button", { class: "btn", type: "button", onClick: () => d.close() }, "Fermer")));
  d.addEventListener("close", () => d.remove()); document.body.append(d); d.showModal();
}

export async function alertesPage() {
  if (needLogin()) return;
  let editing; // undefined = liste, null = création, objet = modification
  const root = h("div", { class: "stack" });
  mount(app, h("div", null, h("p", { class: "rx-kicker" }, "Surveillance"), h("h1", { class: "title" }, "Alerte")), root);

  async function draw() {
    let data;
    try { data = await api("/me/alerts"); } catch (error) { return fail(error); }
    if (editing !== undefined) { root.replaceChildren(form(editing, data.maxDays, () => { editing = undefined; draw(); })); return; }
    const act = (path, body, msg) => async () => { try { await api(path, { method: "POST", body: body ?? {} }); if (msg) toast(msg); draw(); } catch (error) { fail(error); } };
    const stat = (n, label) => h("div", { class: "card pad" }, h("strong", null, String(n)), h("div", { class: "small muted" }, label));
    root.replaceChildren(...[
      !data.enabled ? h("p", { class: "card pad" }, "Les alertes sont temporairement indisponibles.") : null,
      h("div", { class: "row" }, stat(data.stats.total, "Alertes"), stat(data.stats.active, "Actives"), stat(data.stats.paused, "En pause"), stat(data.stats.expired, "Expirées"), stat(data.stats.notified, "Notifications reçues")),
      h("button", { class: "btn btn-primary", type: "button", disabled: !data.enabled || data.stats.total >= data.maxAlerts, onClick: () => { editing = null; draw(); } }, "+ Programmer une nouvelle alerte"),
      data.alerts.length ? data.alerts.map((a) => h("article", { class: "card pad stack" },
        h("div", { class: "row" }, h("strong", null, a.label), h("span", { class: `pa-badge${a.status === "ACTIVE" ? "" : " off"}` }, STATUS[a.status] ?? a.status)),
        h("p", { class: "small" }, summary(a)),
        h("p", { class: "small muted" }, `Du ${fmt(a.startsOn)} au ${fmt(a.endsOn)} · ${a.notified} notification${a.notified > 1 ? "s" : ""}`),
        a.reason ? h("p", { class: "small" }, `Motif : ${a.reason}`) : null,
        h("div", { class: "row" },
          a.status !== "SUSPENDED" ? h("button", { class: "btn btn-quiet", type: "button", onClick: () => { editing = a; draw(); } }, "Modifier") : null,
          a.status === "ACTIVE" || a.status === "SCHEDULED" ? h("button", { class: "btn btn-quiet", type: "button", onClick: act(`/me/alerts/${encodeURIComponent(a.id)}/pause`, { paused: true }, "Alerte mise en pause.") }, "Suspendre") : null,
          a.status === "PAUSED" ? h("button", { class: "btn btn-quiet", type: "button", onClick: act(`/me/alerts/${encodeURIComponent(a.id)}/pause`, { paused: false }, "Alerte réactivée.") }, "Réactiver") : null,
          a.status !== "SUSPENDED" ? h("button", { class: "btn btn-quiet", type: "button", onClick: () => {
            const v = prompt("Nouvelle date de fin (AAAA-MM-JJ) :", a.endsOn ?? ""); if (v) act(`/me/alerts/${encodeURIComponent(a.id)}/extend`, { endsOn: v.trim() }, "Alerte prolongée.")();
          } }, "Prolonger") : null,
          h("button", { class: "btn btn-quiet", type: "button", onClick: () => historyDialog(a) }, "Historique"),
          h("button", { class: "btn btn-quiet", type: "button", onClick: () => { if (confirm("Supprimer cette alerte ? L'historique est conservé.")) act(`/me/alerts/${encodeURIComponent(a.id)}/delete`, {}, "Alerte supprimée.")(); } }, "Supprimer")))) : h("p", { class: "muted" }, "Aucune alerte. Programmez-en une : vous serez prévenu dès qu'une annonce correspond."),
      h("section", { class: "card pad stack" }, h("h2", null, "Booster ma demande"),
        h("p", { class: "muted" }, "Bientôt disponible : une priorité de notification supérieure, en option payante. Vos alertes gratuites continueront de fonctionner normalement."),
        data.boost.plans.length ? h("ul", null, data.boost.plans.map((p) => h("li", null, `${p.label} — ${money(p.priceXof)} · ${p.days} jours`))) : null),
      h("p", { class: "small muted" }, "Vos notifications arrivent dans la boîte Alertes (#/boite).")].flat().filter(Boolean));
  }
  draw();
}
