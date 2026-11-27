// Observatoire : tendances et agrégats du site sur une période choisie, comparée à la précédente.
// Lecture seule de /staff/owner/observatory (Super Administrateur). Aucun chiffre estimé.
import { api, h, ico, panel, table, pill, nf, fcfa, empty, areaChart } from "./ui.js";
import { page } from "./v-modules.js";
import { donut, columnChart, funnelChart } from "./charts-modern.js";

const COLORS = ["#087448", "#477eaa", "#c6a35c", "#7b5ea7", "#c94f4f", "#2a9d8f", "#e07a2f", "#4b5563", "#b0447a", "#6b8e23"];
const color = (i) => COLORS[i % COLORS.length];
const GROUPS = [["audience", "Audience", "eye"], ["reactions", "Réactions", "star"], ["contacts", "Contacts", "mail"], ["growth", "Croissance", "pulse"], ["safety", "Confiance & sécurité", "shield"], ["revenue", "Revenus", "wallet"]];
const TABS = [["overview", "Vue d'ensemble", "grid"], ...GROUPS, ["live", "En direct", "bell"]];
const HEADLINES = ["pageViews", "listingViews", "contacts", "signups", "listingsCreated", "favorites", "messages", "revenue"];
const EVENT_LABELS = { page_view: "Page vue", listing_view: "Fiche annonce vue", listing_dwell: "Temps passé sur une fiche", contact_clicked: "Clic sur « Contacter »", phone_clicked: "Clic sur le téléphone", whatsapp_clicked: "Clic sur WhatsApp", contact_request_created: "Demande de contact", visit_requested: "Visite demandée", message_sent: "Message envoyé", listing_favorite_added: "Favori ajouté", listing_favorite_removed: "Favori retiré", comment_created: "Commentaire publié", comment_deleted: "Commentaire supprimé", listing_created: "Annonce créée", listing_updated: "Annonce modifiée", listing_published: "Annonce publiée", listing_archived: "Annonce archivée", user_registered: "Inscription", user_login: "Connexion", user_logout: "Déconnexion", verification_completed: "Vérification terminée", report_created: "Signalement", payment_completed: "Paiement terminé", premium_cta_clicked: "Clic Premium", premium_checkout_started: "Paiement Premium lancé" };
const SOURCE_LABELS = { direct: "Accès direct ou interne", search: "Moteurs de recherche", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp", other: "Autres sites", inconnue: "Inconnue" };
const DEVICE_LABELS = { mobile: "Téléphone", desktop: "Ordinateur", tablet: "Tablette", inconnu: "Inconnu" };
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// ---------- Dates (UTC = heure du Mali) ----------
const iso = (d) => d.toISOString().slice(0, 10);
const today = () => new Date(`${iso(new Date())}T00:00:00Z`);
const back = (n) => iso(new Date(today().getTime() - n * 86_400_000));
const PRESETS = [
  ["today", "Aujourd'hui", () => [back(0), back(0)]], ["7", "7 jours", () => [back(6), back(0)]], ["30", "30 jours", () => [back(29), back(0)]], ["90", "90 jours", () => [back(89), back(0)]],
  ["month", "Ce mois", () => [`${back(0).slice(0, 7)}-01`, back(0)]],
  ["lastmonth", "Mois dernier", () => { const t = today(); const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)); return [`${iso(end).slice(0, 7)}-01`, iso(end)]; }],
  ["year", "Cette année", () => [`${back(0).slice(0, 4)}-01-01`, back(0)]], ["365", "12 mois", () => [back(364), back(0)]],
];
const frDay = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const bucketLabel = (d, g) => (g === "month" ? `${d.slice(5, 7)}/${d.slice(2, 4)}` : `${d.slice(8, 10)}/${d.slice(5, 7)}`);
const GRAIN = { day: "par jour", week: "par semaine", month: "par mois" };

const state = { preset: "30", from: null, to: null, tab: "overview", compare: ["pageViews", "listingViews", "contacts"], auto: false };

