import { api, fail, h, mount, toast } from "/js/dom.js";
import { icon } from "/js/icons.js";
import { S, clearSession } from "/js/core/state.js";
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
  { href: "#/decouvrir", label: "Découvrir", icon: "sparkles", match: (p) => p === "/decouvrir" },
  { href: "#/annonceurs", label: "Annonceurs", icon: "users", match: (p) => p === "/annonceurs" || p.startsWith("/annonceur/") },
  { href: "#/partenaires", label: "Partenaires", icon: "building", match: (p) => p === "/partenaires" },
];
// Barre du bas (mobile, accessible au pouce) : cinq accès, Publier au centre.
const NAV_MOBILE = [
  { href: "#/", label: "Accueil", icon: "home", match: (p) => p === "/" },
  { href: "#/decouvrir", label: "Découvrir", icon: "sparkles", match: (p) => p === "/decouvrir" },
  { href: "#/publier", label: "Publier", icon: "plus", match: (p) => p === "/publier" || p.startsWith("/modifier/"), publish: true },
  { href: "#/carte", label: "Carte", icon: "pin", match: (p) => p === "/carte" || p.startsWith("/localiser") },
  { href: "#/profil", label: "Compte", icon: "user", match: (p) => ["/profil", "/centre", "/favoris", "/connexion", "/paiements", "/agence"].includes(p) || p.startsWith("/boite"), loginHref: "#/connexion" },
];

