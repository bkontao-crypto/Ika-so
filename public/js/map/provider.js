// Point unique de choix du fournisseur de carte. Les pages n'appellent QUE createMap() : elles ne savent pas quel fournisseur dessine.
//  - « local » : plan métrique en SVG, aucune ressource externe (toujours disponible, hors connexion compris).
//  - « mapbox » : fond de carte rues / satellite. Utilisé seulement si TOUT est réuni : le serveur donne un jeton public
//    (GET /api/config/map), la bibliothèque hébergée chez nous se charge (public/vendor/mapbox-gl.js + .css) et la carte démarre.
//    Au moindre échec (pas de jeton, hors connexion, fichier absent, jeton refusé, délai) : repli silencieux sur « local ».
let configPromise = null;
let libraryPromise = null;

const mapboxToken = () => (configPromise ??= fetch("/api/config/map", { headers: { Accept: "application/json" } })
  .then((r) => (r.ok ? r.json() : null)).then((c) => c?.mapbox?.token || null).catch(() => null));

function loadLibrary() {
  if (window.mapboxgl) return Promise.resolve(true);
  return (libraryPromise ??= new Promise((resolve) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/mapbox-gl.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "/vendor/mapbox-gl.js";
    const timer = setTimeout(() => resolve(false), 10_000);
    script.onload = () => { clearTimeout(timer); resolve(Boolean(window.mapboxgl)); };
    script.onerror = () => { clearTimeout(timer); css.remove(); resolve(false); };
    document.head.append(script);
  }).then((ok) => { if (!ok) libraryPromise = null; return ok; }));
}

async function createLocal(container, options) {
  const { createLocalMap } = await import("/js/map/local.js");
  return createLocalMap(container, options);
}

export async function createMap(container, options) {
  const token = navigator.onLine === false ? null : await mapboxToken();
  if (token && await loadLibrary()) {
    try {
      const { createMapboxMap } = await import("/js/map/mapbox.js");
      return await createMapboxMap(container, { ...options, token });
    } catch {
      container.replaceChildren();
    }
  }
  return createLocal(container, options);
}

/** Carte d'accueil des annonces. Renvoie l'objet carte, ou null (pas de jeton, hors connexion, erreur) : l'appelant garde alors ses repères simples. */
export async function createListingsMap(container, pins, onOpen) {
  const token = navigator.onLine === false ? null : await mapboxToken();
  if (!token || !(await loadLibrary())) return null;
  try {
    const { createListingsMapbox } = await import("/js/map/mapbox.js");
    return await createListingsMapbox(container, { pins, token, onOpen });
  } catch {
    container.replaceChildren();
    return null;
  }
}
