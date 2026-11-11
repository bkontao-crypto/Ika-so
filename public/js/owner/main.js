// Owner Control Center : coquille (menu, barre du haut, palette Ctrl+K, thème) et routeur par adresse « #/… ».
// Le contrôle d'accès est fait par le serveur à chaque appel ; ici on n'affiche que ce que le serveur accepte.
import { api, h, ico, toast, initials, empty } from "./ui.js";
import { overviewView } from "./v-overview.js";
import { activityView, traceView } from "./v-activity.js";
import * as M from "./v-modules.js";

const NAV = [
  ["Pilotage de la plateforme", [
    ["overview", "grid", "Vue générale"], ["activity", "pulse", "Mouvements du site", { tag: "NOUVEAU" }], ["listings", "list", "Annonces & modération", { count: "pendingListings" }],
    ["users", "users", "Utilisateurs & comptes"], ["agencies", "building", "Agences & annonceurs"], ["trust", "shield", "Confiance & vérifications", { count: "pendingProofs" }],
    ["complaints", "flag", "Signalements & réclamations", { count: "openComplaints" }], ["payments", "wallet", "Paiements & finances", { count: "pendingPayments" }], ["subscriptions", "clock", "Abonnements & formules"]]],
  ["Croissance & relation client", [
    ["crm", "funnel", "CRM & pipeline"], ["contacts", "mail", "Contacts & visites"], ["marketing", "megaphone", "Marketing & campagnes"], ["newsletters", "news", "Newsletters"], ["regions", "pin", "Régions & tendances"]]],
  ["Système & configuration", [
    ["ai", "sparkles", "Assistance IA"], ["reports", "file", "Rapports & exports"], ["monitoring", "flag", "Surveillance & incidents", { count: "openIncidents" }], ["backups", "database", "Sauvegardes & restaurations"],
    ["settings", "gear", "Paramètres plateforme"], ["places", "pin", "Quartiers & pays"], ["homepage", "home", "Page d’accueil"], ["seo", "globe", "SEO, logo & pages légales"], ["i18n", "swap", "Langues, catégories & redirections"], ["audit", "scroll", "Journal d'audit"]]],
];
const FLAT = NAV.flatMap(([, items]) => items).map(([id, icon, label]) => ({ id, icon, label }));
const CAT_LABELS = { admin: "Administration", account: "Comptes", security: "Connexions", listing: "Annonces", engagement: "Interactions", safety: "Confiance", finance: "Paiements", growth: "Marketing", system: "Système", traffic: "Fréquentation" };
const VIEWS = { overview: overviewView, activity: (c) => activityView(c), audit: (c) => activityView(c, { preset: "audit" }), listings: M.listingsView, users: M.usersView, agencies: M.agenciesView, trust: M.trustView, complaints: M.complaintsView, payments: M.paymentsView,
  subscriptions: M.subscriptionsView, crm: M.crmView, contacts: M.contactsView, marketing: M.marketingView, newsletters: M.newslettersView, regions: M.regionsView, ai: M.aiView, reports: M.reportsView, monitoring: M.monitoringView,
  backups: M.backupsView, settings: M.settingsView, homepage: M.homepageView, seo: M.seoView, i18n: M.i18nView, places: M.placesView };

const root = document.getElementById("root");
const leaveHooks = [];
let badges = {}; let alerts = []; let me = null;
let content; let side; let scrim; let navEl; let crumb; let bell; let bellBadge;

const ctx = {
  userId: null,
  go: (hash) => { location.hash = hash; },
  refresh: () => route(),
  onLeave: (fn) => leaveHooks.push(fn),
  categoryLabel: (k) => CAT_LABELS[k] ?? k,
  setBadges(c) { badges = c ?? {}; paintNav(); },
  setAlerts(a) { alerts = a ?? []; paintBell(); },
};

function theme() {
  const saved = localStorage.getItem("ika-owner-theme");
  if (saved) document.documentElement.dataset.theme = saved;
}
try { theme(); } catch { /* stockage indisponible : thème clair par défaut */ }
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("ika-owner-theme", next); } catch { /* ignoré */ }
}

