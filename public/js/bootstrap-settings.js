// Bootstrap des réglages Superadmin (E09)
// À importer dans le point d'entrée principal (app.js ou index.html).

import { api } from "/js/dom.js";
import { applySettings } from "/js/pages/admin-settings.js";

export async function bootstrapSettings() {
  try {
    const settings = await api("/superadmin-settings/public");
    if (settings) {
      applySettings(settings);
      applyModuleFlags(settings.modules || {});
    }
  } catch {
    // silencieux : les réglages sont optionnels
  }
}

export function applyModuleFlags(modules) {
  // Masque les éléments portant data-module="crm|map|premium|whatsapp"
  document.querySelectorAll("[data-module]").forEach(el => {
    const mod = el.getAttribute("data-module");
    if (modules[mod] === false) {
      el.hidden = true;
      el.style.display = "none";
    } else {
      el.hidden = false;
      el.style.display = "";
    }
  });
}

// Auto-exécution si chargé en module classique
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapSettings);
  } else {
    bootstrapSettings();
  }
}
