// Aides d'interface sans dépendance. Tout texte passe par textContent : aucune injection de HTML possible.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && value && typeof value === "object") { for (const [name, styleValue] of Object.entries(value)) el.style.setProperty(name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), String(styleValue)); }
    // Style en texte : passe par cssText (autorisé), car setAttribute("style") est bloqué par la politique de sécurité (style-src 'self').
    else if (key === "style" && typeof value === "string") el.style.cssText = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value" || key === "checked" || key === "disabled" || key === "selected") el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  const add = (child) => {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach(add);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return el;
}

export const mount = (root, ...nodes) => root.replaceChildren(...nodes.flat().filter(Boolean));

/**
 * Remplace un texte DANS les nœuds texte d'un élément (jamais de HTML interprété : `to` reste du texte).
 * split/join plutôt que replace() : les motifs spéciaux (« $& », « $1 ») d'un nom saisi ne sont pas interprétés.
 */
export function replaceTextIn(root, from, to) {
  if (!root || !from) return;
  for (const node of Array.from(root.childNodes ?? [])) {
    if (node.nodeType === 3) { if (node.nodeValue.includes(from)) node.nodeValue = node.nodeValue.split(from).join(String(to)); }
    else if (node.nodeType === 1) replaceTextIn(node, from, to);
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Appel JSON vers notre serveur. Le cookie de session suit automatiquement (même origine). */
/** Réponse arrivée après un changement de page : on l'ignore pour ne pas écraser la page affichée. */
export class StaleError extends Error {
  constructor() { super("réponse périmée"); this.stale = true; }
}

export async function api(path, { method = "GET", body } = {}) {
  const startedOn = location.hash;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Pas de connexion. Réessayez dans un instant.");
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* réponse vide */
  }
  // Lecture lancée depuis une page que l'utilisateur a déjà quittée : on abandonne (les écritures vont toujours à leur terme).
  if (method === "GET" && path !== "/me" && path !== "/me/unread" && location.hash.split("?")[0] !== startedOn.split("?")[0]) throw new StaleError();
  if (!response.ok) throw new ApiError(response.status, data?.error ?? "Une erreur est survenue.");
  return data;
}

export function toast(message, isError = false) {
  let zone = document.querySelector(".toast-zone");
  if (!zone) {
    zone = h("div", { class: "toast-zone", role: "status", "aria-live": "polite" });
    document.body.append(zone);
  }
  const node = h("div", { class: `toast${isError ? " is-error" : ""}` }, message);
  zone.append(node);
  setTimeout(() => node.remove(), 4200);
}

export const fail = (error) => { if (!error?.stale) toast(error instanceof Error ? error.message : "Action refusée.", true); };

export const formatPrice = (amount, transaction) => {
  const base = `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
  return transaction === "Location" ? `${base} / mois` : base;
};

export const formatDate = (iso) => {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
};

export const daysLeft = (iso) => {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86_400_000) : null;
};

export const digits = (value) => String(value).replace(/\D/g, "");

/** Réduit une photo à 1200 px et l'encode en JPEG léger, dans le navigateur, avant tout envoi. */
export async function compressPhoto(file, maxBytes = 450_000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.75, 0.6, 0.45]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) break;
    const url = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    if (url.length < maxBytes) return url;
  }
  throw new Error("Photo encore trop lourde après compression. Choisissez-en une plus légère.");
}

// Quartiers et pays : valeurs d'origine, remplacées au démarrage par celles du serveur (voir loadPlaces) ; le Superadmin les complète dans Owner Control.
// Les tableaux sont modifiés en place : toutes les pages qui les importent voient la liste à jour.
export const COUNTRIES = [{ code: "ML", name: "Mali" }];
export const ZONES = [
  { name: "ACI 2000", lat: 12.616, lng: -8.024 },
  { name: "Badalabougou", lat: 12.612, lng: -7.986 },
  { name: "Korofina", lat: 12.662, lng: -7.992 },
  { name: "Hamdallaye", lat: 12.649, lng: -8.016 },
  { name: "Yirimadio", lat: 12.608, lng: -7.958 },
  { name: "Bacodjicoroni", lat: 12.582, lng: -8.018 },
  { name: "Sébénikoro", lat: 12.574, lng: -8.078 },
  { name: "Kalaban Coura", lat: 12.578, lng: -7.978 },
  { name: "Sotuba", lat: 12.648, lng: -7.928 },
  { name: "Kati", lat: 12.745, lng: -8.072 },
].map((z) => ({ ...z, country: "ML" }));
/** Charge les pays et quartiers actifs. Échec (hors connexion, ancien serveur) : on garde les valeurs d'origine. */
export async function loadPlaces() {
  try {
    const data = await api("/places");
    if (!Array.isArray(data?.countries) || !data.countries.length || !Array.isArray(data.zones)) return;
    COUNTRIES.splice(0, COUNTRIES.length, ...data.countries.map((c) => ({ code: c.code, name: c.name })));
    ZONES.splice(0, ZONES.length, ...data.zones.map((z) => ({ name: z.name, lat: z.lat, lng: z.lng, country: z.countryCode })));
  } catch { /* valeurs d'origine */ }
}
/** Quartiers d'un pays (tous si aucun pays donné). */
export const zonesOf = (country) => ZONES.filter((z) => !country || z.country === country);
export const PHOTO_PRESETS = [
  { label: "Terrain viabilisé", url: "/media/terrain-aci.jpg" },
  { label: "Villa", url: "/media/villa-badala.jpg" },
  { label: "Appartement", url: "/media/appart-hamdallaye.jpg" },
  { label: "Parcelle de quartier", url: "/media/terrain-yiri.jpg" },
];
export const CATEGORIES = ["Terrain", "Maison", "Appartement", "Studio", "Local commercial", "Bureau"];
export const isLand = (c) => c === "Terrain";
export const isDwelling = (c) => ["Maison", "Appartement", "Studio"].includes(c);
export const isProfessional = (c) => c === "Local commercial" || c === "Bureau";
export const TRANSACTIONS = ["Vente", "Location"];
export const DOCUMENTS = ["Titre Foncier", "Lettre d'attribution", "Permis d'occuper", "Bail", "En cours de régularisation"];
export const ROAD_ACCESS = ["Goudronné", "Piste", "Enclavé"];
export const OWNER_ROLES = ["Propriétaire direct", "Agence immobilière", "Démarcheur mandaté"];
export const REPORT_REASONS = [
  "Bien déjà vendu ou loué",
  "Prix ou superficie inexacte",
  "Suspicion de fraude ou fausse annonce",
  "Doublon",
  "Autre raison",
];
export const DOCUMENT_DISCLAIMER =
  "Document déclaré par l'annonceur, sans garantie automatique. Ika So ne certifie pas le titre.";

/** Prépare un justificatif : photo réduite dans le téléphone, ou PDF léger (600 Ko au plus). Renvoie une « data URL ». */
export async function readProofFile(file) {
  if (file.type.startsWith("image/")) return compressPhoto(file);
  if (file.type !== "application/pdf") throw new Error("Envoyez une photo ou un PDF.");
  if (file.size > 600 * 1024) throw new Error("PDF trop lourd (600 Ko au plus). Envoyez plutôt une photo.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}