function paintNav() {
  if (!navEl) return;
  const current = location.hash.replace(/^#\/?/, "").split("/")[0].split("?")[0] || "overview";
  navEl.replaceChildren(...NAV.flatMap(([title, items]) => [h("div", { class: "navtitle" }, title), h("nav", { class: "nav", "aria-label": title }, items.map(([id, icon, label, o]) => {
    const n = o?.count ? badges[o.count] : null;
    return h("a", { href: `#/${id}`, "aria-current": current === id ? "page" : null, onClick: () => closeMenu() }, ico(icon), label, o?.tag ? h("span", { class: "new" }, o.tag) : null, n ? h("span", { class: "count" }, n > 99 ? "99+" : n) : null);
  }))]));
}
function paintBell() {
  if (!bellBadge) return;
  bellBadge.textContent = String(alerts.length); bellBadge.hidden = alerts.length === 0;
}
const closeMenu = () => { side?.classList.remove("open"); scrim?.classList.remove("open"); };

function shell() {
  navEl = h("div", { class: "navwrap" });
  side = h("aside", { class: "side", "aria-label": "Navigation Owner" },
    h("div", { class: "brand" }, h("img", { src: "/media/logo-ika-so.webp", alt: "IKA SO" }), h("div", null, h("b", null, "IKA SO IMMOBILIER"), h("small", null, "OWNER CONTROL CENTER"))),
    h("div", { class: "role" }, h("span", { class: "live" }), h("div", null, h("small", null, "SESSION SÉCURISÉE"), h("strong", null, "SUPERADMIN · Contrôle total"))),
    navEl,
    h("div", { class: "sidefoot" }, h("div", { class: "avatar" }, initials(me.fullName || "Owner")), h("div", null, h("b", null, me.fullName || "Propriétaire plateforme"), h("small", null, "Accès SUPERADMIN"))));
  scrim = h("div", { class: "scrim", onClick: closeMenu });
  crumb = h("b", null, "Vue générale");
  bellBadge = h("span", { class: "dot-badge" }); bellBadge.hidden = true;
  bell = h("button", { class: "iconbtn", type: "button", title: "Alertes", "aria-label": "Alertes", onClick: toggleBell }, ico("bell"), bellBadge);
  const top = h("header", { class: "top" },
    h("div", { class: "row" }, h("button", { class: "iconbtn menu-btn", type: "button", "aria-label": "Menu", onClick: () => { side.classList.add("open"); scrim.classList.add("open"); } }, ico("menu")), h("div", { class: "crumb" }, "Administration /", crumb)),
    h("div", { class: "topright" }, h("button", { class: "search", type: "button", onClick: openPalette }, ico("search"), h("span", null, "Rechercher un module, un compte…"), h("kbd", null, "Ctrl K")),
      h("a", { class: "iconbtn", href: "/admin", title: "Centre de contrôle classique", "aria-label": "Centre de contrôle classique" }, ico("external")),
      h("button", { class: "iconbtn", type: "button", title: "Thème clair / sombre", "aria-label": "Changer de thème", onClick: toggleTheme }, ico("sun")), bell, h("div", { class: "avatar", title: me.fullName }, initials(me.fullName || "Owner"))));
  content = h("div", { class: "content", id: "content", tabindex: "-1" });
  root.className = ""; root.replaceChildren(h("div", { class: "shell" }, side, h("main", null, top, content)), scrim);
}

let pop = null;
function toggleBell() {
  if (pop) { pop.remove(); pop = null; return; }
  pop = h("div", { class: "pop", role: "dialog", "aria-label": "Alertes" }, h("h3", { class: "tiny muted" }, "ALERTES & ACTIONS PRIORITAIRES"),
    alerts.length ? h("div", { class: "activity" }, alerts.map((a) => h("button", { class: "event", type: "button", onClick: () => { pop?.remove(); pop = null; ctx.go(`#/${a.module}`); } }, h("span", { class: `eventico ${a.tone}` }, ico(a.icon)), h("div", null, h("p", null, h("b", null, a.title), " ", a.text), h("small", null, a.where))))) : empty("Rien à signaler.", "check"));
  bell.parentElement.style.setProperty("position", "relative");
  bell.after(pop);
}
document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target) && !bell.contains(e.target)) { pop.remove(); pop = null; } });

