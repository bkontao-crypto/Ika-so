// Point d'entrée : routeur à chargement différé (chaque page n'est téléchargée qu'à sa première visite).
import { api, h, loadPlaces, mount, replaceTextIn } from "/js/dom.js";
import { app, onSession, refreshSession, refreshUnread } from "/js/core/state.js";
import { currentRoute } from "/js/core/router.js";
import { renderChrome, trackNav } from "/js/components/chrome.js";
import { startDecorating } from "/js/decorate.js";

// Chaque route : fichier de la page, fonction à lancer, et façon de lire l'identifiant dans l'adresse.
const dec = (m) => decodeURIComponent(m[1]);
const routes = [
  [/^\/reclamations$/, "complaints", "complaintsPage"],
  [/^\/$/, "home", "homePage"],
  [/^\/annonces$/, "home", "annoncesPage"],
  [/^\/partenaires$/, "partners", "partnersPage"],
  [/^\/annonceurs$/, "annonceurs", "annonceursPage"],
  [/^\/centre$/, "centre", "centrePage"],
  [/^\/devenir-annonceur$/, "advertiser-apply", "advertiserApplyPage"],
  [/^\/premium$/, "premium", "premiumPage"],
  [/^\/annonce\/([^/]+)$/, "listing", "listingPage", dec],
  [/^\/publier$/, "publish", "publishPage"],
  [/^\/modifier\/([^/]+)$/, "publish", "editPage", dec],
  [/^\/mes-annonces$/, "account", "minePage"],
  [/^\/localiser\/([^/]+)$/, "localisation", "localisationPage", dec],
  [/^\/carte$/, "localisation", "cartePage"],
  [/^\/favoris$/, "account", "favoritesPage"],
  [/^\/profil$/, "mon-profil", "profilePage"],
  [/^\/connexion$/, "login", "loginPage"],
  [/^\/mot-de-passe-oublie$/, "password-reset", "passwordResetPage"],
  [/^\/annonceur\/([^/]+)$/, "advertiser", "advertiserPage", dec],
  [/^\/mon-profil-public$/, "profile-edit", "profileEditPage"],
  [/^\/confiance$/, "trust", "trustPage"],
  [/^\/agence$/, "agency", "agencyPage"],
  [/^\/paiements$/, "payments", "paymentsPage"],
  [/^\/boite$/, "inbox", "inboxPage"],
  [/^\/boite\/([^/]+)$/, "inbox", "threadPage", dec],
];

let sequence = 0; // numéro de la navigation en cours : une page arrivée trop tard ne doit pas écraser la bonne

async function render() {
  const { path } = currentRoute();
  trackNav();
  renderChrome();
  api("/e", { method: "POST", body: { pagePath: path } }).catch(() => undefined);
  document.body.classList.remove("in-chat");
  const mine = ++sequence;
  const hit = routes.map(([re, file, name, arg]) => [re.exec(path), file, name, arg]).find(([m]) => m);
  mount(app, h("div", { class: "skeleton" }));
  try {
    if (hit) {
      const mod = await import(`/js/pages/${hit[1]}.js`);
      if (mine !== sequence) return; // l'utilisateur est déjà ailleurs
      await mod[hit[2]](hit[3] ? hit[3](hit[0]) : undefined);
    }
    else mount(app, h("div", { class: "card empty" }, h("h1", { class: "title" }, "Page introuvable"), h("p", null, h("a", { href: "#/" }, "Retour à l'accueil"))));
  } catch (error) {
    if (error?.stale || mine !== sequence) return; // l'utilisateur a changé de page entre-temps
    mount(app, h("div", { class: "card pad" }, h("p", null, error instanceof Error ? error.message : "Erreur."), h("p", null, h("a", { href: "#/" }, "Retour à l'accueil"))));
  }
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  refreshUnread(); // le compteur de la boîte se met à jour à chaque page
}

// Suivi d'erreurs côté navigateur : message et lieu seulement (ni adresse IP, ni contenu de page, ni données du compte).
let reported = 0;
function report(message, source) {
  if (reported++ >= 5) return; // au plus 5 par page vue
  api("/client-error", { method: "POST", body: { message: String(message).slice(0, 300), source: String(source ?? "").slice(0, 200), page: location.hash.slice(0, 80) } }).catch(() => undefined);
}
window.addEventListener("error", (e) => report(e.message, `${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => report(e.reason?.message ?? e.reason, "promesse"));

// Hors connexion léger : le site garde ses fichiers et les dernières annonces vues (voir /sw.js).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
window.addEventListener("online", () => { renderChrome(); refreshUnread(); });
window.addEventListener("offline", () => renderChrome());

document.getElementById("year").textContent = String(new Date().getFullYear());

// Appliquer le nom de plateforme défini dans Owner Control
api("/platform-settings").then((s) => {
  if (!s?.platformName) return;
  document.title = `${s.platformName} | Immobilier`;
  const logo = document.querySelector(".brand-logo");
  if (logo) logo.alt = s.platformName;
  const foot = document.querySelector(".foot-copy");
  if (foot) replaceTextIn(foot, "IKA SO Immobilier", s.platformName); // texte seulement : le nom vient d'un réglage modifiable
}).catch(() => undefined);

startDecorating();

// Recherche rapide du header modernisé
document.getElementById("quickSearch")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("quickSearchInput")?.value.trim();
  if (q) location.hash = "#/annonces?q=" + encodeURIComponent(q);
});
 // icônes devant les libellés (voir decorate.js)
onSession(renderChrome);
window.addEventListener("hashchange", render);
// Les listes de quartiers et de pays sont lues avant le premier affichage (les formulaires et filtres en dépendent).
Promise.all([loadPlaces(), refreshSession().then(refreshUnread).catch(() => undefined)]).finally(render);
