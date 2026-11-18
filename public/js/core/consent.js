// Consentement aux services non essentiels. Logique pure (sans DOM) : testable et réutilisable.
// Choix stocké dans localStorage, avec version de la politique et date d'expiration.
// Ce stockage n'est PAS une preuve juridique inviolable : la preuve côté serveur est prévue au lot D.
// Règle : tant qu'aucun choix valide n'existe, toute catégorie optionnelle est refusée.

export const CONSENT_KEY = "ika-so-consent";
export const CONSENT_VERSION = 1; // à incrémenter si la politique change : les choix antérieurs sont alors redemandés
export const CONSENT_DURATION_DAYS = 183; // environ six mois, configurable

export const CONSENT_CATEGORIES = [
  { id: "preferences", label: "Préférences", active: false, description: "Mémorisation de réglages d'affichage." },
  { id: "statistiques", label: "Statistiques", active: true, description: "Mesure d'audience anonyme : les pages vues sont comptées sans identifiant visiteur ni cookie. Sans votre accord, aucune page vue n'est envoyée." },
  { id: "cartes", label: "Cartes et services externes", active: true, description: "Fond de carte Mapbox (société américaine). Pour afficher ce fond, votre navigateur envoie à Mapbox les tuiles demandées, avec votre adresse IP." },
  { id: "marketing", label: "Marketing et publicité", active: false, description: "Publicité ciblée." },
];

const IDS = CONSENT_CATEGORIES.map((c) => c.id);
const DAY_MS = 86_400_000;

function localStore() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Choix valide et non expiré, normalisé. null si aucun choix, version différente, expiré ou illisible. */
export function readConsent({ storage = localStore(), now = Date.now() } = {}) {
  try {
    const raw = storage?.getItem(CONSENT_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record?.version !== CONSENT_VERSION) return null;
    if (!(Date.parse(record.expiresAt) > now)) return null;
    const accepted = Array.isArray(record.accepted) ? record.accepted.filter((id) => IDS.includes(id)) : [];
    return {
      version: CONSENT_VERSION,
      accepted,
      refused: IDS.filter((id) => !accepted.includes(id)),
      decidedAt: record.decidedAt ?? null,
      expiresAt: record.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Vrai seulement si la catégorie a été acceptée par un choix valide. */
export function hasConsent(id, options) {
  return Boolean(readConsent(options)?.accepted.includes(id));
}

/** Enregistre le choix : seules les catégories connues et listées sont retenues ; le reste est refusé. */
export function saveConsent(acceptedIds, { storage = localStore(), now = Date.now(), durationDays = CONSENT_DURATION_DAYS } = {}) {
  const accepted = IDS.filter((id) => Array.isArray(acceptedIds) && acceptedIds.includes(id));
  const record = {
    version: CONSENT_VERSION,
    accepted,
    refused: IDS.filter((id) => !accepted.includes(id)),
    decidedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + durationDays * DAY_MS).toISOString(),
  };
  try { storage?.setItem(CONSENT_KEY, JSON.stringify(record)); } catch { /* stockage refusé : rien n'est accepté, donc tout reste désactivé */ }
  try { globalThis.dispatchEvent?.(new Event("ika-consent")); } catch { /* ignoré */ }
  return record;
}

/** Retire les données posées par la bibliothèque Mapbox dans ce navigateur (identifiant « mapbox.eventData », compteurs). À appeler dès que « Cartes » n'est plus accepté. */
export function clearMapboxStorage(storage = localStore()) {
  try {
    if (!storage) return 0;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) { const k = storage.key(i); if (k && k.startsWith("mapbox")) keys.push(k); }
    keys.forEach((k) => storage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}
