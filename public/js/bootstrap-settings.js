// Applique au site public les réglages Superadmin « main » : couleurs et modules.
// Réglés dans Owner Center > Personnalisation du site (onglet « Apparence & modules »).
// Chargé par public/js/app.js.

import { api } from "/js/dom.js";
import { readableOn } from "/js/core/contrast.js";

export function applySettings(s) {
  if (!s) return;
  const root = document.documentElement;
  if (s.colors?.primary) {
    root.style.setProperty("--leaf", s.colors.primary);
    // Le texte posé sur la couleur principale (boutons, pastilles) reste lisible en clair comme en sombre, quelle que soit la couleur choisie.
    const on = readableOn(s.colors.primary);
    if (on) root.style.setProperty("--on-leaf", on);
  }
  if (s.colors?.accent) {
    root.style.setProperty("--gold", s.colors.accent);
    const onGold = readableOn(s.colors.accent); // même règle pour le texte posé sur la couleur d'accent
    if (onGold) root.style.setProperty("--on-gold", onGold);
  }
}

// Masque les éléments portant data-module="crm|map|premium|whatsapp" désactivés, ainsi que les liens vers ces modules.
// Simple confort d'affichage : la vraie coupure (CRM, Premium) est faite par le serveur.
const MODULE_LINKS = {
  crm: 'a[href^="/crm-leads"]',
  premium: 'a[href^="#/premium"], a[href^="#/devenir-premium"], a[href*="next=%2Fdevenir-premium"]',
};

export function applyModuleFlags(modules) {
  const off = Object.keys(MODULE_LINKS).filter((k) => modules[k] === false).map((k) => MODULE_LINKS[k]);
  const wanted = new Set(off.length ? document.querySelectorAll(off.join(", ")) : []);
  document.querySelectorAll("[data-module]").forEach((el) => { if (modules[el.getAttribute("data-module")] === false) wanted.add(el); });
  // On ne réaffiche que ce que cette fonction a elle-même masqué.
  document.querySelectorAll("[data-module-off]").forEach((el) => {
    if (!wanted.has(el)) { el.removeAttribute("data-module-off"); el.hidden = false; el.style.display = ""; }
  });
  wanted.forEach((el) => { el.setAttribute("data-module-off", ""); el.hidden = true; el.style.display = "none"; });
}

let currentModules = null;

export async function bootstrapSettings() {
  try {
    const settings = await api("/superadmin-settings/public");
    applySettings(settings);
    if (settings?.modules) {
      currentModules = settings.modules;
      applyModuleFlags(currentModules);
    }
  } catch {
    // silencieux : les réglages sont optionnels
  }
}

// Le routeur rend les pages à la demande : réappliquer les modules à chaque ajout d'éléments.
function watchModules() {
  if (typeof MutationObserver === "undefined") return;
  new MutationObserver(() => { if (currentModules) applyModuleFlags(currentModules); })
    .observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { bootstrapSettings(); watchModules(); });
  } else {
    bootstrapSettings();
    watchModules();
  }
}
