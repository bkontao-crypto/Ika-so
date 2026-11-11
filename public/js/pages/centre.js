// Centre de contrôle des annonceurs Premium certifiés : statistiques, annonces, carte (à la demande), messages, alertes, échéances.
// Réservé : l'accès est décidé par le serveur (Premium en cours ET annonceur certifié) ; cette page ne fait qu'afficher.
import { api, fail, formatDate, formatPrice, h, mount } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { icon } from "/js/icons.js";
import { ago, avatar, lineChart, loadCss, premiumCard } from "/js/components/espace.js";

const PERIODS = [[7, "7 derniers jours"], [14, "14 jours"], [30, "30 jours"], [90, "90 jours"]];
const STATUS = { PUBLISHED: ["Active", "pill-green"], PENDING: ["En attente", "pill-gold"], REJECTED: ["Refusée", "pill-warn"], EXPIRED: ["Expirée", "pill-warn"] };
const VISIT = { PENDING: ["En cours", "pill-gold"], ACCEPTED: ["Confirmée", "pill-green"], DECLINED: ["Refusée", "pill-warn"], CANCELLED: ["Annulée", ""] };
const nf = (n) => new Intl.NumberFormat("fr-FR").format(n);
const delta = (n) => h("span", { class: `esp-delta ${n < 0 ? "down" : "up"}` }, `${n < 0 ? "↓" : "↑"} ${n > 0 ? "+" : ""}${n} %`);
const sec = (id, title, right, ...kids) => h("section", { class: "card pad stack esp-card", id }, h("div", { class: "row-between" }, h("h2", null, title), right), ...kids);
const empty = (t) => h("p", { class: "small muted" }, t);
const ALERT_IC = { warn: ["!", "bad"], info: ["i", "info"], ok: ["✓", "ok"] };
const alertItem = (a) => { const [g, c] = ALERT_IC[a.level] ?? ALERT_IC.info; return h("a", { class: "esp-item", href: a.link }, h("span", { class: `esp-alic ${c}`, "aria-hidden": "true" }, g), h("span", { class: "grow" }, h("strong", null, a.text)), h("small", { class: "muted" }, ago(a.at))); };
const item = (title, sub, aside, href) => h(href ? "a" : "div", { class: "esp-item", href }, h("span", { class: "grow" }, h("strong", null, title), sub ? h("small", { class: "muted" }, sub) : null), aside);

