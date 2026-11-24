// Charge les services « Préférences » et « Marketing » activés par le Super Administrateur, puis les applique.
// Toujours tolérant : si la lecture échoue, tout reste éteint et le site fonctionne comme avant.
import { hasConsent, setActiveServices } from "./consent.js";
import { setPrefsService, prefsService, clearPrefs } from "./prefs.js";
import { setMarketingProviders, watchMarketing } from "./marketing.js";

export async function loadConsentServices(timeoutMs = 2500) {
  let cfg = { preferences: false, marketing: [] };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch("/api/config/consent-services", { credentials: "same-origin", signal: ctl.signal });
    clearTimeout(timer);
    if (res.ok) cfg = await res.json();
  } catch { /* services éteints */ }
  setPrefsService(cfg.preferences === true);
  if (cfg.preferences === true && !hasConsent("preferences")) clearPrefs(); // service actif sans accord : rien ne doit rester mémorisé
  setMarketingProviders(cfg.marketing);
  setActiveServices({ preferences: cfg.preferences === true, marketing: Array.isArray(cfg.marketing) && cfg.marketing.length > 0 });
  watchMarketing();
  return cfg;
}

/** Après un changement de choix dans le panneau : efface les préférences si l'accord est retiré. */
export function onConsentSaved(before, after) {
  const lostPrefs = before.preferences && !after.preferences;
  if (lostPrefs && prefsService()) clearPrefs();
  const lostMarketing = before.marketing && !after.marketing;
  return { reload: lostMarketing };
}
