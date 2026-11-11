import { api, fail, h, mount, toast } from "/js/dom.js";
import { S, app, refreshSession } from "/js/core/state.js";
import { currentRoute, go } from "/js/core/router.js";
import { field } from "/js/components/ui.js";

export async function loginPage() {
  if (S.user) return go("/profil");
  const next = currentRoute().params.get("next") || "/";
  let mode = "login";
  const form = { name: "", email: "", password: "", acceptTerms: false };
  function page() {
    const reg = mode === "register";
    mount(app, h("div", { class: "card pad stack" },
      h("h1", { class: "title" }, reg ? "Créer un compte" : "Connexion"),
      h("div", { class: "row", role: "tablist" },
        h("button", { class: `btn btn-small ${!reg ? "btn-dark" : ""}`, type: "button", role: "tab", "aria-selected": String(!reg), onClick: () => { mode = "login"; page(); } }, "Connexion"),
        h("button", { class: `btn btn-small ${reg ? "btn-dark" : ""}`, type: "button", role: "tab", "aria-selected": String(reg), onClick: () => { mode = "register"; page(); } }, "Inscription")),
      h("form", { class: "stack", onSubmit: async (e) => {
        e.preventDefault();
        try {
          await api(reg ? "/auth/register" : "/auth/login", { method: "POST", body: reg ? form : { email: form.email, password: form.password } });
          await refreshSession();
          toast(reg ? "Compte créé." : "Connecté.");
          go(next.startsWith("/") ? next : "/");
        } catch (error) { fail(error); }
      } },
        reg ? field("Nom affiché", h("input", { class: "input", autocomplete: "name", required: true, value: form.name, onInput: (e) => (form.name = e.target.value) })) : null,
        field("Adresse e-mail", h("input", { class: "input", type: "email", autocomplete: "email", required: true, value: form.email, onInput: (e) => (form.email = e.target.value) })),
        field("Mot de passe (8 caractères au moins)", h("input", { class: "input", type: "password", autocomplete: reg ? "new-password" : "current-password", required: true, minlength: "8", value: form.password, onInput: (e) => (form.password = e.target.value) })),
        reg ? h("label", { class: "row small" },
          h("input", { type: "checkbox", required: true, checked: form.acceptTerms, onChange: (e) => (form.acceptTerms = e.target.checked) }),
          h("span", null, "J'accepte les ", h("a", { href: "/conditions", target: "_blank", rel: "noopener" }, "conditions d'utilisation"), " et la ", h("a", { href: "/confidentialite", target: "_blank", rel: "noopener" }, "politique de confidentialité"), " et je confirme avoir 18 ans ou plus.")) : null,
        h("button", { class: "btn btn-primary", type: "submit" }, reg ? "Créer mon compte" : "Me connecter"),
        reg ? null : h("a", { class: "small", href: "#/mot-de-passe-oublie" }, "Mot de passe oublié ?")),
      h("p", { class: "small muted" }, "Votre numéro de téléphone est vérifié par un code SMS au moment de publier.")));
  }
  page();
}

