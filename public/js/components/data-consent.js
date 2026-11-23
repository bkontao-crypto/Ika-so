// Acceptation à l'inscription (décision du propriétaire, 23 novembre 2026) : un seul écran, un seul bouton.
// « Continuer » = accepter les conditions, reconnaître la politique de confidentialité et autoriser la collecte des données
// (preuve : date et version enregistrées côté serveur, visibles dans Mon profil > Paramètres, où chacun peut la désactiver).
// Aucun autre texte que celui validé. Résultat : "all", ou null si la fenêtre est fermée (rien n'est créé).
import { h } from "/js/dom.js";

export function askDataConsent() {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const finish = (value) => { document.removeEventListener("keydown", onKey); overlay.remove(); previous?.focus?.(); resolve(value); };
    const onKey = (e) => { if (e.key === "Escape") finish(null); };
    const go = h("button", { class: "btn btn-primary", type: "button", onClick: () => finish("all") }, "Continuer");
    const box = h("div", { class: "consent-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "dc-text" },
      h("p", { id: "dc-text" }, "En cliquant sur « Continuer », vous acceptez nos ",
        h("a", { href: "/conditions", target: "_blank", rel: "noopener" }, "conditions d'utilisation"),
        " et reconnaissez avoir pris connaissance de notre ",
        h("a", { href: "/confidentialite", target: "_blank", rel: "noopener" }, "politique de confidentialité"), "."),
      go,
      h("p", { class: "small muted" }, "Vous pourrez les désactiver dans les paramètres."));
    const overlay = h("div", { class: "consent-overlay", id: "data-consent-dialog", onClick: (e) => { if (e.target === overlay) finish(null); } }, box);
    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
    go.focus();
  });
}
