// Écrans Owner Center : Graphiques & fréquentation, Santé du système, Entonnoir Premium.
// Ils lisent uniquement /staff/owner/charts, /staff/owner/health et /staff/owner/premium-funnel ; l'accès est contrôlé par le serveur (modules « charts », « health », « premium-funnel »).
import { api, h, panel, table, bars, pill, nf, dateTime, shortDay, areaChart, empty } from "./ui.js";
import { page, mini, minis } from "./v-modules.js";
import { donut, columnChart, funnelChart } from "./charts-modern.js";

/** Boutons de période partagés (7 / 30 / 90 jours). */
const periodButtons = (get, set, reload) => ["7", "30", "90"].map((d) =>
  h("button", { class: `btn sm${get() === d ? " primary" : ""}`, type: "button", onClick: () => { set(d); reload(); } }, `${d} jours`));

let chartDays = "30";
export const chartsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Graphiques & fréquentation",
  desc: "Annonces créées, contacts reçus, activité du site par jour et heures de forte fréquentation.",
  load: () => api(`/staff/owner/charts?days=${chartDays}`),
  actions: (_d, reload) => periodButtons(() => chartDays, (d) => { chartDays = d; }, reload),
  build(c) {
    const t = c.traffic ?? { daily: [], byHour: [], lastAggregatedDay: null, uniqueVisitorsAvailable: false };
    const sum = (rows, k) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
    const out = [minis(
      mini("Annonces créées", nf(sum(c.listings, "n")), `${chartDays} derniers jours`),
      mini("Contacts reçus", nf(sum(c.contacts, "n")), `${chartDays} derniers jours`),
      mini("Actions sur le site", nf(sum(t.daily, "actions")), "robots exclus"),
      mini("Dernier jour agrégé", t.lastAggregatedDay ?? "Aucun"))];
    if (!t.lastAggregatedDay) out.push(h("p", { class: "note" }, "La fréquentation n'est pas encore calculée : l'agrégation est manuelle (commande « node scripts/aggregate.mjs --apply »). Les annonces et contacts ci-dessous, eux, sont en direct."));
    const dayLabels = (rows) => rows.map((r) => shortDay(String(r.day).slice(0, 10)));
    // Une courbe n'a pas de sens avec moins de 3 jours : on montre alors des barres.
    const trend = (rows, name, color) => (rows.length >= 3
      ? areaChart({ labels: dayLabels(rows), series: [{ key: "n", name, color, values: rows.map((r) => r.n) }] })
      : bars(rows.map((r) => ({ label: shortDay(String(r.day).slice(0, 10)), value: r.n })), { color }));
    out.push(h("div", { class: "cols2" },
      panel("Annonces créées par jour", null, c.listings.length ? trend(c.listings, "Annonces", "#087448") : empty("Aucune annonce créée sur la période.", "list")),
      panel("Contacts reçus par jour", null, c.contacts.length ? trend(c.contacts, "Contacts", "#477eaa") : empty("Aucun contact sur la période.", "mail"))));
    if (t.daily.length) {
      const series = [{ key: "a", name: "Actions", color: "#087448", values: t.daily.map((r) => r.actions) }, { key: "u", name: "Comptes connectés actifs", color: "#c6a35c", values: t.daily.map((r) => r.activeUsers) }];
      if (t.uniqueVisitorsAvailable) series.push({ key: "v", name: "Visiteurs uniques", color: "#477eaa", values: t.daily.map((r) => r.uniqueVisitors) });
      out.push(panel("Activité du site par jour", "Source : agrégats journaliers (jamais les événements bruts).", areaChart({ labels: dayLabels(t.daily), series })));
      if (!t.uniqueVisitorsAvailable) out.push(h("p", { class: "note" }, "Visiteurs uniques : non disponibles. L'identifiant anonyme de visiteur n'est pas encore collecté (avis juridique en attente) ; aucun chiffre n'est estimé. « Comptes connectés actifs » ne compte que les comptes ayant accepté la mesure."));
    }
    const peak = [...t.byHour].sort((a, b) => b.actions - a.actions).filter((r) => r.actions > 0).slice(0, 3).map((r) => r.hour);
    if (t.byHour.some((r) => r.actions > 0)) {
      const part = (from, to) => t.byHour.filter((r) => r.hour >= from && r.hour <= to).reduce((n, r) => n + r.actions, 0);
      out.push(h("div", { class: "cols2" },
        panel("Heures de forte fréquentation", `Actions par heure (UTC = heure du Mali). Pointes : ${peak.map((x) => `${String(x).padStart(2, "0")} h`).join(", ")}.`,
          columnChart({ items: t.byHour.map((r) => ({ label: `${String(r.hour).padStart(2, "0")} h`, value: r.actions, hot: peak.includes(r.hour) })) })),
        panel("Moment de la journée", "Répartition des actions (heure du Mali)", donut({ caption: "actions", items: [
          { label: "Matin (6–11 h)", value: part(6, 11), color: "#c6a35c" }, { label: "Après-midi (12–17 h)", value: part(12, 17), color: "#087448" },
          { label: "Soir (18–23 h)", value: part(18, 23), color: "#477eaa" }, { label: "Nuit (0–5 h)", value: part(0, 5), color: "#4b5563" }] }))));
    }
    return out;
  },
});

