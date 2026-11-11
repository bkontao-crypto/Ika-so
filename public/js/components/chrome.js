import { h, mount } from "/js/dom.js";
import { icon } from "/js/icons.js";
import { S } from "/js/core/state.js";
import { currentRoute, go } from "/js/core/router.js";

// Navigation de la refonte : Accueil, Acheter, Louer, Terrains, Carte, Annonceurs, Partenaires.
// Toutes les routes d'origine restent accessibles (Favoris et Messages : icônes d'en-tête et menu du profil ;
// Publier : bouton d'en-tête et bouton central du mobile ; Confiance : pied de page et accueil).
const onListings = (p) => p === "/annonces" || p.startsWith("/annonce/") || p === "/mes-annonces";
const NAV = [
  { href: "#/", label: "Accueil", icon: "home", match: (p) => p === "/" },
  { href: "#/annonces?t=Vente", label: "Acheter", icon: "tag", match: (p, q) => onListings(p) && q?.get("t") === "Vente" },
  { href: "#/annonces?t=Location", label: "Louer", icon: "key", match: (p, q) => onListings(p) && q?.get("t") === "Location" },
  { href: "#/annonces?category=Terrain", label: "Terrains", icon: "ruler", match: (p, q) => onListings(p) && q?.get("category") === "Terrain" },
  { href: "#/carte", label: "Carte", icon: "pin", match: (p) => p === "/carte" || p.startsWith("/localiser") },
  { href: "#/annonceurs", label: "Annonceurs", icon: "users", match: (p) => p === "/annonceurs" || p.startsWith("/annonceur/") },
  { href: "#/partenaires", label: "Partenaires", icon: "building", match: (p) => p === "/partenaires" },
];
// Barre du bas (mobile, accessible au pouce) : cinq accès, Publier au centre.
const NAV_MOBILE = [
  { href: "#/", label: "Accueil", icon: "home", match: (p) => p === "/" },
  { href: "#/annonces", label: "Annonces", icon: "list", match: (p, q) => onListings(p) },
  { href: "#/publier", label: "Publier", icon: "plus", match: (p) => p === "/publier" || p.startsWith("/modifier/"), publish: true },
  { href: "#/carte", label: "Carte", icon: "pin", match: (p) => p === "/carte" || p.startsWith("/localiser") },
  { href: "#/profil", label: "Compte", icon: "user", match: (p) => ["/profil", "/centre", "/favoris", "/connexion", "/paiements", "/agence", "/mon-profil-public"].includes(p) || p.startsWith("/boite"), loginHref: "#/connexion" },
];

// Icônes absentes de icons.js (thème clair / sombre), dessinées en SVG réel (createElementNS).
const THEME_PATHS = {
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
};
function themeIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", THEME_PATHS[name]);
  svg.append(path);
  return svg;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// ---------- Bouton « Retour » ----------
// Pile des pages visitées dans cette session : un retour revient à la page précédente réelle ;
// s'il n'y en a pas (page ouverte directement par un lien), on remonte vers la page « parent ».
const navStack = [];
export function trackNav() {
  const here = location.hash || "#/";
  if (navStack.length >= 2 && navStack[navStack.length - 2] === here) navStack.pop(); // retour du navigateur
  else if (navStack[navStack.length - 1] !== here) navStack.push(here);
  if (navStack.length > 50) navStack.shift();
}
/** Page de repli quand il n'y a pas d'historique dans l'application. */
function parentOf(path) {
  if (/^\/annonce\/[^/]+$/.test(path)) return "/annonces";
  if (/^\/boite\/[^/]+$/.test(path)) return "/boite";
  if (/^\/(modifier|localiser)\/[^/]+$/.test(path)) return "/mes-annonces";
  if (/^\/annonceur\/[^/]+$/.test(path)) return "/annonceurs";
  if (path === "/centre") return "/profil";
  if (path === "/premium") return "/partenaires";
  if (path === "/mon-profil-public" || path === "/mes-annonces" || path === "/paiements" || path === "/agence") return "/profil";
  return "/";
}
function goBack() {
  if (navStack.length > 1) history.back();
  else go(parentOf(currentRoute().path));
}
function renderBackbar(path) {
  const bar = document.getElementById("backbar");
  if (!bar) return;
  bar.hidden = path === "/";
  if (path === "/") return mount(bar);
  mount(bar, h("button", { class: "back-btn", type: "button", onClick: goBack, "aria-label": "Retour à la page précédente" },
    icon("arrow-left"), h("span", null, "Retour")));
}