// ---------- Palette de commandes ----------
function openPalette() {
  if (document.querySelector(".cmdk")) return;
  const input = h("input", { type: "text", placeholder: "Aller à un module, ou coller l'identifiant d'une annonce / d'un compte…", "aria-label": "Rechercher" });
  const list = h("ul", { role: "listbox" });
  const overlay = h("div", { class: "overlay open", onClick: close });
  const box = h("div", { class: "cmdk", role: "dialog", "aria-label": "Palette de commandes" }, input, list, h("footer", null, h("span", null, "↑↓ naviguer"), h("span", null, "Entrée ouvrir"), h("span", null, "Échap fermer")));
  let items = []; let idx = 0;
  function close() { box.remove(); overlay.remove(); }
  function paint() {
    const q = input.value.trim().toLowerCase();
    items = FLAT.filter((m) => !q || m.label.toLowerCase().includes(q)).map((m) => ({ icon: m.icon, label: m.label, run: () => ctx.go(`#/${m.id}`) }));
    if (input.value.trim().length >= 6) { const v = input.value.trim(); items.push({ icon: "route", label: `Retracer l'annonce « ${v.slice(0, 40)} »`, run: () => ctx.go(`#/trace/listing/${encodeURIComponent(v)}`) }, { icon: "route", label: `Retracer le compte « ${v.slice(0, 40)} »`, run: () => ctx.go(`#/trace/user/${encodeURIComponent(v)}`) }); }
    idx = Math.min(idx, Math.max(0, items.length - 1));
    list.replaceChildren(...items.map((it, i) => h("li", null, h("button", { type: "button", "aria-selected": String(i === idx), onClick: () => { close(); it.run(); } }, ico(it.icon), it.label))));
  }
  input.addEventListener("input", () => { idx = 0; paint(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
    else if (e.key === "Enter" && items[idx]) { close(); items[idx].run(); }
  });
  document.body.append(overlay, box); paint(); input.focus();
}
document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } });

// ---------- Routeur ----------
function route() {
  leaveHooks.splice(0).forEach((fn) => { try { fn(); } catch { /* nettoyage best effort */ } });
  const parts = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  const id = parts[0] || "overview";
  paintNav();
  let node; let title;
  if (id === "trace" && ["listing", "user"].includes(parts[1]) && parts[2]) { node = traceView(ctx, parts[1], decodeURIComponent(parts[2])); title = "Dossier de traçage"; }
  else if (VIEWS[id]) { node = VIEWS[id](ctx); title = FLAT.find((m) => m.id === id)?.label; }
  else { node = h("div", { class: "view" }, empty("Module introuvable.", "search")); title = "Introuvable"; }
  crumb.textContent = title ?? "Owner Control";
  document.title = `${title ?? "Owner Control"} · IKA SO Owner Control`;
  content.replaceChildren(node);
  window.scrollTo({ top: 0 });
}

async function start() {
  try {
    const session = await api("/me");
    if (!session.user) return gate("Connexion requise", "Ouvrez une session SUPERADMIN pour accéder au centre de commandement.", h("a", { class: "btn primary", href: "/#/connexion?next=%2Fprofil" }, "Connexion"));
    me = session.meta; ctx.userId = session.user.id;
    if (me.staffRole !== "SUPERADMIN") return gate("Accès réservé", "Le Owner Control Center est réservé au propriétaire (SUPERADMIN).", h("a", { class: "btn", href: "/admin" }, "Centre de contrôle de mon rôle"));
    shell(); window.addEventListener("hashchange", () => { closeMenu(); route(); }); route();
  } catch (e) { gate("Chargement impossible", e.message || "Réessayez dans un instant.", h("button", { class: "btn", type: "button", onClick: () => location.reload() }, "Réessayer")); }
}
function gate(title, text, action) {
  root.className = "boot";
  root.replaceChildren(h("div", { class: "card panel stack gate" }, h("div", { class: "eyebrow" }, "OWNER CONTROL CENTER"), h("h1", null, title), h("p", { class: "muted" }, text), h("div", null, action)));
}
start();
window.addEventListener("error", () => toast("Une erreur d'affichage est survenue.", true));
