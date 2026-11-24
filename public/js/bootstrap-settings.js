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
  if (s.colors?.accent) root.style.setProperty("--gold", s.colors.accent);
}

// Masque les éléments portant data-module="crm|map|premium|whatsapp" désactivés.
export function applyModuleFlags(modules) {
  document.querySelectorAll("[data-module]").forEach((el) => {
    const hidden = modules[el.getAttribute("data-module")] === false;
    el.hidden = hidden;
    el.style.display = hidden ? "none" : "";
  });
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