export async function centrePage() {
  if (needLogin()) return;
  loadCss();
  let acc;
  try { acc = await api("/me/center/access"); }
  catch (error) {
    if (error?.code === "RESTRICTED" || String(error?.message || "").toLowerCase().includes("restreint")) {
      mount(app, h("div", { class: "card pad stack" },
        h("h1", { class: "title" }, "Compte restreint"),
        h("p", null, "Votre compte est actuellement restreint. Le centre de contrôle n'est pas accessible."),
        h("a", { class: "btn", href: "#/aide" }, "Voir l'aide")));
      return;
    }
    fail(error);
    return;
  }
  if (!acc.eligible) { const { standardCentre } = await import("/js/pages/centre-standard.js"); return standardCentre(acc); }
  let days = 7;
  const host = h("div", { class: "esp-dash" });
  mount(app, host);

  async function draw() {
    const d = await api(`/me/center?days=${days}`);
    const first = (d.access.name || S.user?.name || "").split(/\s+/)[0] || "";
    const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const nav = (label, ic, { id, href, badge, on } = {}) => h(href ? "a" : "button", { class: `esp-nav${on ? " on" : ""}`, type: href ? null : "button", href, onClick: id ? () => go(id) : null }, icon(ic), h("span", null, label), badge ? h("em", null, String(badge)) : null);

    // ----- Barre latérale avec profil + hamburger mobile -----
    const side = h("aside", { class: "esp-side", id: "esp-side", "aria-label": "Centre de contrôle" },
      h("div", { class: "esp-profile" },
        avatar(d.access.name || S.user?.name || "", d.access.avatarUrl || null, "sm"),
        h("div", { class: "esp-profile-info" },
          h("strong", null, d.access.name || S.user?.name || "Mon compte"),
          h("small", null, d.access.certified ? "Compte certifié" : "Compte Premium"))),
      nav("Vue d'ensemble", "home", { id: "esp-top", on: true }),
      nav("Mes annonces", "list", { id: "esp-ann", badge: d.kpis.live || null }),
      nav("Mes messages", "message", { href: "#/boite?onglet=messages", badge: d.kpis.unread || null }),
      nav("Mes visites", "calendar", { href: "#/boite?onglet=visites", badge: d.kpis.visitsPending || null }),
      nav("Statistiques", "chart", { id: "esp-stats" }),
      nav("Carte", "pin", { id: "esp-map" }),
      nav("Échéances", "clock", { id: "esp-ech" }),
      nav("Mes paiements", "card", { href: "#/paiements" }),
      nav("Mon profil public", "user", { href: "#/mon-profil-public" }),
      nav("Paramètres", "settings", { href: "#/profil" }),
      nav("Aide & Support", "info", { id: "esp-aide" }),
      h("div", { class: "esp-prem" }, h("strong", null, "Compte Premium"), h("small", null, `Expire le ${formatDate(d.access.premiumUntil)} (${d.access.daysLeft} j)`), h("a", { class: "btn btn-gold btn-small", href: "#/partenaires" }, "Gérer mon abonnement")));

    const burger = h("button", { class: "esp-burger", type: "button", "aria-label": "Menu", onClick: () => {
      side.classList.toggle("open");
    } }, "☰");

    // ----- Bannière + indicateurs -----
    const hero = h("section", { class: "esp-hero", id: "esp-top" }, h("h1", null, first ? `Bonjour ${first}` : "Bonjour"), h("p", null, "Bienvenue dans votre centre de contrôle IKA SO. Gérez vos annonces, suivez vos performances et répondez plus vite."),
      h("div", { class: "row" }, h("a", { class: "btn btn-gold", href: "#/publier" }, "Publier une annonce"), h("a", { class: "btn esp-ghost", href: "#/mon-profil-public" }, "Mon profil public")));
    const kpi = (ic, label, value, link, href) => h("a", { class: "esp-kpi", href }, h("span", { class: "esp-kic" }, icon(ic)), h("small", null, label), h("strong", null, nf(value)), h("em", null, link));
    const kpis = h("div", { class: "esp-kpis" },
      kpi("list", "Mes annonces", d.kpis.listings, "Voir mes annonces →", "#/mes-annonces"), kpi("heart", `Favoris (${days} j)`, d.kpis.favorites, "Voir mes annonces →", "#/mes-annonces"),
      kpi("message", "Messages non lus", d.kpis.unread, "Voir mes messages →", "#/boite?onglet=messages"), kpi("calendar", "Mes visites", d.kpis.visits, "Voir mes visites →", "#/boite?onglet=visites"));

    // ----- Statistiques -----
    const sel = h("select", { class: "input esp-sel", "aria-label": "Période", onChange: (e) => { days = Number(e.target.value); draw().catch(fail); } }, PERIODS.map(([v, l]) => h("option", { value: v, selected: v === days }, l)));
    const stats = sec("esp-stats", "Statistiques de mes annonces", sel,
      h("div", { class: "esp-legend" }, h("span", { class: "v" }, "Vues"), h("span", { class: "c" }, "Contacts")), lineChart(d.stats.series),
      h("div", { class: "esp-tiles" },
        h("div", null, icon("eye"), h("strong", null, nf(d.stats.views)), h("small", null, "vues"), delta(d.stats.viewsChange)),
        h("div", null, icon("user"), h("strong", null, nf(d.stats.contacts)), h("small", null, "contacts (appels, WhatsApp, messages, visites)"), delta(d.stats.contactsChange))),
      d.analyticsActive ? null : h("p", { class: "notice small" }, "Les vues ne sont comptées que si la collecte de statistiques est active sur le site. Les contacts, eux, sont déjà comptés."));

    // ----- Annonces récentes -----
    const ann = sec("esp-ann", "Mes annonces récentes", h("a", { class: "text-link", href: "#/mes-annonces" }, "Voir tout"),
      d.listings.length ? h("div", { class: "esp-listings" }, d.listings.map((l) => { const [lab, cls] = STATUS[l.status] ?? [l.status, ""];
        return h("article", { class: "esp-listing" }, h("div", { class: "esp-limg" }, h("img", { src: l.imageUrl, alt: "", loading: "lazy" }), h("span", { class: `pill ${cls}` }, lab), l.boosted ? h("span", { class: "pill pill-gold esp-boost" }, "À la une") : null),
          h("strong", null, formatPrice(l.price, l.transactionType)), h("span", null, l.title), h("small", { class: "muted" }, l.neighborhood),
          h("small", { class: "esp-nums" }, `${nf(l.views)} vues · ${nf(l.favorites)} favoris · ${nf(l.contacts)} contacts`),
          h("a", { class: "btn btn-small", href: `#/modifier/${encodeURIComponent(l.id)}` }, "Gérer")); })) : empty("Vous n'avez pas encore d'annonce."));

    // ----- Carte : masquée tant qu'on ne la demande pas (aucune requête, aucune bibliothèque chargée) -----
    const mapBox = h("div", { class: "esp-mapbox", hidden: true, "aria-live": "polite" });
    let mapState = "idle"; // idle | loading | ready
    const mapBtn = h("button", { class: "btn btn-small", type: "button", "aria-expanded": "false", onClick: async () => {
      if (mapState === "loading") return;
      if (mapState === "ready") { const open = mapBox.hidden; mapBox.hidden = !open; mapBtn.textContent = open ? "Masquer la carte" : "Afficher la carte"; mapBtn.setAttribute("aria-expanded", String(open)); return; }
      mapState = "loading"; mapBtn.disabled = true; mapBtn.textContent = "Chargement…"; mapBox.hidden = false; mapBox.replaceChildren(empty("Chargement de la carte…"));
      try {
        const pins = await api("/me/center/map");
        const { mapView } = await import("/js/components/listing-card.js");
        mapBox.replaceChildren(pins.length ? mapView(pins) : empty("Aucune de vos annonces n'est encore localisée. Ouvrez « Localiser » sur une annonce pour la placer sur la carte."));
        mapState = "ready"; mapBtn.textContent = "Masquer la carte"; mapBtn.setAttribute("aria-expanded", "true");
      } catch (error) { mapState = "idle"; mapBox.hidden = true; mapBtn.textContent = "Afficher la carte"; fail(error); } finally { mapBtn.disabled = false; }
    } }, "Afficher la carte");
    const map = sec("esp-map", "Carte de vos annonces", mapBtn, mapBox, h("p", { class: "small muted" }, "La carte ne se charge que lorsque vous l'ouvrez, pour économiser vos données."));

    // ----- Colonnes secondaires -----
    const ech = sec("esp-ech", "Prochaines échéances", null, d.deadlines.length ? d.deadlines.map((x) => item(x.label, formatDate(x.at), h("span", { class: `pill ${x.daysLeft <= 7 ? "pill-warn" : "pill-green"}` }, x.daysLeft <= 0 ? "Aujourd'hui" : `Dans ${x.daysLeft} j`))) : empty("Aucune échéance proche."));
    const dem = sec("esp-dem", "Mes demandes", h("a", { class: "text-link", href: "#/boite?onglet=visites" }, "Voir tout"), d.requests.length ? d.requests.map((r) => { const [lab, cls] = VISIT[r.status] ?? [r.status, ""]; return item(`Demande de visite · ${r.title}`, ago(r.createdAt), h("span", { class: `pill ${cls}` }, lab), "#/boite?onglet=visites"); }) : empty("Aucune demande de visite."));
    const aide = sec("esp-aide", "Assistance rapide", null,
      item("Guide utilisateur", "Conseils pour annoncer et rester en sécurité", null, "/guides"), item("Centre de confiance", "Badges, vérifications, bonnes pratiques", null, "#/confiance"),
      item("Contacter un conseiller", "Ouvrir une réclamation", null, "#/reclamations"), item("Signaler un problème", "Annonce, profil ou paiement", null, "#/reclamations"));

    const right = h("div", { class: "esp-right" }, premiumCard({ premium: true, premiumUntil: d.access.premiumUntil, daysLeft: d.access.daysLeft }, "centre"),
      sec("esp-act", "Activité sur la période", null, h("div", { class: "esp-tiles three" }, h("div", null, h("strong", null, nf(d.stats.views)), h("small", null, "vues")), h("div", null, h("strong", null, nf(d.kpis.favorites)), h("small", null, "favoris")), h("div", null, h("strong", null, nf(d.stats.contacts)), h("small", null, "contacts")))),
      sec("esp-msg", "Messages récents", h("a", { class: "text-link", href: "#/boite?onglet=messages" }, "Voir tout"), d.messages.length ? d.messages.map((m) => h("a", { class: `esp-item${m.unread ? " unread" : ""}`, href: `#/boite/${encodeURIComponent(m.id)}` }, avatar(m.from, null, "sm"), h("span", { class: "grow" }, h("strong", null, m.from), h("small", { class: "muted" }, m.text || m.listing)), h("small", { class: "muted" }, ago(m.at)), m.unread ? h("i", { class: "esp-dot", "aria-label": "Non lu" }) : null)) : empty("Aucun message pour le moment.")),
      sec("esp-alerts", "Alertes importantes", d.alerts.length ? h("span", { class: "pill pill-warn" }, String(d.alerts.length)) : null, d.alerts.length ? d.alerts.map(alertItem) : empty("Aucune alerte. Tout est en ordre.")),
      sec("esp-notes", "Notifications", h("a", { class: "text-link", href: "#/boite" }, "Voir tout"), d.notifications.length ? d.notifications.map((n) => item(n.title, n.body ? `${n.body} · ${ago(n.createdAt)}` : ago(n.createdAt), n.read ? null : h("i", { class: "esp-dot" }), n.link?.startsWith("#/") ? n.link : "#/boite")) : empty("Aucune notification.")),
      h("section", { class: "card pad esp-cta" }, icon("plus"), h("div", { class: "grow" }, h("strong", null, "Publier une annonce"), h("small", { class: "muted" }, "Touchez plus de monde et trouvez le bon client plus vite.")), h("a", { class: "btn btn-primary btn-small", href: "#/publier" }, "Créer")));

    mount(host, burger, side, h("div", { class: "esp-main" }, h("div", { class: "esp-left" }, hero, kpis, stats, ann, map, h("div", { class: "esp-two" }, ech, dem), aide), right));
  }
  try { await draw(); } catch (error) { if (!error?.stale) mount(app, h("div", { class: "card pad stack" }, h("p", null, error instanceof Error ? error.message : "Erreur."), h("a", { class: "btn", href: "#/profil" }, "Retour au profil"))); }
}
