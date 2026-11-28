// Owner Control Center : coquille (menu, barre du haut, palette Ctrl+K, thème) et routeur par adresse « #/… ».
// Le contrôle d'accès est fait par le serveur à chaque appel ; ici on n'affiche que ce que le serveur accepte.
import { api, h, ico, toast, initials, empty, panel } from "./ui.js";
import { overviewView } from "./v-overview.js";
import { activityView, traceView } from "./v-activity.js";
import * as M from "./v-modules.js";
import { customizeView } from "./v-customize.js";
import { usersView, userCenterView } from "./v-users.js";
import { chartsView, healthView, premiumFunnelView } from "./v-trafic.js";
import { mfaView } from "./v-mfa.js";
import { observatoryView } from "./v-observatory.js";
import { activationsView } from "./v-activations.js";
import { brand, brandUpper } from "../core/brand.js";

// Menu rangé par fonction : chaque groupe se replie (celui de la page en cours reste ouvert). Les adresses « #/… » ne changent pas.
const NAV = [
  ["Pilotage", "grid", [
    ["overview", "grid", "Vue générale"], ["observatory", "eye", "Observatoire du site", { tag: "NOUVEAU" }], ["activity", "pulse", "Mouvements du site", { tag: "NOUVEAU" }], ["stats", "pulse", "Statistiques"], ["charts", "pulse", "Graphiques & fréquentation"], ["regions", "pin", "Régions & tendances"], ["reports", "file", "Rapports & exports"]]],
  ["Utilisateurs & comptes", "users", [
    ["users", "users", "Utilisateurs & comptes"], ["agencies", "building", "Agences & annonceurs"], ["trust", "shield", "Confiance & vérifications", { count: "pendingProofs" }], ["permissions", "shield", "Permissions du personnel"], ["delegations", "users", "Délégations de modules"]]],
  ["Paiements & Premium", "wallet", [
    ["requests", "list", "Demandes & validations", { count: "pendingRequests" }], ["payments", "wallet", "Paiements & finances", { count: "pendingPayments" }], ["subscriptions", "clock", "Abonnements & formules"], ["premium-funnel", "funnel", "Entonnoir Premium"], ["payment-settings", "gear", "Réglages paiement"], ["star-requests", "shield", "Demandes Étoile"], ["star-settings", "shield", "Badge Étoile"]]],
  ["Annonces & modération", "list", [
    ["listings", "list", "Annonces & modération", { count: "pendingListings" }], ["discover", "flag", "Publications Découvrir"], ["alerts", "bell", "Alertes programmées"], ["complaints", "flag", "Signalements & réclamations", { count: "openComplaints" }]]],
  ["Clients & croissance", "funnel", [
    ["crm", "funnel", "CRM & pipeline"], ["contacts", "mail", "Contacts & visites"], ["marketing", "megaphone", "Marketing & campagnes"], ["newsletters", "news", "Newsletters"], ["whatsapp", "mail", "WhatsApp"]]],
  ["Paramètres du site", "gear", [
    ["activations", "gear", "Centre des activations", { tag: "NOUVEAU" }], ["rules", "gear", "Conditions & exceptions"], ["customize", "gear", "Personnalisation du site"], ["places", "pin", "Quartiers & pays"], ["i18n", "swap", "Langues, catégories & redirections"], ["ai", "sparkles", "Assistance IA"]]],
  ["Système & sécurité", "database", [
    ["monitoring", "flag", "Surveillance & incidents", { count: "openIncidents" }], ["health", "database", "Santé du système"], ["mfa", "lock", "Double authentification"], ["backups", "database", "Sauvegardes & restaurations"], ["audit", "scroll", "Journal d'audit"]]],
];
const FLAT = NAV.flatMap(([, , items]) => items).map(([id, icon, label]) => ({ id, icon, label }));
const CAT_LABELS = { admin: "Administration", account: "Comptes", security: "Connexions", listing: "Annonces", engagement: "Interactions", safety: "Confiance", finance: "Paiements", growth: "Marketing", system: "Système", traffic: "Fréquentation" };
// WhatsApp : la boîte de messages est une page du site (#/whatsapp) ; ici, une porte d'entrée réservée au Superadmin.
const whatsappView = () => h("div", { class: "view" }, panel("WhatsApp", "Messages reçus et envoyés avec vos contacts WhatsApp (Meta).",
  h("div", { class: "stack" },
    h("p", null, "Ouvrez la boîte WhatsApp pour lire les messages reçus, répondre et écrire à un numéro. L'adresse du webhook et le jeton à saisir chez Meta s'y trouvent aussi (bloc « Configuration Meta »)."),
    h("div", null, h("a", { class: "btn primary", href: "/#/whatsapp" }, "Ouvrir la boîte WhatsApp")))));

