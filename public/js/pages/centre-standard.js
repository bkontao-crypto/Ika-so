// Espace « standard » : même disposition que le centre Premium, allégé. Les fonctions Premium sont montrées verrouillées,
// avec une invitation claire à passer Premium. Aucune donnée Premium n'est demandée au serveur (route /me/center/standard).
import { api, fail, formatPrice, h, mount } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { icon } from "/js/icons.js";
import { ago, avatar, premiumCard } from "/js/components/espace.js";

const STATUS = { PUBLISHED: ["Active", "pill-green"], PENDING: ["En attente", "pill-gold"], REJECTED: ["Refusée", "pill-warn"], EXPIRED: ["Expirée", "pill-warn"] };
const nf = (n) => new Intl.NumberFormat("fr-FR").format(n);
const up = (from) => `#/premium?from=${from}`;
const sec = (id, title, right, ...kids) => h("section", { class: "card pad stack esp-card", id }, h("div", { class: "row-between" }, h("h2", null, title), right), ...kids);
const empty = (t) => h("p", { class: "small muted" }, t);
const item = (title, sub, aside, href) => h(href ? "a" : "div", { class: "esp-item", href }, h("span", { class: "grow" }, h("strong", null, title), sub ? h("small", { class: "muted" }, sub) : null), aside);
const tag = (text = "Premium") => h("span", { class: "std-tag" }, icon("lock"), text);

