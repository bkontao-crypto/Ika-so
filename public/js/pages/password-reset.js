// Mot de passe oublié : (1) demander un lien par e-mail, (2) choisir un nouveau mot de passe avec le lien reçu (#/mot-de-passe-oublie?token=…).
import { api, fail, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { currentRoute, go } from "/js/core/router.js";
import { field } from "/js/components/ui.js";

export async function passwordResetPage() {
  if (S.user) return go("/profil");
  const token = currentRoute().params.get("token") || "";
  token ? resetForm(token) : requestForm();
}

function requestForm() {
  let email = "";
  const back = h("a", { href: "#/connexion" }, "← Retour à la connexion");
  const draw = (sent) => mount(app, h("div", { class: "card pad stack" },
    h("h1", { class: "title" }, "Mot de passe oublié"),
    sent
      ? h("div", { class: "stack" },
          h("p", { role: "status" }, "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé (valable 30 minutes). Pensez à regarder dans vos courriers indésirables."),
          h("p", { class: "small muted" }, "Pas de message ? Si votre numéro est vérifié par SMS, le lien peut arriver par SMS. Sinon, contactez l'équipe Ika So."))
      : h("form", { class: "stack", onSubmit: async (e) => {
          e.preventDefault();
          try { await api("/auth/forgot", { method: "POST", body: { email } }); draw(true); } catch (error) { fail(error); }
        } },
          h("p", { class: "small muted" }, "Indiquez l'adresse e-mail de votre compte. Nous vous envoyons un lien pour choisir un nouveau mot de passe."),
          field("Adresse e-mail", h("input", { class: "input", type: "email", autocomplete: "email", required: true, value: email, onInput: (e) => (email = e.target.value) })),
          h("button", { class: "btn btn-primary", type: "submit" }, "Envoyer le lien")),
    h("p", null, back)));
  draw(false);
}

function resetForm(token) {
  const f = { password: "", confirm: "" };
  mount(app, h("div", { class: "card pad stack" },
    h("h1", { class: "title" }, "Nouveau mot de passe"),
    h("form", { class: "stack", onSubmit: async (e) => {
      e.preventDefault();
      if (f.password !== f.confirm) { fail(new Error("Les deux mots de passe ne sont pas identiques.")); return; }
      try {
        await api("/auth/reset", { method: "POST", body: { token, password: f.password } });
        toast("Mot de passe modifié. Connectez-vous avec le nouveau.");
        go("/connexion");
      } catch (error) { fail(error); }
    } },
      field("Nouveau mot de passe (8 caractères au moins)", h("input", { class: "input", type: "password", autocomplete: "new-password", required: true, minlength: "8", onInput: (e) => (f.password = e.target.value) })),
      field("Confirmer le mot de passe", h("input", { class: "input", type: "password", autocomplete: "new-password", required: true, minlength: "8", onInput: (e) => (f.confirm = e.target.value) })),
      h("button", { class: "btn btn-primary", type: "submit" }, "Enregistrer le mot de passe")),
    h("p", { class: "small muted" }, "Pour votre sécurité, vous serez déconnecté de tous vos appareils.")));
}