function openMenu(opener) {
  const close = () => { backdrop.remove(); panel.remove(); document.removeEventListener("keydown", onKey); opener.focus(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const { path, params } = currentRoute();
  const backdrop = h("div", { class: "rx-drawer-backdrop", onClick: close });
  const items = [...NAV, { href: "#/favoris", label: "Mes favoris", icon: "heart", match: (p) => p === "/favoris" }, { href: "#/boite", label: "Messages", icon: "message", match: (p) => p.startsWith("/boite") }, { href: "#/confiance", label: "Centre de confiance", icon: "shield-check", match: (p) => p === "/confiance" }];
  const panel = h("aside", { class: "rx-drawer stack", role: "dialog", "aria-modal": "true", "aria-label": "Menu", tabindex: "-1" },
    h("div", { class: "row-between" }, h("strong", { class: "title" }, "Menu"), h("button", { class: "btn btn-small btn-quiet", type: "button", onClick: close, "aria-label": "Fermer le menu" }, icon("x"))),
    h("nav", { class: "rx-menu-list", "aria-label": "Menu principal" }, items.map((it) => h("a", { href: it.href, class: it.match(path, params) ? "active" : "", "aria-current": it.match(path, params) ? "page" : null, onClick: close }, icon(it.icon), it.label))),
    h("a", { class: "btn btn-gold btn-block", href: "#/publier", onClick: close }, icon("plus"), "Publier une annonce"));
  document.body.append(backdrop, panel);
  document.addEventListener("keydown", onKey);
  panel.focus();
}

// Android : certains navigateurs / PWA laissent la barre système (gestes, boutons) recouvrir le bas de la page.
// On mesure l'écart entre la fenêtre et la zone réellement visible, et la barre du bas remonte d'autant.
function fitBottomNav() {
  const vv = window.visualViewport;
  if (!vv) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
  const hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty("--bn-extra", `${!typing && hidden > 0 && hidden <= 64 ? hidden : 0}px`);
}
if (typeof window !== "undefined" && window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitBottomNav);
  window.addEventListener("orientationchange", () => setTimeout(fitBottomNav, 250));
  window.addEventListener("load", fitBottomNav);
}

export function renderChrome() {
  const { path, params } = currentRoute();
  document.body.classList.toggle("is-home", path === "/");
  renderBackbar(path);

  const link = (item, cls, badgeCls) => {
    const active = item.match(path, params);
    const href = item.loginHref && !S.user ? item.loginHref : item.href;
    return h("a", { href, class: cls + (active ? " active" : "") + (item.publish ? " publish-btn" : ""), "aria-current": active ? "page" : null },
      item.publish ? h("span", { class: "nav-icon" }, icon(item.icon)) : icon(item.icon), h("span", null, item.label),
      item.count && S.unread ? h("span", { class: badgeCls }, String(S.unread)) : null);
  };
  mount(document.getElementById("nav-desktop"), NAV.map((item) => link(item, "nav-link", "notification")));
  mount(document.getElementById("nav-bottom"), NAV_MOBILE.map((item) => link(item, "mobile-nav-link", "badge-count")));

  // Thème appliqué avant le dessin du bouton, pour que l'icône reflète le thème réel.
  const saved = localStorage.getItem("ika_theme") || "light";
  applyTheme(saved);

  const actions = document.getElementById("account");
  const themeBtn = h("button", {
    class: "icon-btn", type: "button", id: "themeToggle", "aria-label": "Mode clair / sombre", title: "Mode clair / sombre",
    onClick: () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem("ika_theme", next);
      renderChrome();
    },
  }, themeIcon(saved === "dark" ? "sun" : "moon"));

  const publish = h("a", { href: "#/publier", class: "btn btn-small header-publish" }, icon("plus"), "Publier");
  const inbox = S.user
    ? h("a", { href: "#/boite", class: "icon-btn", "aria-label": S.unread ? `Messages, ${S.unread} non lu${S.unread > 1 ? "s" : ""}` : "Messages", title: "Messages" },
        icon("message"), S.unread ? h("span", { class: "badge-count", style: { position: "absolute", top: "-4px", right: "-4px", margin: "0" } }, String(S.unread)) : null)
    : null;
  const account = S.user
    ? h("details", { class: "profile-menu" },
        h("summary", { class: "profile", "aria-label": "Mon compte", title: "Mon compte" }, (S.user.name || S.user.fullName || "U").slice(0, 1).toUpperCase()),
        h("div", { class: "profile-dropdown" },
          h("a", { href: "#/profil" }, "Mon profil"),
          h("a", { href: "#/centre" }, "Mon espace"),
          h("a", { href: "#/favoris" }, "Mes favoris"),
          h("a", { href: "#/mes-annonces" }, "Mes annonces"),
          h("a", { href: "#/boite" }, "Mes conversations"),
          h("a", { href: "#/mon-profil-public" }, "Profil public")))
    : h("a", { href: "#/connexion", class: "btn btn-small", id: "loginLink" }, "Connexion");
  // Menu complet sur mobile et tablette : toutes les entrées de navigation dans un tiroir latéral.
  const menuBtn = h("button", { class: "icon-btn rx-menu-btn", type: "button", "aria-label": "Ouvrir le menu", "aria-haspopup": "dialog", onClick: (e) => openMenu(e.currentTarget) }, icon("list"));
  mount(actions, publish, themeBtn, inbox, account, menuBtn);
}