const VIEWS = { activations: activationsView, observatory: observatoryView, whatsapp: whatsappView, charts: chartsView, health: healthView, "premium-funnel": premiumFunnelView, overview: overviewView, requests: M.requestsView, activity: (c) => activityView(c), audit: (c) => activityView(c, { preset: "audit" }), "payment-settings": M.paymentSettingsView, "star-settings": M.starBadgeSettingsView, "star-requests": M.starBadgeRequestsView, rules: M.rulesView, discover: M.discoverView, alerts: M.alertsView, listings: M.listingsView, users: usersView, permissions: M.permissionsView, delegations: M.delegationsView, agencies: M.agenciesView, trust: M.trustView, complaints: M.complaintsView, payments: M.paymentsView,
  stats: M.statsView, subscriptions: M.subscriptionsView, crm: M.crmView, contacts: M.contactsView, marketing: M.marketingView, newsletters: M.newslettersView, regions: M.regionsView, ai: M.aiView, reports: M.reportsView, monitoring: M.monitoringView,
  backups: M.backupsView, customize: (c) => customizeView(c, "identity"), settings: (c) => customizeView(c, "identity"), homepage: (c) => customizeView(c, "homepage"), seo: (c) => customizeView(c, "seo"), i18n: M.i18nView, places: M.placesView, mfa: mfaView };

const root = document.getElementById("root");
const leaveHooks = [];
let badges = {}; let alerts = []; let me = null;
// Accès : le serveur renvoie les modules attribués (SUPERADMIN : tous ; ADMIN : délégués par le propriétaire, DEC-003).
let access = { all: false, modules: [] };
// Correspondance entre une entrée du menu et le module délégable. Sans correspondance : réservé au SUPERADMIN.
const MODULE_OF = { overview: "overview", activity: "activity", listings: "moderation", discover: "moderation", alerts: "moderation", agencies: "agencies", trust: "trust", complaints: "complaints",
  subscriptions: "subscriptions", crm: "crm", marketing: "marketing", regions: "regions", reports: "report", monitoring: "monitoring", charts: "charts", health: "health", "premium-funnel": "premium-funnel", stats: "report", users: "users", payments: "payments", "star-settings": "trust", "star-requests": "trust" };
const allowed = (id) => id === "requests" || access.all || (MODULE_OF[id] !== undefined && access.modules.includes(MODULE_OF[id]));
const firstAllowed = () => FLAT.find((m) => allowed(m.id))?.id ?? "overview";
let content; let side; let scrim; let navEl; let crumb; let bell; let bellBadge;

