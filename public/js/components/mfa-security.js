// Carte « Double authentification » du profil : activation (clé à saisir ou lien vers l'appli), codes de secours (affichés une seule fois),
// renouvellement et désactivation. Aucune donnée inventée : tout vient de /api/mfa/*. Pas de QR code (aucune bibliothèque tierce) : clé + lien otpauth.
import { api, fail, h, toast } from "/js/dom.js";
import { field } from "/js/components/ui.js";

const spaced = (secret) => String(secret).replace(/(.{4})/g, "$1 ").trim();

export function mfaSecurityCard() {
  const card = h("article", { class: "card pad stack", "aria-live": "polite" });
  let view = { step: "loading" };
  const show = (next) => { view = next; draw(); };
  const refresh = async () => {
    try { show({ step: "status", status: await api("/mfa/status") }); }
    catch (error) { show({ step: "error", message: error?.message ?? "Indisponible." }); }
  };

  const codeInput = (name, onInput) => field("Code à 6 chiffres (ou code de secours)", h("input", { class: "input", name, autocomplete: "one-time-code", autocapitalize: "characters", spellcheck: "false", required: true, maxlength: "20", onInput: (e) => onInput(e.target.value) }));

  function codesList(codes) {
    return h("div", { class: "stack" },
      h("p", { role: "alert" }, "Notez ces codes de secours maintenant : ils ne seront plus jamais affichés. Chacun ne sert qu'une fois."),
      h("pre", { class: "input", style: "white-space:pre-wrap;user-select:all" }, codes.join("\n")),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onClick: async () => { try { await navigator.clipboard.writeText(codes.join("\n")); toast("Codes copiés."); } catch { toast("Copie impossible : recopiez-les à la main.", true); } } }, "Copier"),
        h("button", { class: "btn btn-primary", type: "button", onClick: refresh }, "J'ai noté mes codes")));
  }

  function codeForm(label, danger, action) {
    let code = "";
    return h("form", { class: "stack", onSubmit: async (e) => { e.preventDefault(); try { await action(code); } catch (error) { fail(error); } } },
      codeInput("code", (v) => (code = v)),
      h("div", { class: "row" },
        h("button", { class: `btn ${danger ? "btn-dark" : "btn-primary"}`, type: "submit" }, label),
        h("button", { class: "btn", type: "button", onClick: refresh }, "Annuler")));
  }

  function draw() {
    const body = [h("p", { class: "small muted" }, "Sécurité"), h("h2", null, "Double authentification")];
    if (view.step === "loading") body.push(h("p", { class: "muted" }, "Chargement…"));
    else if (view.step === "error") body.push(h("p", { class: "muted" }, view.message), h("button", { class: "btn", type: "button", onClick: refresh }, "Réessayer"));
    else if (view.step === "codes") body.push(codesList(view.codes));
    else if (view.step === "setup") {
      let code = "";
      body.push(
        h("p", null, "1. Dans votre application d'authentification, ajoutez un compte avec cette clé :"),
        h("pre", { class: "input", style: "white-space:pre-wrap;user-select:all", "aria-label": "Clé secrète" }, spaced(view.secret)),
        h("a", { class: "btn", href: view.otpauthUri }, "Ouvrir dans mon application"),
        h("p", null, "2. Saisissez le code à 6 chiffres qu'elle affiche :"),
        h("form", { class: "stack", onSubmit: async (e) => {
          e.preventDefault();
          try { const r = await api("/mfa/confirm", { method: "POST", body: { code } }); toast("Double authentification activée."); show({ step: "codes", codes: r.backupCodes }); } catch (error) { fail(error); }
        } },
          codeInput("code", (v) => (code = v)),
          h("div", { class: "row" }, h("button", { class: "btn btn-primary", type: "submit" }, "Activer"), h("button", { class: "btn", type: "button", onClick: refresh }, "Annuler"))));
    } else if (view.step === "regenerate") {
      body.push(h("p", { class: "small" }, "Les anciens codes de secours cesseront de fonctionner."),
        codeForm("Renouveler mes codes", false, async (code) => { const r = await api("/mfa/backup-codes", { method: "POST", body: { code } }); show({ step: "codes", codes: r.backupCodes }); }));
    } else if (view.step === "disable") {
      body.push(h("p", { class: "small" }, "Votre compte ne sera plus protégé que par le mot de passe."),
        codeForm("Désactiver", true, async (code) => { await api("/mfa/disable", { method: "POST", body: { code } }); toast("Double authentification désactivée."); await refresh(); }));
    } else {
      const s = view.status;
      if (s.enabled) {
        body.push(h("p", null, h("span", { class: "pill pill-green" }, "Activée")),
          h("p", { class: "small muted" }, `Codes de secours restants : ${s.backupCodesLeft}.${s.backupCodesLeft <= 2 ? " Pensez à les renouveler." : ""}`),
          h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onClick: () => show({ step: "regenerate" }) }, "Renouveler les codes de secours"),
            h("button", { class: "btn", type: "button", onClick: () => show({ step: "disable" }) }, "Désactiver")));
      } else {
        body.push(h("p", { class: "small muted" }, "Ajoute un code à usage unique, généré par une application d'authentification, à chaque connexion. Recommandé pour protéger votre compte."),
          h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
            try { const r = await api("/mfa/begin", { method: "POST", body: {} }); show({ step: "setup", secret: r.secret, otpauthUri: r.otpauthUri }); } catch (error) { fail(error); }
          } }, "Activer la double authentification"));
      }
    }
    card.replaceChildren(...body);
  }

  draw();
  refresh();
  return card;
}