// ---------- Briques ----------
function spark(values, stroke) {
  const NS = "http://www.w3.org/2000/svg"; const W = 120; const H = 30;
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "ob-spark");
  const max = Math.max(1, ...values); const n = values.length;
  const pts = (n < 2 ? [values[0] ?? 0, values[0] ?? 0] : values).map((v, i, a) => `${(i * W) / (a.length - 1)},${H - 2 - (v / max) * (H - 4)}`).join(" ");
  const line = document.createElementNS(NS, "polyline"); line.setAttribute("points", pts); line.setAttribute("fill", "none"); line.setAttribute("stroke", stroke); line.setAttribute("stroke-width", "2");
  svg.append(line);
  return svg;
}
function delta(m) {
  if (m.total === m.previous) return h("span", { class: "ob-delta flat" }, "= stable");
  const up = m.total > m.previous; const good = up !== m.lowerIsBetter;
  const text = m.deltaPct == null ? "nouveau" : `${up ? "+" : ""}${nf(m.deltaPct)} %`;
  return h("span", { class: `ob-delta ${good ? "good" : "bad"}` }, `${up ? "▲" : "▼"} ${text}`);
}
const fmtOf = (m) => (m.key === "revenue" ? fcfa : nf);
const kpi = (m, i, onClick) => h(onClick ? "button" : "div", { class: "card ob-kpi", ...(onClick ? { type: "button", onClick, title: "Voir le détail" } : {}) },
  h("small", null, m.label), h("strong", null, fmtOf(m)(m.total)), h("span", { class: "ob-row" }, delta(m), h("small", null, `avant : ${fmtOf(m)(m.previous)}`)), spark(m.values, color(i)));

function trend(d, metrics, { title, desc, kind } = {}) {
  const labels = d.buckets.map((b) => bucketLabel(b, d.range.granularity));
  const series = metrics.map((m, i) => ({ key: m.key, name: m.label, color: color(i), values: m.values }));
  let body;
  if (!series.length) body = empty("Choisissez au moins une courbe.", "pulse");
  else if (!series.some((x) => x.values.some((v) => v > 0))) body = empty("Aucune donnée sur la période.", "pulse");
  else if (labels.length < 3 || kind === "columns") body = h("div", { class: "stack" }, series.map((x) => h("div", null, h("small", { class: "muted" }, x.name), columnChart({ items: x.values.map((v, i) => ({ label: labels[i], value: v })), color: x.color, hot: x.color, height: 150 }))));
  else body = areaChart({ labels, series, height: 250 });
  return panel(title, desc ?? `Totaux ${GRAIN[d.range.granularity]}`, body);
}
const ring = (title, desc, rows, labels = {}, caption = "") => panel(title, desc, donut({ caption, items: rows.map((r, i) => ({ label: labels[r.label] ?? r.label ?? "—", value: r.n, color: color(i) })) }));
function ranking(title, desc, rows, labels = {}) {
  if (!rows.length) return panel(title, desc, empty("Aucune donnée sur la période.", "list"));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return panel(title, desc, h("ol", { class: "ob-rank" }, rows.map((r, i) => {
    const fill = h("i"); fill.style.width = `${(r.n / max) * 100}%`; fill.style.background = color(i);
    return h("li", null, h("span", { class: "ob-row" }, h("span", { class: "ob-name" }, labels[r.label] ?? r.label ?? "—"), h("b", null, nf(r.n))), h("span", { class: "ob-bar" }, fill));
  })));
}
function heatmap(cells) {
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.n]));
  const max = Math.max(0, ...cells.map((c) => c.n));
  if (!max) return panel("Carte de chaleur", "Jour et heure des actions", empty("Aucune action sur la période.", "clock"));
  const rows = [h("div", { class: "ob-hm-row head" }, h("span"), Array.from({ length: 24 }, (_, i) => h("span", null, i % 3 === 0 ? String(i) : "")))];
  DOW.forEach((name, k) => rows.push(h("div", { class: "ob-hm-row" }, h("span", null, name), Array.from({ length: 24 }, (_, hour) => {
    const n = grid.get(`${k + 1}-${hour}`) ?? 0;
    const cell = h("i", { title: `${name} ${String(hour).padStart(2, "0")} h : ${nf(n)} action(s)` });
    if (n) cell.style.background = `rgba(8,116,72,${(0.18 + 0.82 * (n / max)).toFixed(2)})`;
    return cell;
  }))));
  const peak = [...cells].sort((a, b) => b.n - a.n)[0];
  return panel("Carte de chaleur", `Quand le site est actif (heure du Mali). Pointe : ${DOW[peak.dow - 1]} à ${String(peak.hour).padStart(2, "0")} h (${nf(peak.n)}).`, h("div", { class: "ob-hm", role: "img", "aria-label": "Actions par jour de semaine et par heure" }, rows));
}

