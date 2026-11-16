import { DOCUMENT_DISCLAIMER, h, mount } from "/js/dom.js";
import { app } from "/js/core/state.js";

export function trustPage() {
  const badge = (title, text) => h("div", { class: "card" },
    h("h3", { style: "margin:0 0 6px" }, title),
    h("p", { class: "small muted", style: "margin:0" }, text)
  );

  mount(app, h("article", { class: "stack", style: "display:grid;gap:16px;max-width:800px;margin:0 auto" },
    h("h1", { class: "title" }, "Confiance"),
    h("p", null, "Ika So affiche ce que l'annonceur déclare. Les badges ne sont attribués qu'après vérification réelle par l'équipe."),
    h("div", { class: "stack", style: "display:grid;gap:12px" },
      badge("Titre foncier contrôlé", "Donné uniquement lorsqu'une personne de l'équipe a vérifié une pièce auprès de l'organisme concerné. Il disparaît si l'annonce est modifiée."),
      badge("Agence vérifiée", "Exige un registre de commerce contrôlé."),
      badge("Numéro vérifié par SMS", "Attribué seulement si le code a réellement été envoyé par SMS.")
    ),
    h("div", { class: "card notice" },
      h("strong", null, "Conseil de sécurité"),
      h("p", { style: "margin:8px 0 0" }, "Ne versez aucun acompte avant la visite et le contrôle du document auprès d'un notaire ou du cadastre. Ika So ne prend aucune commission sur la transaction pendant le pilote.")
    ),
    h("p", { class: "muted small" }, DOCUMENT_DISCLAIMER),
    h("p", { class: "muted small" }, "Aucune adresse IP n'est enregistrée dans les statistiques. Le texte de confidentialité et les conditions d'utilisation doivent encore être validés par un juriste malien avant l'ouverture publique."),
    h("div", { class: "row wrap gap-sm" },
      h("a", { href: "#/reclamations", class: "btn btn-outline" }, "Déposer une réclamation")
    )
  ));
}