const uptime = (sec) => { const m = Math.floor(sec / 60); const d = Math.floor(m / 1440); const hh = Math.floor((m % 1440) / 60); return d ? `${d} j ${hh} h` : hh ? `${hh} h ${m % 60} min` : `${m} min`; };
export const healthView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Santé du système", desc: "État de la base de données et volumes principaux. Pour les incidents et sauvegardes : « Surveillance & incidents » et « Sauvegardes ».",
  load: () => api("/staff/owner/health"),
  actions: (_d, reload) => h("button", { class: "btn sm", type: "button", onClick: reload }, "Actualiser"),
  build: (s) => [
    h("div", { class: "card panel row" }, h("b", null, "Base de données"), s.database === "ok" ? pill("ok", "Opérationnelle") : pill("bad", "Erreur"), h("small", { class: "muted" }, `Relevé du ${dateTime(s.timestamp)}`)),
    minis(mini("Annonces", nf(s.listings)), mini("Comptes", nf(s.users)), mini("Fichiers stockés", nf(s.files)), mini("En marche depuis", uptime(s.uptime), "depuis le dernier démarrage du serveur"))],
});

let funnelDays = "30";
export const premiumFunnelView = (ctx) => page(ctx, {
  eyebrow: "PAIEMENTS & PREMIUM", title: "Entonnoir Premium", desc: "Du clic sur « Devenir Premium » au paiement, par point d'entrée.",
  load: () => api(`/staff/owner/premium-funnel?days=${funnelDays}`),
  actions: (_d, reload) => periodButtons(() => funnelDays, (d) => { funnelDays = d; }, reload),
  build(f) {
    const tot = f.rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, started: a.started + r.started, paid: a.paid + r.paid }), { clicks: 0, started: 0, paid: 0 });
    return [
      f.collecting === false ? h("p", { class: "note bad" }, "La collecte d'événements est éteinte : les clics ne sont pas comptés.") : null,
      minis(mini("Clics Premium", nf(tot.clicks)), mini("Paiements lancés", nf(tot.started)), mini("Paiements réussis", nf(tot.paid))),
      tot.clicks ? h("div", { class: "cols2" },
        panel("Entonnoir de conversion", `${f.days} derniers jours`, funnelChart({ steps: [
          { label: "Clics Premium", value: tot.clicks, color: "#477eaa" }, { label: "Paiements lancés", value: tot.started, color: "#c6a35c" }, { label: "Paiements réussis", value: tot.paid, color: "#087448" }] })),
        panel("Clics par origine", "D'où viennent les demandes Premium", donut({ caption: "clics", items: f.rows.map((r, i) => ({ label: r.origin, value: r.clicks, color: ["#087448", "#477eaa", "#c6a35c", "#7b5ea7", "#c94f4f", "#4b5563"][i % 6] })) }))) : null,
      panel("Par point d'entrée", `${f.days} derniers jours`, table([
        { label: "Origine", key: "origin" }, { label: "Clics", num: true, render: (r) => nf(r.clicks) }, { label: "Lancés", num: true, render: (r) => nf(r.started) },
        { label: "Payés", num: true, render: (r) => nf(r.paid) }, { label: "Conversion", num: true, render: (r) => (r.conversionPct == null ? "—" : `${r.conversionPct} %`) }], f.rows, { emptyText: "Aucun clic ni paiement Premium sur la période." })),
      f.note ? h("p", { class: "muted small" }, f.note) : null];
  },
});
