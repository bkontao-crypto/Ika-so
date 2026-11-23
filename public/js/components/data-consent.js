// Acceptation des conditions et des données à l'inscription (décision du propriétaire, 20 novembre 2026).
// Étape 1 : tout accepter (conditions + données d'usage rattachées au compte) ou refuser.
// Étape 2 (après refus) : autoriser au moins les données indispensables.
// Étape 3 (second refus) : l'entrée est bloquée, rien n'est créé.
// Résultat : "all" | "essential" | null (inscription impossible).
import { h } from "/js/dom.js";

const links = () => [h("a", { href: "/conditions", target: "_blank", rel: "noopener" }, "conditions d'utilisation"), " et la ", h("a", { href: "/confidentialite", target: "_blank", rel: "noopener" }, "politique de confidentialité")];

const opened = new Set(); // documents déjà ouverts pendant cette visite : inutile de les rouvrir si la fenêtre se ferme puis revient

export function askDataConsent() {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const finish = (value) => { document.removeEventListener("keydown", onKey); overlay.remove(); previous?.focus?.(); resolve(value); };
    const onKey = (e) => { if (e.key === "Escape") finish(null); };
    const box = h("div", { class: "consent-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "dc-title" });
    const overlay = h("div", { class: "consent-overlay", id: "data-consent-dialog" }, box);

    // Les deux documents doivent être ouverts avant de pouvoir accepter : on invite à les lire, on ne les « donne » pas à la chaîne.
    // Seule l'ouverture peut être constatée (pas la lecture) : l'écran dit « ouvert », jamais « lu ».
    const DOCS = [["conditions", "/conditions", "Conditions d'utilisation"], ["privacy", "/confidentialite", "Politique de confidentialité"]];
    const step1 = () => {
      // Deux gestes explicites : cocher « Tout accepter » (possible après ouverture des documents), puis « Continuer ».
      const box1 = h("input", { type: "checkbox", id: "dc-accept-all", disabled: true, "aria-describedby": "dc-hint" });
      const accept = h("button", { class: "btn btn-primary", type: "button", disabled: true, onClick: () => { if (box1.checked) finish("all"); } }, "Continuer");
      box1.addEventListener("change", () => { accept.disabled = !box1.checked; });
      const hint = h("p", { class: "small muted", id: "dc-hint", role: "status" });
      const marks = {};
      const refresh = () => {
        for (const [key] of DOCS) marks[key].textContent = opened.has(key) ? "✓ Ouvert" : "À ouvrir";
        const ready = opened.size === DOCS.length;
        box1.disabled = !ready;
        if (!ready) box1.checked = false;
        accept.disabled = !(ready && box1.checked);
        hint.textContent = ready ? "Cochez « Tout accepter », puis cliquez sur « Continuer »." : "Ouvrez et lisez les deux documents : la case « Tout accepter » s'activera ensuite.";
      };
      const doc = ([key, href, label]) => {
        marks[key] = h("span", { class: "small consent-doc-mark" });
        const open = () => { opened.add(key); refresh(); };
        return h("li", { class: "consent-doc" }, h("a", { href, target: "_blank", rel: "noopener", onClick: open, onAuxclick: open }, label), marks[key]);
      };
      box.replaceChildren(
        h("h2", { id: "dc-title" }, "Avant de créer votre compte"),
        h("p", { class: "small" }, "Prenez le temps de lire nos documents. Ils s'ouvrent dans un nouvel onglet : revenez ensuite ici pour continuer."),
        h("ul", { class: "consent-docs" }, DOCS.map(doc)),
        h("p", { class: "small" }, "En cliquant sur « Continuer », vous acceptez nos ", ...links(), ". Vous confirmez aussi avoir 18 ans ou plus."),
        h("p", { class: "small" }, "Ika So a besoin de vos données pour fonctionner : compte, connexion et sécurité, annonces et messages, paiements, modération. Avec votre accord, elles incluent aussi vos données d'usage : pages consultées, annonces vues, appels et contacts WhatsApp lancés, fréquence de connexion. Elles servent à améliorer le service, protéger la plateforme et fournir des statistiques aux annonceurs."),
        h("p", { class: "small muted" }, "Vous pourrez modifier ce choix à tout moment dans Mon profil > Paramètres."),
        h("label", { class: "consent-all", for: "dc-accept-all" }, box1, h("span", null, "Tout accepter : conditions d'utilisation, politique de confidentialité et données d'usage rattachées à mon compte, et j'ai 18 ans ou plus.")),
        hint,
        h("div", { class: "consent-actions" },
          h("button", { class: "btn", type: "button", onClick: step2 }, "Refuser"),
          accept));
      refresh();
    };

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
