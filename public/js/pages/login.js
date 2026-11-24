import { api, fail, h, mount, toast } from "/js/dom.js";
import { S, app, refreshSession } from "/js/core/state.js";
import { currentRoute, go } from "/js/core/router.js";
import { field, passwordField } from "/js/components/ui.js";
import { askDataConsent } from "/js/components/data-consent.js";
import { acceptAllConsent } from "/js/core/consent.js";
import { trackConversion } from "/js/core/marketing.js";

// Logo « G » officiel de Google (SVG fixe, sans donnée extérieure), construit sans innerHTML.
const googleLogo = () => new DOMParser().parseFromString(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
  "image/svg+xml").documentElement;

const GOOGLE_NOTES = {
  indisponible: "La connexion avec Google n'est pas disponible pour le moment.",
  conditions: "Acceptez les conditions et les données indispensables pour continuer avec Google.",
  refus: "Connexion Google annulée.",
  etat: "La connexion Google a expiré. Réessayez.",
  "compte-existant": "Ce compte se connecte avec son mot de passe. Connectez-vous ainsi, puis liez Google depuis « Mon profil ».",
  bloque: "Ce compte est bloqué.",
  echec: "La connexion Google a échoué. Réessayez ou utilisez votre mot de passe.",
  "ticket-expire": "Ce lien de connexion a expiré. Recommencez depuis l'application.",
};

export async function loginPage() {
  if (S.user) return go("/profil");
  const next = currentRoute().params.get("next") || "/";
  let mode = "login";
  let googleOn = false;
  const googleNote = GOOGLE_NOTES[currentRoute().params.get("google") ?? ""];
  const form = { name: "", email: "", password: "" };
  function page() {
    const reg = mode === "register";
    mount(app, h("div", { class: "card pad stack" },
      h("h1", { class: "title" }, reg ? "Créer un compte" : "Connexion"),
      googleNote ? h("p", { class: "small", role: "alert" }, googleNote) : null,
      h("div", { class: "row", role: "tablist" },
        h("button", { class: `btn btn-small ${!reg ? "btn-dark" : ""}`, type: "button", role: "tab", "aria-selected": String(!reg), onClick: () => { mode = "login"; page(); } }, "Connexion"),
        h("button", { class: `btn btn-small ${reg ? "btn-dark" : ""}`, type: "button", role: "tab", "aria-selected": String(reg), onClick: () => { mode = "register"; page(); } }, "Inscription")),
      h("form", { class: "stack", onSubmit: async (e) => {
        e.preventDefault();
        try {
          let body = { email: form.email, password: form.password };
          if (reg) {
            const choice = await askDataConsent();
            if (!choice) return toast("Inscription annulée.", true);
            acceptAllConsent(); // « Continuer » = toutes les catégories acceptées sur cet appareil, retirables dans le profil
            body = { ...form, acceptTerms: true, dataConsent: choice };
          }
          await api(reg ? "/auth/register" : "/auth/login", { method: "POST", body });
          await refreshSession();
          if (reg) trackConversion("registration");
          toast(reg ? "Compte créé." : "Connecté.");
          go(next.startsWith("/") ? next : "/");
        } catch (error) { fail(error); }
      } },
        reg ? field("Nom affiché", h("input", { class: "input", autocomplete: "name", required: true, value: form.name, onInput: (e) => (form.name = e.target.value) })) : null,
        field("Adresse e-mail", h("input", { class: "input", type: "email", autocomplete: "email", required: true, value: form.email, onInput: (e) => (form.email = e.target.value) })),
        passwordField("Mot de passe (8 caractères au moins)", h("input", { class: "input", type: "password", autocomplete: reg ? "new-password" : "current-password", required: true, minlength: "8", value: form.password, onInput: (e) => (form.password = e.target.value) })),
        h("div", { class: "auth-actions" },
          h("button", { class: "btn btn-primary", type: "submit" }, reg ? "Créer mon compte" : "Me connecter"),
          reg ? null : h("a", { class: "auth-forgot", href: "#/mot-de-passe-oublie" }, "Mot de passe oublié ?"))),
 googleOn ? h("div", { class: "auth-google" },
        h("div", { class: "auth-sep", role: "separator" }, h("span", null, "ou")),
        h("button", { class: "btn-google", type: "button", onClick: async () => {
          const choice = await askDataConsent();
          if (!choice) return toast("Connexion annulée.", true);
          acceptAllConsent();
          location.href = `/api/auth/google?terms=1&consent=${choice}&next=${encodeURIComponent(next)}`;
        } }, googleLogo(), h("span", null, "Continuer avec Google"))) : null,
      h("p", { class: "small muted" }, "Votre numéro de téléphone est vérifié par un code SMS au moment de publier.")));
  }
  page();
  api("/config/auth").then((c) => { googleOn = Boolean(c?.google); if (googleOn) page(); }).catch(() => undefined);
}