/** Faits marquants : règles simples et explicables, calculées sur les chiffres affichés. */
export function insights(d) {
  const out = [];
  const moving = d.metrics.filter((m) => m.deltaPct != null && Math.abs(m.total - m.previous) >= 3 && Math.abs(m.deltaPct) >= 20).sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  moving.slice(0, 5).forEach((m) => { const up = m.deltaPct > 0; out.push({ tone: up !== m.lowerIsBetter ? "good" : "bad", text: `${m.label} : ${up ? "en hausse" : "en baisse"} de ${nf(Math.abs(m.deltaPct))} % (${nf(m.previous)} → ${nf(m.total)}).` }); });
  d.metrics.filter((m) => m.previous === 0 && m.total >= 3).slice(0, 3).forEach((m) => out.push({ tone: m.lowerIsBetter ? "bad" : "good", text: `${m.label} : ${nf(m.total)} sur la période, aucun sur la précédente.` }));
  // Pic inhabituel : tranche au-dessus de la moyenne + 2 écarts-types (au moins 10 tranches et 5 unités).
  if (d.buckets.length >= 10) {
    d.metrics.filter((m) => m.key !== "revenue").forEach((m) => {
      const mean = m.values.reduce((a, b) => a + b, 0) / m.values.length;
      const sd = Math.sqrt(m.values.reduce((a, v) => a + (v - mean) ** 2, 0) / m.values.length);
      const peak = Math.max(...m.values);
      if (peak >= 5 && sd > 0 && peak > mean + 2 * sd) out.push({ tone: m.lowerIsBetter ? "bad" : "info", text: `Pic inhabituel — ${m.label} : ${nf(peak)} (tranche du ${frDay(d.buckets[m.values.indexOf(peak)])}, moyenne ${nf(Math.round(mean * 10) / 10)}).` });
    });
  }
  return out.slice(0, 10);
}

