// Vérification en deux étapes (#/verification) : saisie du code de l'appli ou d'un code de secours après le mot de passe.
// Le serveur garde la session « en attente » : sans ce code, le compte n'est pas connecté (voir /api/mfa/*).
import { api, fail, h, mount, toast } from "/js/dom.js";
import { app, clearSession, refreshSession } from "/js/core/state.js";
import { currentRoute, go } from "/js/core/router.js";
import { field } from "/js/components/ui.js";

export async function mfaLoginPage() {
  const next = currentRoute().params.get("next") || "/";
  const { pending } = await api("/mfa/pending").catch(() => ({ pending: false }));
  if (!pending) return go("/connexion"); // rien à vérifier : session absente ou déjà complète
  let code = "";
  let busy = false;
  mount(app, h("div", { class: "card pad stack" },
    h("h1", { class: "title" }, "Vérification en deux étapes"),
    h("p", { class: "muted" }, "Saisissez le code à 6 chiffres affiché par votre application d'authentification, ou l'un de vos codes de secours."),
    h("form", { class: "stack", onSubmit: async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      try {
        await api("/mfa/login", { method: "POST", body: { code } });
        await refreshSession();
        toast("Connecté.");
        go(next.startsWith("/") ? next : "/");
      } catch (error) { fail(error); } finally { busy = false; }
    } },
      field("Code de vérification", h("input", { class: "input", name: "code", autocomplete: "one-time-code", autocapitalize: "characters", spellcheck: "false", required: true, maxlength: "20", onInput: (e) => (code = e.target.value) })),
      h("div", { class: "auth-actions" },
        h("button", { class: "btn btn-primary", type: "submit" }, "Valider"),
        h("button", { class: "btn", type: "button", onClick: async () => {
          try { await api("/mfa/cancel", { method: "POST", body: {} }); } catch (error) { fail(error); return; }
          clearSession();
          go("/connexion");
        } }, "Abandonner"))),
    h("p", { class: "small muted" }, "Après 5 codes faux, la vérification est bloquée 15 minutes.")));
  app.querySelector("input[name=code]")?.focus();
}
