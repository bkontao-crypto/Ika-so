import { DOCUMENT_DISCLAIMER, h, mount } from "/js/dom.js";
import { app } from "/js/core/state.js";

export function trustPage() {
  mount(app, h("article", { class: "stack" },
    h("h1", { class: "title" }, "Confiance"),
    h("p", null, "Ika So affiche ce que l'annonceur déclare. Le badge « Titre foncier contrôlé » n'est donné que lorsqu'une personne de l'équipe a vérifié une pièce auprès de l'organisme concerné, et il disparaît si l'annonce est modifiée. Le badge « Agence vérifiée » exige un registre de commerce contrôlé. Le badge « numéro vérifié par SMS » n'est donné que si le code a réellement été envoyé par SMS."),
    h("p", { class: "notice" }, DOCUMENT_DISCLAIMER),
    h("p", null, "Ne versez aucun acompte avant la visite et le contrôle du document auprès d'un notaire ou du cadastre. Ika So ne prend aucune commission sur la transaction pendant le pilote."),
    h("p", { class: "muted" }, "Aucune adresse IP n'est enregistrée dans les statistiques. Le texte de confidentialité et les conditions d'utilisation doivent encore être validés par un juriste malien avant l'ouverture publique."),
    h("a", { href: "#/", class: "btn btn-quiet" }, "Retour au catalogue")));
}