function csv(d) {
  const cell = (v) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = [["Début de tranche", ...d.metrics.map((m) => m.label)], ...d.buckets.map((b, i) => [b, ...d.metrics.map((m) => m.values[i])]), ["Total période", ...d.metrics.map((m) => m.total)], ["Période précédente", ...d.metrics.map((m) => m.previous)]];
  const a = h("a", { download: `observatoire_${d.range.from}_${d.range.to}.csv` });
  a.href = URL.createObjectURL(new Blob([`﻿${lines.map((l) => l.map(cell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Onglets ----------
const byKey = (d, key) => d.metrics.find((m) => m.key === key);
const ofGroup = (d, g) => d.metrics.filter((m) => m.group === g);
const tile = (label, value, sub) => h("div", { class: "card ob-kpi" }, h("small", null, label), h("strong", null, value), sub ? h("small", null, sub) : null);
const ratio = (a, b) => (b > 0 ? nf(Math.round((a / b) * 1000) / 10) : "—");

function overviewTab(d, open) {
  const facts = insights(d);
  const chips = h("div", { class: "ob-chips" });
  const box = h("div");
  const drawCompare = () => {
    chips.replaceChildren(...d.metrics.filter((m) => m.key !== "revenue").map((m) => h("button", { type: "button", class: "ob-chip", "aria-pressed": String(state.compare.includes(m.key)), onClick: () => { state.compare = state.compare.includes(m.key) ? state.compare.filter((k) => k !== m.key) : [...state.compare, m.key].slice(-6); drawCompare(); } }, m.label)));
    box.replaceChildren(trend(d, state.compare.map((k) => byKey(d, k)).filter(Boolean), { title: "Explorateur de tendances", desc: `Superposez jusqu'à 6 courbes · totaux ${GRAIN[d.range.granularity]}` }));
  };
  drawCompare();
  const v = (k) => byKey(d, k).total;
  return [
    h("div", { class: "ob-grid" }, HEADLINES.map((k, i) => kpi(byKey(d, k), i, () => open(byKey(d, k).group)))),
    panel("Faits marquants", "Variations d'au moins 20 % et pics inhabituels, face à la période précédente", facts.length ? h("ul", { class: "ob-facts" }, facts.map((f) => h("li", { class: f.tone }, f.text))) : empty("Rien d'inhabituel sur la période.", "check")),
    chips, box,
    h("div", { class: "cols2" },
      panel("De la visite au contact", "Volumes comparés sur la période : ce n'est pas le suivi d'une même personne.", v("listingViews") ? funnelChart({ steps: [{ label: "Fiches vues", value: v("listingViews"), color: "#477eaa" }, { label: "Contacts sur les annonces", value: v("contacts"), color: "#c6a35c" }, { label: "Demandes de visite", value: v("visitRequests"), color: "#087448" }] }) : empty("Aucune fiche vue sur la période.", "funnel")),
      panel("Répartition de l'activité", "Poids de chaque famille (hors audience et revenus)", donut({ caption: "actions", items: ["reactions", "contacts", "growth", "safety"].map((g, i) => ({ label: GROUPS.find((x) => x[0] === g)[1], value: ofGroup(d, g).reduce((a, m) => a + m.total, 0), color: color(i) })) }))),
  ];
}

function groupTab(d, g) {
  const list = ofGroup(d, g); const b = d.breakdowns; const v = (k) => byKey(d, k).total;
  const out = [h("div", { class: "ob-grid" }, list.map((m, i) => kpi(m, i)))];
  if (g === "revenue") out.push(trend(d, [byKey(d, "revenue")], { title: "Montant encaissé", kind: "columns" }), trend(d, [byKey(d, "paymentsStarted"), byKey(d, "paymentsPaid")], { title: "Paiements lancés et encaissés" }));
  else out.push(trend(d, list, { title: "Évolution" }));
  if (g === "audience") out.push(
    h("div", { class: "ob-grid" }, tile("Temps moyen sur une fiche", b.dwell.count ? `${nf(b.dwell.averageSeconds)} s` : "—", `${nf(b.dwell.count)} mesure(s)`), tile("Fiches vues pour 100 pages", ratio(v("listingViews"), v("pageViews"))), tile("Contacts pour 100 fiches vues", ratio(v("contacts"), v("listingViews"))), tile("Actions de robots écartées", nf(b.botEvents))),
    heatmap(b.heat),
    h("div", { class: "cols2" }, ring("Origine du trafic", "D'où viennent les actions", b.sources, SOURCE_LABELS, "actions"), ring("Appareils", "Type d'appareil", b.devices, DEVICE_LABELS, "actions")),
    h("div", { class: "cols2" }, ranking("Pages les plus vues", "12 premières", b.pages), ranking("Tous les gestes enregistrés", "Par type d'action", b.eventTypes, EVENT_LABELS)),
    panel("Annonces qui attirent le plus", "Vues, contacts et favoris sur la période", table([{ label: "Annonce", render: (r) => h("a", { class: "link", href: `/#/annonce/${encodeURIComponent(r.id)}`, target: "_blank", rel: "noopener" }, r.title || r.id) }, { label: "Quartier", key: "neighborhood" }, { label: "Vues", num: true, render: (r) => nf(r.views) }, { label: "Contacts", num: true, render: (r) => nf(r.contacts) }, { label: "Favoris", num: true, render: (r) => nf(r.favorites) }], b.topListings, { emptyText: "Aucune annonce consultée sur la période." })),
    h("p", { class: "note" }, "Non mesuré aujourd'hui, donc non affiché : visiteurs uniques et impressions des cartes d'annonces dans les listes. « Fiches annonces vues » compte les ouvertures de fiche."));
  if (g === "reactions") out.push(h("div", { class: "cols2" },
    ring("Types de réactions", "Répartition sur la période", list.map((m) => ({ label: m.label, n: m.total })), {}, "réactions"),
    panel("Engagement", "Rapports sur la période", h("div", { class: "ob-grid" }, tile("Favoris pour 100 fiches vues", ratio(v("favorites"), v("listingViews"))), tile("Commentaires pour 100 fiches vues", ratio(v("comments"), v("listingViews")))))));
  if (g === "contacts") out.push(h("div", { class: "cols2" }, ring("Canaux de contact", "Contacts sur les annonces", b.contactKinds, {}, "contacts"), ring("Demandes de visite", "État des demandes créées sur la période", b.visitStatus, {}, "visites")));
  if (g === "growth") {
    const labels = d.buckets.map((x) => bucketLabel(x, d.range.granularity));
    const cum = (title, values, name, c) => panel(title, "Total cumulé à la fin de chaque tranche", labels.length < 3 ? columnChart({ items: values.map((n, i) => ({ label: labels[i], value: n })), color: c, hot: c }) : areaChart({ labels, series: [{ key: name, name, color: c, values }] }));
    out.push(h("div", { class: "cols2" }, cum("Comptes", d.cumulative.users, "Comptes", "#087448"), cum("Annonces déposées", d.cumulative.listings, "Annonces", "#477eaa")),
      h("div", { class: "cols2" }, ring("Catégories des nouvelles annonces", null, b.categories, {}, "annonces"), ring("Type de transaction", null, b.transactions, {}, "annonces")),
      h("div", { class: "cols2" }, ranking("Quartiers les plus actifs", "Nouvelles annonces", b.places), ring("État des nouvelles annonces", "Statut actuel", b.listingStatus, {}, "annonces")),
      h("p", { class: "note" }, "Les comptes aujourd'hui supprimés sont exclus du cumul de départ ; les inscriptions de la période les incluent."));
  }
  if (g === "safety") out.push(h("div", { class: "cols2" }, ranking("Journal de sécurité", "Événement et résultat", b.security), ring("Méthodes de connexion", "Connexions réussies", b.loginMethods, {}, "connexions")));
  if (g === "revenue") out.push(ring("État des paiements", "Paiements créés sur la période", b.paymentStatus, {}, "paiements"), h("p", { class: "note" }, "Montant encaissé : paiements au statut PAID, datés de leur encaissement. Un paiement remboursé change de statut et n'y figure plus. Pour la comptabilité : « Paiements & finances »."));
  return out;
}

function liveTab(d, ctx) {
  const l = d.live;
  const todo = [["Annonces à valider", l.pending.listings, "#/listings"], ["Signalements ouverts", l.pending.reports, "#/complaints"], ["Incidents non résolus", l.pending.incidents, "#/monitoring"], ["Messages de l'accueil à traiter", l.pending.messages, "#/overview"]];
  return [
    h("div", { class: "ob-grid" }, tile("30 dernières minutes", nf(l.last30m), "actions"), tile("Dernière heure", nf(l.lasthour), "actions"), tile("24 dernières heures", nf(l.last24h), "actions")),
    panel("À traiter maintenant", null, h("div", { class: "ob-grid" }, todo.map(([label, n, hash]) => h("button", { type: "button", class: "card ob-kpi", onClick: () => ctx.go(hash) }, h("small", null, label), h("strong", null, nf(n)), pill(n ? "warn" : "ok", n ? "À voir" : "À jour"))))),
    panel("Derniers gestes sur le site", "40 plus récents, robots exclus, sans identité des personnes. Indépendant du filtre de dates.", table([
      { label: "Heure", render: (r) => new Date(r.at).toLocaleString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
      { label: "Geste", render: (r) => EVENT_LABELS[r.type] ?? r.type }, { label: "Détail", render: (r) => r.listingTitle || r.page || "—" },
      { label: "Origine", render: (r) => SOURCE_LABELS[r.source] ?? "—" }, { label: "Appareil", render: (r) => DEVICE_LABELS[r.device] ?? "—" }], l.latest, { emptyText: "Aucun geste enregistré pour le moment." })),
  ];
}

export function observatoryView(ctx) {
  let timer = null; let refresh = () => {};
  const setAuto = (on) => { clearInterval(timer); timer = null; if (on) timer = setInterval(() => { if (!document.hidden) refresh(); }, 60_000); };
  ctx.onLeave(() => setAuto(false));
  setAuto(state.auto);
  return page(ctx, {
    eyebrow: "PILOTAGE", title: "Observatoire du site",
    desc: "Tendances, audience, réactions, croissance, sécurité et revenus, comparés à la période précédente.",
    load: () => {
      if (state.preset !== "custom") [state.from, state.to] = PRESETS.find((p) => p[0] === state.preset)[2]();
      return api(`/staff/owner/observatory?from=${encodeURIComponent(state.from)}&to=${encodeURIComponent(state.to)}`);
    },
    build(d, reload) {
      refresh = reload;
      const from = h("input", { class: "input", type: "date", value: state.from, max: back(0) });
      const to = h("input", { class: "input", type: "date", value: state.to, max: back(0) });
      const bar = h("div", { class: "card ob-filter" },
        h("div", { class: "ob-chips" }, PRESETS.map(([id, label]) => h("button", { type: "button", class: "ob-chip", "aria-pressed": String(state.preset === id), onClick: () => { state.preset = id; reload(); } }, label))),
        h("form", { class: "ob-dates", onSubmit: (e) => { e.preventDefault(); if (!from.value || !to.value) return; Object.assign(state, { preset: "custom", from: from.value, to: to.value }); reload(); } },
          h("label", { class: "field" }, "Du", from), h("label", { class: "field" }, "Au", to), h("button", { class: "btn primary sm", type: "submit" }, ico("filter"), "Filtrer")),
        h("div", { class: "ob-chips" },
          h("button", { type: "button", class: "btn sm", onClick: reload }, ico("refresh"), "Actualiser"),
          h("button", { type: "button", class: "ob-chip", "aria-pressed": String(state.auto), onClick: (e) => { state.auto = !state.auto; e.currentTarget.setAttribute("aria-pressed", String(state.auto)); setAuto(state.auto); } }, "Actualisation chaque minute"),
          h("button", { type: "button", class: "btn sm", onClick: () => csv(d) }, ico("download"), "Exporter (CSV)")),
        h("small", { class: "muted" }, `Du ${frDay(d.range.from)} au ${frDay(d.range.to)} · comparé au ${frDay(d.range.previousFrom)} – ${frDay(d.range.previousTo)} · relevé à ${new Date(d.generatedAt).toLocaleTimeString("fr-FR", { timeZone: "UTC" })} (heure du Mali)${state.to === back(0) ? " · la journée en cours est incomplète" : ""}`));
      const body = h("div", { class: "stack ob-body" });
      const tabs = h("div", { class: "ob-tabs", role: "tablist" });
      const open = (id) => {
        state.tab = id;
        tabs.replaceChildren(...TABS.map(([key, label, icon]) => h("button", { type: "button", role: "tab", class: "ob-tab", "aria-selected": String(key === id), onClick: () => open(key) }, ico(icon), label)));
        body.replaceChildren(...(id === "overview" ? overviewTab(d, open) : id === "live" ? liveTab(d, ctx) : groupTab(d, id)));
      };
      open(state.tab);
      return [d.collecting === false ? h("p", { class: "note bad" }, "La collecte d'événements est éteinte : l'audience et les gestes ne sont pas comptés.") : null, bar, tabs, body];
    },
  });
}
