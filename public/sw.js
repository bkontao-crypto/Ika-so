// Mode hors connexion léger. Règles :
//  - fichiers du site : servis depuis la mémoire de l'appareil, remis à jour en arrière-plan ;
//  - annonces publiques (lecture) : réseau d'abord, dernière version connue si la connexion tombe ;
//  - tout le reste de /api (compte, messages, contact, administration) : jamais gardé, jamais servi hors ligne.
const VERSION = "ika-so-8a291ed21a";
const SHELL = [
  "/", "/css/ika.css", "/css/modern.css", "/css/refonte.css", "/css/mon-profil.css", "/css/publier.css", "/js/pages/mon-profil.js", "/media/logo-ika-so.webp", "/js/pages/partners.js", "/js/pages/annonceurs.js", "/js/pages/centre.js", "/js/pages/centre-standard.js", "/js/pages/premium.js", "/js/components/espace.js", "/css/espace.css", "/css/profil.css", "/favicon.svg", "/icon-192.png", "/manifest.webmanifest",
  "/js/app.js", "/js/dom.js", "/js/icons.js", "/js/icon-rules.js", "/js/decorate.js", "/js/core/state.js", "/js/core/router.js",
  "/js/components/chrome.js", "/js/components/ui.js", "/js/components/listing-card.js", "/js/components/listing-form.js",
  "/js/pages/home.js", "/js/pages/listing.js", "/js/pages/login.js", "/js/pages/publish.js", "/js/pages/account.js", "/js/pages/trust.js", "/js/pages/advertiser.js", "/js/pages/profile-edit.js", "/js/components/stars.js", "/js/components/chat.js", "/js/pages/inbox.js", "/js/pages/agency.js", "/js/pages/payments.js", "/js/pages/localisation.js", "/js/pages/complaints.js", "/js/pages/advertiser-apply.js", "/js/map/provider.js", "/js/map/local.js", "/js/map/mapbox.js", "/js/map/geometry.js", "/js/fiche.js", "/css/fiche.css",
];
const NETWORK_FIRST = new Set(["/css/seo.css", "/js/seo-theme.js", "/owner.html"]);
const PUBLIC_READS = [/^\/api\/places$/, /^\/api\/listings(\?.*)?$/, /^\/api\/listings\/[^/]+$/, /^\/api\/listings\/[^/]+\/similar$/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = url.pathname + url.search;
  if (url.pathname.startsWith("/api/")) {
    if (!PUBLIC_READS.some((re) => re.test(path))) return; // réseau seulement, rien en mémoire
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname === "/admin.html" || url.pathname === "/js/admin.js") return; // centre de contrôle : toujours en ligne
  // Pages (accueil, quartiers, agences, guides, annonces…) et feuille de style des pages serveur : réseau d'abord,
  // jamais l'ancienne version tant que la connexion fonctionne (une page ancienne avec une feuille neuve — ou l'inverse — devenait illisible).
  if (request.mode === "navigate" || NETWORK_FIRST.has(url.pathname)) { event.respondWith(networkFirstPage(request)); return; }
  // Fichier versionné (?v=empreinte) : l'adresse change avec le contenu, donc la copie exacte est toujours la bonne.
  if (url.searchParams.has("v")) { event.respondWith(versionedAsset(request)); return; }
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) ?? new Response(JSON.stringify({ error: "Hors connexion : cette page n'a pas été enregistrée." }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? new Response("Hors connexion", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function versionedAsset(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request); // adresse exacte, empreinte comprise
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return cached ?? (await refresh) ?? new Response("Hors connexion", { status: 503 });
}