const ctx = {
  userId: null,
  isSuperadmin: () => access.all,
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

const openGroups = (() => { try { return new Set(JSON.parse(localStorage.getItem("ika-owner-nav") || "[]")); } catch { return new Set(); } })();
const saveGroups = () => { try { localStorage.setItem("ika-owner-nav", JSON.stringify([...openGroups])); } catch { /* ignoré */ } };
let lastCurrent = null;

function paintNav() {
  if (!navEl) return;
  const current = location.hash.replace(/^#\/?/, "").split("/")[0].split("?")[0] || "overview";
  const groups = NAV.map(([title, icon, all]) => [title, icon, all.filter(([id]) => allowed(id))]).filter(([, , items]) => items.length);
  // à l'arrivée sur une page, son groupe s'ouvre ; ensuite chacun reste comme l'utilisateur l'a laissé
  if (current !== lastCurrent) { lastCurrent = current; const g = groups.find(([, , items]) => items.some(([id]) => id === current)); if (g) openGroups.add(g[0]); }
  navEl.replaceChildren(...groups.map(([title, icon, items]) => {
    const open = openGroups.has(title);
    const total = items.reduce((n, [, , , o]) => n + (o?.count ? Number(badges[o.count]) || 0 : 0), 0);
    const head = h("button", { class: "navhead", type: "button", "aria-expanded": String(open), onClick: () => { if (openGroups.has(title)) openGroups.delete(title); else openGroups.add(title); saveGroups(); paintNav(); } },
      ico(icon), h("span", { class: "navhead-t" }, title), !open && total ? h("span", { class: "count" }, total > 99 ? "99+" : total) : null, h("span", { class: "chev", "aria-hidden": "true" }));
    return h("div", { class: `navgroup${open ? " open" : ""}` }, head, open ? h("nav", { class: "nav", "aria-label": title }, items.map(([id, ic, label, o]) => {
      const n = o?.count ? badges[o.count] : null;
      return h("a", { href: `#/${id}`, "aria-current": current === id ? "page" : null, onClick: () => closeMenu() }, ico(ic), label, o?.tag ? h("span", { class: "new" }, o.tag) : null, n ? h("span", { class: "count" }, n > 99 ? "99+" : n) : null);
    })) : null);
  }));
}
function paintBell() {
  if (!bellBadge) return;
  bellBadge.textContent = String(alerts.length); bellBadge.hidden = alerts.length === 0;
}
const closeMenu = () => { side?.classList.remove("open"); scrim?.classList.remove("open"); };

function avatarNode() {
  const name = me.fullName || "Owner";
  return me.avatarUrl
    ? h("div", { class: "avatar", title: name }, h("img", { src: me.avatarUrl, alt: `Photo de ${name}`, loading: "lazy" }))
    : h("div", { class: "avatar", title: name }, initials(name));
}

function shell() {
  navEl = h("div", { class: "navwrap" });
  side = h("aside", { class: "side", "aria-label": "Navigation Owner" },
    h("div", { class: "brand" }, h("img", { src: "/media/logo-ika-so.webp", alt: brandUpper() }), h("div", null, h("b", null, brandUpper()), h("small", null, "OWNER CONTROL CENTER"))),
    h("div", { class: "role" }, h("span", { class: "live" }), h("div", null, h("small", null, "SESSION SÉCURISÉE"), h("strong", null, access.all ? "SUPERADMIN · Contrôle total" : "ADMIN · Modules délégués"))),
    navEl,
    h("div", { class: "sidefoot" }, avatarNode(), h("div", null, h("b", null, me.fullName || "Propriétaire plateforme"), h("small", null, access.all ? "Accès SUPERADMIN" : "Accès délégué"))));
  scrim = h("div", { class: "scrim", onClick: closeMenu });
  crumb = h("b", null, "Vue générale");
  bellBadge = h("span", { class: "dot-badge" }); bellBadge.hidden = true;
  bell = h("button", { class: "iconbtn", type: "button", title: "Alertes", "aria-label": "Alertes", onClick: toggleBell }, ico("bell"), bellBadge);
  const top = h("header", { class: "top" },
    h("div", { class: "row" }, h("button", { class: "iconbtn menu-btn", type: "button", "aria-label": "Menu", onClick: () => { side.classList.add("open"); scrim.classList.add("open"); } }, ico("menu")), h("div", { class: "crumb" }, "Administration /", crumb)),
    h("div", { class: "topright" }, h("button", { class: "search", type: "button", onClick: openPalette }, ico("search"), h("span", null, "Rechercher un module, un compte…"), h("kbd", null, "Ctrl K")),
      h("a", { class: "site-back", href: "/", title: "Retour au site " + brand() }, ico("home"), h("span", null, "Retour au site")),
      h("button", { class: "iconbtn", type: "button", title: "Thème clair / sombre", "aria-label": "Changer de thème", onClick: toggleTheme }, ico("sun")), bell, avatarNode()));
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
  const id = parts[0] || firstAllowed();
  paintNav();
  let node; let title;
  if (id === "trace" && ["listing", "user"].includes(parts[1]) && parts[2]) { node = traceView(ctx, parts[1], decodeURIComponent(parts[2])); title = "Dossier de traçage"; }
  else if (id === "users" && parts[1] && allowed("users")) { node = userCenterView(ctx, decodeURIComponent(parts[1])); title = "Centre d'analyse du compte"; }
  else if (VIEWS[id] && !allowed(id)) { node = h("div", { class: "view" }, empty("Ce module ne vous est pas attribué. Demandez l'accès au propriétaire.", "shield")); title = "Accès réservé"; }
  else if (VIEWS[id]) { node = VIEWS[id](ctx); title = FLAT.find((m) => m.id === id)?.label; }
  else { node = h("div", { class: "view" }, empty("Module introuvable.", "search")); title = "Introuvable"; }
  crumb.textContent = title ?? "Owner Control";
  document.title = `${title ?? "Owner Control"} · ${brand()} Owner Control`;
  content.replaceChildren(node);
  window.scrollTo({ top: 0 });
}

async function start() {
  try {
    const session = await api("/me");
    if (!session.user) return gate("Connexion requise", "Ouvrez une session SUPERADMIN pour accéder au centre de commandement.", h("a", { class: "btn primary", href: "/#/connexion?next=%2Fprofil" }, "Connexion"));
    me = session.meta; ctx.userId = session.user.id;
    access = await api("/staff/owner/access");
    if (!access.all && !access.modules.length) return gate("Accès réservé", "Le Owner Control Center est réservé au propriétaire et aux administrateurs à qui il a attribué des modules.");
    // Photo du compte : celle du profil public (même source que « Mon profil »). Absente = initiales.
    const pub = await api("/me/public-profile").catch(() => null);
    me.avatarUrl = pub?.profile?.avatarUrl || null;
    shell(); window.addEventListener("hashchange", () => { closeMenu(); route(); }); route();
  } catch (e) { gate("Chargement impossible", e.message || "Réessayez dans un instant.", h("button", { class: "btn", type: "button", onClick: () => location.reload() }, "Réessayer")); }
}
function gate(title, text, action) {
  root.className = "boot";
  root.replaceChildren(h("div", { class: "card panel stack gate" }, h("div", { class: "eyebrow" }, "OWNER CONTROL CENTER"), h("h1", null, title), h("p", { class: "muted" }, text), h("div", null, action)));
}
start();
window.addEventListener("error", () => toast("Une erreur d'affichage est survenue.", true));
