// Acceptation des conditions et des données à l'inscription (décision du propriétaire, 20 novembre 2026).
// Étape 1 : tout accepter (conditions + données d'usage rattachées au compte) ou refuser.
// Étape 2 (après refus) : autoriser au moins les données indispensables.
// Étape 3 (second refus) : l'entrée est bloquée, rien n'est créé.
// Résultat : "all" | "essential" | null (inscription impossible).
import { h } from "/js/dom.js";

const links = () => [h("a", { href: "/conditions", target: "_blank", rel: "noopener" }, "conditions d'utilisation"), " et la ", h("a", { href: "/confidentialite", target: "_blank", rel: "noopener" }, "politique de confidentialité")];

export function askDataConsent() {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const finish = (value) => { document.removeEventListener("keydown", onKey); overlay.remove(); previous?.focus?.(); resolve(value); };
    const onKey = (e) => { if (e.key === "Escape") finish(null); };
    const box = h("div", { class: "consent-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "dc-title" });
    const overlay = h("div", { class: "consent-overlay", id: "data-consent-dialog" }, box);

    const step1 = () => box.replaceChildren(
      h("h2", { id: "dc-title" }, "Avant de créer votre compte"),
      h("p", { class: "small" }, "En continuant, vous acceptez les ", ...links(), " et confirmez avoir 18 ans ou plus."),
      h("p", { class: "small" }, "Ika So a besoin de vos données pour fonctionner : compte, connexion et sécurité, annonces et messages, paiements, modération. Avec votre accord, elles incluent aussi vos données d'usage : pages consultées, annonces vues, appels et contacts WhatsApp lancés, fréquence de connexion. Elles servent à améliorer le service, protéger la plateforme et fournir des statistiques aux annonceurs."),
      h("p", { class: "small muted" }, "Vous pourrez modifier ce choix à tout moment dans Mon profil > Paramètres."),
      h("div", { class: "consent-actions" },
        h("button", { class: "btn", type: "button", onClick: step2 }, "Refuser"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => finish("all") }, "Tout accepter")));

    const step2 = () => box.replaceChildren(
      h("h2", { id: "dc-title" }, "Données indispensables"),
      h("p", { class: "small" }, "Sans les données indispensables (compte, connexion, sécurité, annonces, messages, paiements, modération), Ika So ne peut pas fonctionner. Autorisez-vous au moins ces données ?"),
      h("p", { class: "small muted" }, "Dans ce cas, vos données d'usage ne seront pas rattachées à votre compte. Vous pourrez les autoriser plus tard dans Mon profil > Paramètres."),
      h("div", { class: "consent-actions" },
        h("button", { class: "btn", type: "button", onClick: step3 }, "Refuser"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => finish("essential") }, "Autoriser l'indispensable")));

    const step3 = () => box.replaceChildren(
      h("h2", { id: "dc-title" }, "Accès impossible"),
      h("p", { class: "small", role: "alert" }, "Sans les données indispensables, nous ne pouvons pas créer votre compte ni vous donner accès à la plateforme. Aucune donnée n'a été enregistrée."),
      h("div", { class: "consent-actions" },
        h("button", { class: "btn", type: "button", onClick: step2 }, "Revenir en arrière"),
        h("button", { class: "btn btn-dark", type: "button", onClick: () => finish(null) }, "Quitter")));

    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
    step1();
    box.querySelector("button.btn-primary")?.focus();
  });
}