// En-tête personnalisable par le superadmin (onglets, logo, couleurs, bouton Publier). Dernière version connue gardée en local :
// le premier affichage ne clignote pas, et le site reste complet si l'API est lente ou en panne.
let HEADER = null;
try { HEADER = JSON.parse(localStorage.getItem("ika_header") || "null"); } catch { HEADER = null; }
const DEFAULT_LOGO = "/media/logo-ika-so.webp";
const SYSTEM_MATCH = Object.fromEntries(NAV.map((n, i) => [["home", "buy", "rent", "land", "map", "discover", "advertisers", "partners"][i], n]));
/** Onglets affichés : ceux du superadmin (ordre, noms, visibilité), à défaut les onglets d'origine. */
function navItems() {
  if (!HEADER?.tabs?.length) return NAV;
  const out = [];
  for (const t of HEADER.tabs) {
    if (t.visible === false) continue;
    const base = SYSTEM_MATCH[t.id];
    if (base) { out.push({ ...base, label: t.label || base.label }); continue; }
    const external = /^https:/i.test(t.href);
    const target = external ? null : String(t.href).replace(/^#/, "").split("?")[0];
    out.push({ href: t.href, label: t.label, icon: "list", external, match: (p, q) => !external && p === target && (!String(t.href).includes("?") || [...new URLSearchParams(String(t.href).split("?")[1])].every(([k, v]) => q?.get(k) === v)) });
  }
  return out.length ? out : NAV;
}
/** Logo, couleurs et bouton de l'en-tête (appelé à chaque dessin : tout reste cohérent après un changement de thème). */
function applyHeaderStyle() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const logo = header.querySelector(".brand-logo");
  const want = HEADER?.logoUrl || DEFAULT_LOGO;
  if (logo && logo.getAttribute("src") !== want) logo.setAttribute("src", want);
  const pair = HEADER?.[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
  const custom = !!(pair?.bg && pair?.ink);
  header.toggleAttribute("data-custom", custom);
  header.style.setProperty("--header-bg", custom ? pair.bg : "");
  header.style.setProperty("--header-ink", custom ? pair.ink : "");
}
// Pied de page personnalisable : le HTML d'origine (index.html) reste le repli si l'API est lente ou en panne.
let FOOTER = null;
try { FOOTER = JSON.parse(localStorage.getItem("ika_footer") || "null"); } catch { FOOTER = null; }
function applyFooter() {
  const f = FOOTER;
  const grid = document.querySelector(".site-footer .foot-grid");
  if (!f || !grid || !Array.isArray(f.columns)) return;
  const intro = grid.querySelector(".foot-brand p");
  if (intro && typeof f.intro === "string") intro.textContent = f.intro;
  grid.querySelectorAll(".foot-col").forEach((n) => n.remove());
  grid.append(...f.columns.map((c) => h("nav", { class: "foot-col", "aria-label": c.title },
    h("h3", null, c.title),
    h("ul", null, c.links.map((l) => h("li", null, h("a", { href: l.href, target: /^https:/i.test(l.href) ? "_blank" : null, rel: /^https:/i.test(l.href) ? "noopener noreferrer" : null }, l.label)))))));
  const copy = document.querySelector(".site-footer .foot-copy");
  if (copy && typeof f.copyright === "string") {
    const year = copy.querySelector("#year")?.textContent || String(new Date().getFullYear());
    copy.replaceChildren("© ", h("span", { id: "year" }, year), ` ${f.copyright}`);
  }
}
export async function loadFooter() {
  try {
    FOOTER = await api("/site-footer");
    try { localStorage.setItem("ika_footer", JSON.stringify(FOOTER)); } catch { /* stockage indisponible */ }
    applyFooter();
  } catch { /* on garde la dernière version connue */ }
}

/** Charge la configuration publiée puis redessine l'en-tête. Silencieux en cas d'échec. */
export async function loadHeader() {
  try {
    HEADER = await api("/site-header");
    try { localStorage.setItem("ika_header", JSON.stringify(HEADER)); } catch { /* stockage indisponible */ }
    renderChrome();
  } catch { /* on garde la dernière version connue */ }
}

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

function openMenu(opener) {
  const close = () => { backdrop.remove(); panel.remove(); document.removeEventListener("keydown", onKey); opener.focus(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const { path, params } = currentRoute();
  const backdrop = h("div", { class: "rx-drawer-backdrop", onClick: close });
  const nav = navItems();
  const items = [...nav.slice(0, 1), { href: "#/annonces", label: "Toutes les annonces", icon: "list", match: (p, q) => onListings(p) && !q?.get("t") && !q?.get("category") }, ...nav.slice(1), { href: "#/favoris", label: "Mes favoris", icon: "heart", match: (p) => p === "/favoris" }, { href: "#/boite", label: "Messages", icon: "message", match: (p) => p.startsWith("/boite") }, { href: "#/confiance", label: "Centre de confiance", icon: "shield-check", match: (p) => p === "/confiance" }];
  const panel = h("aside", { class: "rx-drawer stack", role: "dialog", "aria-modal": "true", "aria-label": "Menu", tabindex: "-1" },
    h("div", { class: "row-between" }, h("strong", { class: "title" }, "Menu"), h("button", { class: "btn btn-small btn-quiet", type: "button", onClick: close, "aria-label": "Fermer le menu" }, icon("x"))),
    h("nav", { class: "rx-menu-list", "aria-label": "Menu principal" }, items.map((it) => h("a", { href: it.href, class: it.match(path, params) ? "active" : "", "aria-current": it.match(path, params) ? "page" : null, onClick: close }, icon(it.icon), it.label))),
    h("a", { class: "btn btn-gold btn-block", href: "#/publier", onClick: close }, icon("plus"), "Publier une annonce"),
    S.user ? h("button", { class: "btn btn-block", type: "button", onClick: async () => {
      try { await api("/auth/logout", { method: "POST", body: {} }); } catch (error) { fail(error); return; }
      clearSession(); close(); toast("Déconnecté."); go("/");
    } }, "Se déconnecter") : null);
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

  const link = (item, cls, badgeCls) => {
    const active = item.match(path, params);
    const href = item.loginHref && !S.user ? item.loginHref : item.href;
    return h("a", { href, class: cls + (active ? " active" : "") + (item.publish ? " publish-btn" : ""), "aria-current": active ? "page" : null, target: item.external ? "_blank" : null, rel: item.external ? "noopener noreferrer" : null },
      item.publish ? h("span", { class: "nav-icon" }, icon(item.icon)) : icon(item.icon), h("span", null, item.label),
      item.count && S.unread ? h("span", { class: badgeCls }, String(S.unread)) : null);
  };
  mount(document.getElementById("nav-desktop"), navItems().map((item) => link(item, "nav-link", "notification")));
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

  const publish = HEADER?.publishVisible === false ? null : h("a", { href: "#/publier", class: "btn btn-small header-publish" }, icon("plus"), HEADER?.publishLabel || "Publier");
  const inbox = S.user
    ? h("a", { href: "#/boite", class: "icon-btn", "aria-label": S.unread ? `Messages, ${S.unread} non lu${S.unread > 1 ? "s" : ""}` : "Messages", title: "Messages" },
        icon("message"), S.unread ? h("span", { class: "badge-count", style: { position: "absolute", top: "-4px", right: "-4px", margin: "0" } }, String(S.unread)) : null)
    : null;
  const account = S.user
    ? h("details", { class: "profile-menu" },
        h("summary", { class: "profile", "aria-label": "Mon compte", title: "Mon compte" }, S.meta?.avatarUrl
          ? h("img", { class: "profile-photo", src: S.meta.avatarUrl, alt: "", width: 43, height: 43, decoding: "async" })
          : (S.user.name || S.user.fullName || "U").slice(0, 1).toUpperCase()),
        h("div", { class: "profile-dropdown" },
          h("a", { href: "#/profil" }, "Mon profil"),
          h("a", { href: "#/centre" }, "Mon espace premium"),
          h("a", { href: "#/favoris" }, "Mes favoris"),
          h("a", { href: "#/mes-annonces" }, "Mes annonces"),
          h("a", { href: "#/boite" }, "Mes conversations"),
          h("a", { href: "#/alertes" }, "Mes alertes"),
          h("button", { type: "button", class: "profile-logout", onClick: async () => {
            try { await api("/auth/logout", { method: "POST", body: {} }); } catch (error) { fail(error); return; }
            clearSession(); toast("Déconnecté."); go("/");
          } }, "Se déconnecter")))
    : h("a", { href: "#/connexion", class: "btn btn-small", id: "loginLink" }, "Connexion");
  // Menu complet sur mobile et tablette : toutes les entrées de navigation dans un tiroir latéral.
  const menuBtn = h("button", { class: "icon-btn rx-menu-btn", type: "button", "aria-label": "Ouvrir le menu", "aria-haspopup": "dialog", onClick: (e) => openMenu(e.currentTarget) }, icon("list"));
  mount(actions, publish, HEADER?.themeToggle === false ? null : themeBtn, inbox, account, menuBtn);
  applyHeaderStyle();
  applyFooter();
}
