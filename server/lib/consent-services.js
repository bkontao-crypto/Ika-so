// Services soumis au consentement « Préférences » et « Marketing », activables depuis l'Owner center (réglage « consent_services »).
// Rien n'est actif par défaut. Un service Marketing n'est actif que s'il est coché ET que son identifiant est valide.
// Le navigateur ne charge un pixel qu'avec l'accord « Marketing » de l'utilisateur ; la politique de sécurité n'ouvre l'adresse
// d'un prestataire que tant que son service est activé ici.
import { badRequest } from "./errors.js";

export const CONSENT_SERVICES_KEY = "consent_services";

export const MARKETING_PROVIDERS = {
  meta: {
    label: "Pixel Meta (Facebook et Instagram)", hint: "Identifiant du pixel : 15 à 16 chiffres.", idPattern: /^\d{5,20}$/,
    hosts: { script: ["https://connect.facebook.net"], connect: ["https://www.facebook.com", "https://connect.facebook.net"], img: ["https://www.facebook.com"] },
  },
  google: {
    label: "Google Ads / balise Google", hint: "Identifiant de balise : AW-1234567890 ou G-XXXXXXXXXX.", idPattern: /^(AW|G|GT)-[A-Z0-9]{4,20}$/,
    hosts: {
      script: ["https://www.googletagmanager.com"],
      connect: ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://stats.g.doubleclick.net", "https://www.google.com"],
      img: ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.google.com"],
    },
  },
  tiktok: {
    label: "Pixel TikTok", hint: "Identifiant du pixel : lettres et chiffres (ex. C1ABCDEF2GHIJK).", idPattern: /^[A-Z0-9]{8,32}$/,
    hosts: { script: ["https://analytics.tiktok.com"], connect: ["https://analytics.tiktok.com"], img: ["https://analytics.tiktok.com"] },
  },
};

export const DEFAULT_CONSENT_SERVICES = Object.freeze({
  preferences: { enabled: false },
  marketing: Object.fromEntries(Object.keys(MARKETING_PROVIDERS).map((k) => [k, { enabled: false, id: "" }])),
});

/**
 * Normalise le réglage. `strict` (enregistrement par le Super Administrateur) : refus net d'un identifiant invalide sur un service activé.
 * Sinon (lecture), un service au réglage invalide est simplement considéré comme éteint.
 */
export function normalizeConsentServices(raw, { strict = false } = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = { preferences: { enabled: src.preferences?.enabled === true }, marketing: {} };
  for (const [key, p] of Object.entries(MARKETING_PROVIDERS)) {
    const r = src.marketing?.[key] ?? {};
    const id = typeof r.id === "string" ? r.id.trim().toUpperCase().slice(0, 40) : "";
    const wanted = r.enabled === true;
    const valid = p.idPattern.test(id);
    if (strict && wanted && !valid) throw badRequest(`${p.label} : identifiant invalide. ${p.hint}`);
    out.marketing[key] = { enabled: wanted && valid, id: wanted && !valid ? "" : id };
  }
  return out;
}

/** Vue publique (sans authentification) : uniquement ce dont le navigateur a besoin. */
export function publicConsentServices(norm) {
  const n = norm ?? DEFAULT_CONSENT_SERVICES;
  return {
    preferences: n.preferences.enabled === true,
    marketing: Object.entries(n.marketing).filter(([, v]) => v.enabled).map(([provider, v]) => ({ provider, id: v.id })),
  };
}

/** Adresses à ouvrir dans la politique de sécurité : celles des seuls services activés. */
export function consentCspHosts(norm) {
  const hosts = { script: [], connect: [], img: [] };
  for (const [key, v] of Object.entries((norm ?? DEFAULT_CONSENT_SERVICES).marketing)) {
    if (!v.enabled) continue;
    for (const k of Object.keys(hosts)) hosts[k].push(...MARKETING_PROVIDERS[key].hosts[k]);
  }
  return hosts;
}

/** Lecture avec mémoire courte : la politique de sécurité n'interroge pas la base à chaque requête. */
export function createConsentServicesReader(superadminSettings, ttlMs = 30_000) {
  let cache = null; let at = 0;
  return {
    async get() {
      if (cache && Date.now() - at < ttlMs) return cache;
      try { cache = normalizeConsentServices(await superadminSettings.get(CONSENT_SERVICES_KEY)); } catch { cache = cache ?? normalizeConsentServices(null); }
      at = Date.now();
      return cache;
    },
    invalidate() { cache = null; at = 0; },
  };
}
