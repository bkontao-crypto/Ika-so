// Service « Marketing et publicité » : pixels Meta, Google et TikTok.
// Chargés UNIQUEMENT si (1) le Super Administrateur a activé le prestataire avec son identifiant et (2) l'utilisateur a accepté « Marketing ».
// Le code du prestataire est téléchargé à ce moment seulement. Un retrait de l'accord recharge la page : plus rien n'est chargé.
import { hasConsent } from "./consent.js";

let providers = [];
const started = new Set();

export function setMarketingProviders(list) { providers = Array.isArray(list) ? list : []; }
export const marketingProviders = () => providers;

function addScript(src) {
  const s = document.createElement("script");
  s.async = true; s.src = src;
  document.head.append(s);
}

const LOADERS = {
  meta(id) {
    if (window.fbq) return;
    const n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", id);
    window.fbq("track", "PageView");
  },
  google(id) {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  },
  tiktok(id) {
    const name = "ttq";
    window.TiktokAnalyticsObject = name;
    const q = (window[name] = window[name] || []);
    q.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    q.setAndDefer = (t, e) => { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (const m of q.methods) q.setAndDefer(q, m);
    q.instance = (t) => { const e = (q._i && q._i[t]) || []; for (const m of q.methods) q.setAndDefer(e, m); return e; };
    q.load = (e, o) => {
      q._i = q._i || {}; q._i[e] = []; q._i[e]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
      q._t = q._t || {}; q._t[e] = +new Date(); q._o = q._o || {}; q._o[e] = o || {};
      addScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(e)}&lib=${name}`);
    };
    q.load(id);
    q.page();
  },
};

/** Page vue suivante (le site change de page sans rechargement). */
const PAGE = {
  meta: () => window.fbq?.("track", "PageView"),
  google: () => window.gtag?.("event", "page_view", { page_path: location.hash || "/" }),
  tiktok: () => window.ttq?.page?.(),
};

/** Événement de conversion : « registration » (inscription). Sans effet si rien n'est chargé. */
const CONVERSION = {
  registration: {
    meta: () => window.fbq?.("track", "CompleteRegistration"),
    google: () => window.gtag?.("event", "sign_up"),
    tiktok: () => window.ttq?.track?.("CompleteRegistration"),
  },
};
export function trackConversion(name) {
  for (const p of providers) if (started.has(p.provider)) { try { CONVERSION[name]?.[p.provider]?.(); } catch { /* la mesure ne casse jamais la page */ } }
}

/** Charge les prestataires activés si « Marketing » est accepté. Idempotent. */
export function applyMarketing() {
  if (!hasConsent("marketing")) return 0;
  for (const p of providers) {
    if (started.has(p.provider) || !LOADERS[p.provider] || !p.id) continue;
    try { LOADERS[p.provider](p.id); started.add(p.provider); } catch { /* un prestataire en échec ne bloque pas le site */ }
  }
  return started.size;
}

export const marketingLoaded = () => started.size > 0;

export function watchMarketing() {
  window.addEventListener("ika-consent", () => applyMarketing());
  window.addEventListener("hashchange", () => {
    for (const p of providers) if (started.has(p.provider)) { try { PAGE[p.provider]?.(); } catch { /* ignoré */ } }
  });
  applyMarketing();
}