/** Aperçu flouté, purement décoratif (aucune vraie donnée). */
const previews = {
  chart: () => h("div", { class: "std-pv std-pv-bars", "aria-hidden": "true" }, [30, 55, 38, 70, 52, 82, 64].map((v) => h("i", { style: { height: `${v}%` } }))),
  map: () => h("div", { class: "std-pv std-pv-map", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
  lines: () => h("div", { class: "std-pv std-pv-lines", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
};

const PERKS = [
  ["chart", "chart", "Statistiques détaillées", "Vues et contacts sur 7 à 90 jours, avec variation par rapport à la période précédente."],
  ["pin", "map", "Carte de vos annonces", "Visualisez toutes vos annonces sur une carte, ouverte à la demande."],
  ["bell", "lines", "Alertes importantes", "Signalements reçus, annonces qui expirent, paiements : soyez prévenu à temps."],
  ["clock", "lines", "Échéances", "Renouvellement, mises à la une et expirations d'un coup d'œil."],
];

export async function standardCentre(acc) {
  if (acc?.status && acc.status !== "ACTIVE") {
    mount(app, h("div", { class: "card pad stack" },
      h("h1", { class: "title" }, "Compte restreint"),
      h("p", null, "Votre compte est actuellement restreint. L'accès à votre espace est temporairement indisponible."),
      h("a", { class: "btn", href: "#/aide" }, "Voir l'aide")));
    return;
  }
  const host = h("div", { class: "esp-dash std" });
  mount(app, host);
  let d;
  try { d = await api("/me/center/standard"); } catch (error) {
    if (error?.code === "RESTRICTED" || String(error?.message || "").toLowerCase().includes("restreint")) {
      mount(app, h("div", { class: "card pad stack" },
        h("h1", { class: "title" }, "Compte restreint"),
        h("p", null, "Votre compte est actuellement restreint. L'accès à votre espace est temporairement indisponible."),
        h("a", { class: "btn", href: "#/aide" }, "Voir l'aide")));
      return;
    }
    if (!error?.stale) fail(error);
    return;
  }
  const first = (d.access.name || S.user?.name || "").split(/\s+/)[0] || "";
  const needsCert = d.access.premium && !d.access.certified; // Premium payé mais profil non certifié
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const nav = (label, ic, { id, href, badge, on } = {}) => h(href ? "a" : "button", { class: `esp-nav${on ? " on" : ""}`, type: href ? null : "button", href, onClick: id ? () => go(id) : null }, icon(ic), h("span", null, label), badge ? h("em", null, String(badge)) : null);
  const locked = (label, ic) => h("a", { class: "esp-nav std-locked", href: up("espace-lock"), "aria-label": `${label} : réservé aux comptes Premium` }, icon("lock"), h("span", null, label), h("b", null, "Premium"));

  const side = h("aside", { class: "esp-side", id: "esp-side", "aria-label": "Mon espace" },
    h("div", { class: "esp-profile" },
      avatar(d.access.name || S.user?.name || "", null, "sm"),
      h("div", { class: "esp-profile-info" },
        h("strong", null, d.access.name || S.user?.name || "Mon compte"),
        h("small", null, needsCert ? "Premium en attente" : "Compte standard"))),
    nav("Vue d'ensemble", "home", { id: "esp-top", on: true }),
    nav("Mes annonces", "list", { href: "#/mes-annonces", badge: d.kpis.live || null }),
    nav("Mes messages", "message", { href: "#/boite?onglet=messages", badge: d.kpis.unread || null }),
    nav("Mes visites", "calendar", { href: "#/boite?onglet=visites", badge: d.kpis.visits || null }),
    nav("Mes favoris", "heart", { href: "#/favoris" }),
    nav("Mon profil public", "user", { href: "#/mon-profil-public" }),
    nav("Mes paiements", "card", { href: "#/paiements" }),
    nav("Paramètres", "settings", { href: "#/profil" }),
    locked("Statistiques"), locked("Carte"), locked("Alertes"), locked("Échéances"),
    h("div", { class: "esp-prem" }, h("strong", null, "Compte standard"), h("small", null, needsCert ? "Votre Premium attend la certification de votre profil." : "Passez Premium pour débloquer le centre de contrôle."),
      h("a", { class: "btn btn-gold btn-small", href: needsCert ? "#/profil" : up("espace-sidebar") }, needsCert ? "Faire certifier mon profil" : "Voir les avantages")));

  const burger = h("button", { class: "esp-burger", type: "button", "aria-label": "Menu", onClick: () => {
    side.classList.toggle("open");
  } }, "☰");

  const hero = h("section", { class: "esp-hero", id: "esp-top" }, h("h1", null, first ? `Bonjour ${first}` : "Bonjour"),
    h("p", null, "Bienvenue dans votre espace annonceur. Publiez, suivez vos messages et développez votre activité."),
    h("div", { class: "row" }, h("a", { class: "btn btn-gold", href: "#/publier" }, icon("plus"), "Publier une annonce"), h("a", { class: "btn esp-ghost", href: needsCert ? "#/profil" : up("espace-hero") }, needsCert ? "Certifier mon profil" : "Passer Premium")));

  const teaser = h("section", { class: "std-teaser", "aria-label": "Invitation Premium" }, h("span", { class: "std-star", "aria-hidden": "true" }, icon("star")),
    h("div", { class: "grow" }, h("strong", null, d.contacts7 > 0 ? `${nf(d.contacts7)} contact${d.contacts7 > 1 ? "s" : ""} reçu${d.contacts7 > 1 ? "s" : ""} ces 7 derniers jours.` : "Vos contacts des 7 derniers jours."),
      h("small", null, "Avec Premium, voyez combien de personnes les consultent, comparez avec la période précédente et repérez vos meilleures annonces.")),
    h("a", { class: "pc-btn", href: needsCert ? "#/profil" : up("espace-teaser") }, needsCert ? "Certifier mon profil" : "Découvrir Premium", h("span", { "aria-hidden": "true" }, "→")));

  const kpi = (ic, label, value, link, href) => h("a", { class: "esp-kpi", href }, h("span", { class: "esp-kic" }, icon(ic)), h("small", null, label), h("strong", null, nf(value)), h("em", null, link));
  const kpis = h("div", { class: "esp-kpis" },
    kpi("list", "Mes annonces", d.kpis.listings, "Voir mes annonces →", "#/mes-annonces"), kpi("heart", "Favoris reçus", d.kpis.favorites, "Voir mes annonces →", "#/mes-annonces"),
    kpi("message", "Messages non lus", d.kpis.unread, "Voir mes messages →", "#/boite?onglet=messages"), kpi("calendar", "Mes visites", d.kpis.visits, "Voir mes visites →", "#/boite?onglet=visites"));

  const ann = sec("esp-ann", "Mes annonces récentes", h("a", { class: "text-link", href: "#/mes-annonces" }, "Voir tout"),
    d.listings.length ? h("div", { class: "esp-listings" }, d.listings.slice(0, 3).map((l) => { const [lab, cls] = STATUS[l.status] ?? [l.status, ""];
      return h("article", { class: "esp-listing" }, h("div", { class: "esp-limg" }, h("img", { src: l.imageUrl, alt: "", loading: "lazy" }), h("span", { class: `pill ${cls}` }, lab)),
        h("strong", null, formatPrice(l.price, l.transactionType)), h("span", null, l.title), h("small", { class: "muted" }, l.neighborhood),
        h("small", { class: "esp-nums" }, `${nf(l.contacts)} contact${l.contacts > 1 ? "s" : ""}`),
        h("a", { class: "std-lockline", href: up("espace-lockline") }, icon("lock"), "Vues et favoris : Premium"),
        h("a", { class: "btn btn-small", href: `#/modifier/${encodeURIComponent(l.id)}` }, "Gérer")); }))
      : h("div", { class: "stack" }, empty("Vous n'avez pas encore d'annonce."), h("a", { class: "btn btn-primary btn-small", href: "#/publier" }, "Publier ma première annonce")));

  // ----- Complétion du profil : la voie vers la certification, donc vers Premium -----
  const p = d.profile;
  const prof = sec("esp-profil", "Complétez votre profil", h("span", { class: "pill pill-green" }, `${p.percent} %`),
    h("div", { class: "std-bar", role: "progressbar", "aria-valuenow": String(p.percent), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Profil complété" }, h("i", { style: { width: `${p.percent}%` } })),
    h("p", { class: "small muted" }, "Un profil complet et certifié inspire confiance, remonte dans l'annuaire des annonceurs et prépare l'accès à Premium."),
    h("ul", { class: "std-steps" }, p.steps.map((s) => h("li", { class: s.done ? "done" : "" }, h("span", { class: "std-check", "aria-hidden": "true" }, s.done ? icon("check") : null), h("span", { class: "grow" }, s.label), s.done ? h("small", { class: "muted" }, "Fait") : h("a", { class: "btn btn-small", href: s.href }, "Faire")))));

  // ----- Blocs verrouillés : on voit ce que Premium apporte, sans rien montrer de réel -----
  const more = sec("esp-more", "Avec Premium, allez plus loin", h("a", { class: "text-link", href: up("espace-perk") }, "Tous les avantages"),
    h("div", { class: "std-perks" }, PERKS.map(([ic, pv, title, text]) => h("article", { class: "std-perk" }, tag(), previews[pv](), h("span", { class: "std-pic" }, icon(ic)), h("h3", null, title), h("p", { class: "small muted" }, text), h("a", { class: "std-unlock", href: up("espace-perk") }, "Débloquer", h("span", { "aria-hidden": "true" }, "→"))))));

  const msgs = sec("esp-msg", "Messages récents", h("a", { class: "text-link", href: "#/boite?onglet=messages" }, "Voir tout"),
    d.messages.length ? d.messages.map((m) => h("a", { class: `esp-item${m.unread ? " unread" : ""}`, href: `#/boite/${encodeURIComponent(m.id)}` }, avatar(m.from, null, "sm"), h("span", { class: "grow" }, h("strong", null, m.from), h("small", { class: "muted" }, m.text)), h("small", { class: "muted" }, ago(m.at)), m.unread ? h("i", { class: "esp-dot", "aria-label": "Non lu" }) : null)) : empty("Aucun message pour le moment."));
  const notes = sec("esp-notes", "Notifications", h("a", { class: "text-link", href: "#/boite" }, "Voir tout"),
    d.notifications.length ? d.notifications.map((n) => item(n.title, n.body ? `${n.body} · ${ago(n.createdAt)}` : ago(n.createdAt), n.read ? null : h("i", { class: "esp-dot" }), n.link?.startsWith("#/") ? n.link : "#/boite")) : empty("Aucune notification."));
  const cta = h("section", { class: "card pad esp-cta" }, icon("plus"), h("div", { class: "grow" }, h("strong", null, "Publier une annonce"), h("small", { class: "muted" }, "Touchez plus de monde et trouvez le bon client plus vite.")), h("a", { class: "btn btn-primary btn-small", href: "#/publier" }, "Créer"));

  mount(host, burger, side, h("div", { class: "esp-main" }, h("div", { class: "esp-left" }, hero, teaser, kpis, ann, prof, more), h("div", { class: "esp-right" }, premiumCard({ premium: false }, "espace-card"), msgs, notes, cta)));
}
