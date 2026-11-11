// Vue générale : fidèle à la maquette (5 indicateurs, activité, santé technique, opérations, alertes, accès rapides), données réelles.
import { api, h, ico, panel, empty, skeletons, errorBox, areaChart, sparkline, nf, pad2, timeOf, dateTime, ago, shortDay, pill, fail, toast } from "./ui.js";

const QUICK = [
  ["crm", "funnel", "Pipeline CRM", "7 étapes commerciales"], ["marketing", "megaphone", "Marketing & campagnes", "Campagnes et mise en avant"],
  ["agencies", "building", "Agences vérifiées", "Profils et annonceurs"], ["ai", "sparkles", "Assistance IA", "Détection et rédaction"],
  ["backups", "database", "Sauvegardes", "Création et vérification"], ["monitoring", "flag", "Incidents", "Alertes et résolution"],
  ["newsletters", "news", "Newsletter", "Abonnés et campagnes e-mail"], ["settings", "gear", "Paramètres plateforme", "Identité et configuration"],
];
const STATE_PILL = { ok: ["green", "Terminé"], warn: ["gold", "À suivre"], bad: ["red", "Alerte"], info: ["info", "Enregistré"], neutral: ["neutral", "Enregistré"] };

export function overviewView(ctx) {
  const root = h("div", { class: "view" }, skeletons(3, 110));
  let days = 30;
  async function load() {
    try {
      const d = await api(`/staff/owner/dashboard?days=${days}`);
      ctx.setBadges(d.counts); ctx.setAlerts(d.alerts);
      draw(d);
    } catch (e) { if (!e.stale) root.replaceChildren(errorBox(e.message, load)); }
  }
  function delta(txt, tone = "") { return h("span", { class: `delta ${tone}` }, txt); }
  function pctText(c, fallbackAdded, label) {
    if (c == null) return fallbackAdded > 0 ? delta(`↗ +${nf(fallbackAdded)} · ${label}`) : delta(`— · ${label}`, "flat");
    return delta(`${c >= 0 ? "↗ +" : "↘ "}${String(c).replace(".", ",")} % · ${label}`, c < 0 ? "bad" : "");
  }
  function stat(label, icon, value, deltaNode, spark, color) {
    return h("div", { class: "card stat" }, h("div", { class: "stathead" }, label, h("span", { class: "staticon" }, ico(icon))), h("strong", null, value), deltaNode, spark ? sparkline(spark, color) : null);
  }
  function draw(d) {
    const k = d.kpis; const sr = d.series;
    const last = (a) => a.slice(-14);
    const stats = k ? [
      stat("Annonces publiées", "list", nf(k.listingsPublished.value), pctText(k.listingsPublished.change, k.listingsPublished.added, `${d.days} jours`), last(sr.listings)),
      stat("Utilisateurs actifs", "users", nf(k.usersActive.value), pctText(k.usersActive.change, k.usersActive.added, `inscrits · ${d.days} j`), last(sr.signups), "#477eaa"),
      stat("Contacts · 7 jours", "mail", nf(k.contacts7d.value), pctText(k.contacts7d.change, 0, "période précédente"), last(sr.contacts), "#c6a35c"),
      stat("Paiements à vérifier", "wallet", pad2(k.paymentsPending.value), delta(k.paymentsPending.value ? (k.paymentsPending.stale ? `${k.paymentsPending.stale} depuis plus de 24 h` : "À traiter") : "Rien en attente", k.paymentsPending.value ? "warn" : ""), null),
      stat("Réclamations ouvertes", "flag", pad2(k.complaintsOpen.value), delta(k.complaintsOpen.priority ? `${k.complaintsOpen.priority} prioritaire${k.complaintsOpen.priority > 1 ? "s" : ""} (> 72 h)` : "Aucune prioritaire", k.complaintsOpen.priority ? "bad" : ""), null),
    ] : [h("p", { class: "note bad wide" }, "Indicateurs indisponibles : la base n'a pas répondu.")];
    const sel = h("select", { class: "select", "aria-label": "Période" }, [[7, "7 derniers jours"], [30, "30 derniers jours"], [90, "90 derniers jours"]].map(([v, l]) => h("option", { value: v, selected: v === days }, l)));
    sel.addEventListener("change", () => { days = Number(sel.value); load(); });
    const chart = areaChart({ labels: sr.days.map(shortDay), series: [
      { key: "l", name: "Annonces déposées", color: "#087448", values: sr.listings }, { key: "c", name: "Contacts entrants", color: "#c6a35c", values: sr.contacts },
      { key: "s", name: "Inscriptions", color: "#477eaa", values: sr.signups }] });
    const hl = d.health;
    const health = h("div", { class: "health" }, hl.items.map((x) => h("div", { class: "healthrow" }, h("span", null, x.label, x.detail ? h("small", null, x.detail) : null), h("b", { class: `status ${x.tone === "ok" ? "" : x.tone}` }, x.text))));
    const ops = d.operations.length ? h("div", { class: "tablewrap" }, h("table", null,
      h("thead", null, h("tr", null, ["Opération", "Acteur", "Module", "État", "Date"].map((t) => h("th", null, t)))),
      h("tbody", null, d.operations.map((o) => { const [tone, label] = STATE_PILL[o.tone] ?? STATE_PILL.neutral; return h("tr", null,
        h("td", { class: "item" }, h("b", null, o.label), h("small", null, [o.object?.label, o.detail].filter(Boolean).join(" · ").slice(0, 70) || "—")),
        h("td", null, o.actor?.name ?? (o.actor?.id ? o.actor.id.slice(0, 8) : "Système")), h("td", null, ctx.categoryLabel(o.category)), h("td", null, pill(tone, label)),
        h("td", { title: dateTime(o.at) }, new Date(o.at).toDateString() === new Date().toDateString() ? timeOf(o.at) : ago(o.at))); })))) : empty("Aucune opération récente.", "scroll");
    const alerts = d.alerts.length ? h("div", { class: "activity" }, d.alerts.map((a) => h("button", { class: "event", type: "button", onClick: () => ctx.go(`#/${a.module}`) },
      h("span", { class: `eventico ${a.tone}` }, ico(a.icon)), h("div", null, h("p", null, h("b", null, a.title), " ", a.text), h("small", null, `${a.where} · à traiter`))))) : empty("Rien à signaler. Tout est sous contrôle.", "check");
    const quick = QUICK.map(([id, icon, t, sub]) => h("a", { class: "module", href: `#/${id}` }, h("span", { class: "moduleico" }, ico(icon)), h("span", null, h("b", null, t), h("small", null, sub))));
    root.replaceChildren(
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, "CENTRE DE COMMANDEMENT · IKA SO"), h("h1", null, "Owner Control Center"), h("p", null, "Vue stratégique de la plateforme, de ses opérations et de sa santé technique.")),
        h("div", { class: "actions" }, h("button", { class: "btn", type: "button", onClick: () => { load(); toast("Données actualisées."); } }, ico("refresh"), "Actualiser les données"),
          h("a", { class: "btn", href: "/api/staff/owner/export.csv", download: "owner-overview.csv" }, ico("download"), "Exporter CSV"), h("a", { class: "btn primary", href: "/api/staff/owner/report.pdf", download: "owner-report.pdf" }, ico("file"), "Rapport complet PDF"))),
      h("section", { class: "grid stats" }, stats),
      h("section", { class: "grid middle" }, panel("Activité de la plateforme", "Évolution des annonces, des contacts et des inscriptions · survolez pour le détail", chart, sel),
        panel("Santé technique", "État des services essentiels", health, h("span", { class: `status ${hl.status === "ok" ? "" : hl.status}` }, hl.status === "ok" ? "SYSTÈME OPÉRATIONNEL" : hl.status === "warn" ? "À SURVEILLER" : "INCIDENT"))),
      h("section", { class: "grid bottom" }, panel("Dernières opérations", "Événements récents de modération et d'administration", ops, h("button", { class: "select", type: "button", onClick: () => ctx.go("#/audit") }, "Ouvrir le journal →")),
        panel("Alertes & actions prioritaires", "Points nécessitant une attention", alerts, h("span", { class: `pill ${d.alerts.length ? "red" : "green"}` }, `${d.alerts.length} alerte${d.alerts.length > 1 ? "s" : ""}`))),
      h("div", { class: "panelhead" }, h("div", null, h("h2", null, "Accès rapides aux modules Owner"), h("div", { class: "desc" }, "Tous les outils de pilotage regroupés au même endroit"))),
      h("section", { class: "grid modules" }, quick),
      h("div", { class: "foot" }, `IKA SO IMMOBILIER · OWNER CONTROL CENTER · Données réelles, générées le ${dateTime(d.generatedAt)} · mémoire serveur ${d.health.memoryMb} Mo`));
  }
  load();
  return root;
}
