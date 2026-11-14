// Page d'édition des réglages Superadmin (E09)
import { api, h, mount, fail, toast } from "/js/dom.js";

const DEFAULTS = {
  welcome_title: "Bienvenue sur Ika So",
  welcome_subtitle: "Annonces immobilières vérifiées à Bamako et au Mali",
  modules: { crm: true, map: true, premium: true, whatsapp: false },
  colors: { primary: "#1a7f4b", accent: "#c9a227" },
};

export async function adminSettingsPage() {
  const root = h("section", { class: "stack", style: "display:grid;gap:16px;max-width:720px;margin:0 auto" },
    h("h1", { class: "title" }, "Personnalisation Superadmin"),
    h("p", { class: "muted small" }, "Textes, modules et couleurs.")
  );

  let current = { ...DEFAULTS };
  try {
    const all = await api("/staff/superadmin-settings");
    current = { ...DEFAULTS, ...all };
  } catch (e) { fail(e); }

  const form = h("form", { class: "card stack", style: "display:grid;gap:12px", onSubmit: save },
    h("h3", null, "Textes d'accueil"),
    h("label", null, "Titre", h("input", { name: "welcome_title", value: current.welcome_title || "" })),
    h("label", null, "Sous-titre", h("input", { name: "welcome_subtitle", value: current.welcome_subtitle || "" })),

    h("h3", null, "Modules"),
    h("label", null, h("input", { type: "checkbox", name: "mod_crm", checked: current.modules?.crm !== false }), " CRM"),
    h("label", null, h("input", { type: "checkbox", name: "mod_map", checked: current.modules?.map !== false }), " Carte"),
    h("label", null, h("input", { type: "checkbox", name: "mod_premium", checked: current.modules?.premium !== false }), " Premium"),
    h("label", null, h("input", { type: "checkbox", name: "mod_whatsapp", checked: !!current.modules?.whatsapp }), " WhatsApp Business"),

    h("h3", null, "Couleurs"),
    h("label", null, "Primaire ", h("input", { type: "color", name: "color_primary", value: current.colors?.primary || "#1a7f4b" })),
    h("label", null, "Accent ", h("input", { type: "color", name: "color_accent", value: current.colors?.accent || "#c9a227" })),

    h("button", { class: "btn", type: "submit" }, "Enregistrer"),
    h("p", { class: "small muted" }, "Les couleurs sont prévisualisées en direct.")
  );

  // Prévisualisation en direct
  form.querySelector("[name=color_primary]")?.addEventListener("input", (ev) => {
    document.documentElement.style.setProperty("--leaf", ev.target.value);
  });
  form.querySelector("[name=color_accent]")?.addEventListener("input", (ev) => {
    document.documentElement.style.setProperty("--gold", ev.target.value);
  });
  form.querySelector("[name=welcome_title]")?.addEventListener("input", (ev) => {
    document.querySelectorAll("[data-welcome-title]").forEach(el => el.textContent = ev.target.value);
  });
  form.querySelector("[name=welcome_subtitle]")?.addEventListener("input", (ev) => {
    document.querySelectorAll("[data-welcome-subtitle]").forEach(el => el.textContent = ev.target.value);
  });

  async function save(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const payload = {
      welcome_title: fd.get("welcome_title"),
      welcome_subtitle: fd.get("welcome_subtitle"),
      modules: {
        crm: fd.get("mod_crm") === "on",
        map: fd.get("mod_map") === "on",
        premium: fd.get("mod_premium") === "on",
        whatsapp: fd.get("mod_whatsapp") === "on",
      },
      colors: {
        primary: fd.get("color_primary"),
        accent: fd.get("color_accent"),
      },
    };
    try {
      await api("/staff/superadmin-settings/main", { method: "PUT", body: { value: payload } });
      toast("Réglages enregistrés");
      applySettings(payload);
    } catch (e) { fail(e); }
  }

  root.append(form);
  const app = document.getElementById("app") || document.querySelector("main") || document.body;
  mount(app, root);
  applySettings(current);
}

export function applySettings(s) {
  if (!s) return;
  const root = document.documentElement;
  if (s.colors?.primary) root.style.setProperty("--leaf", s.colors.primary);
  if (s.colors?.accent) root.style.setProperty("--gold", s.colors.accent);
  // Textes : à brancher sur les éléments de la homepage si présents
  const title = document.querySelector("[data-welcome-title]");
  const sub = document.querySelector("[data-welcome-subtitle]");
  if (title && s.welcome_title) title.textContent = s.welcome_title;
  if (sub && s.welcome_subtitle) sub.textContent = s.welcome_subtitle;
}
