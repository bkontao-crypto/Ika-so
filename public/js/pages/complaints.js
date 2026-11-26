import { h, api, toast, fail } from "/js/dom.js";
import { brand } from "../core/brand.js";

export async function complaintsPage() {
  const main = document.querySelector("main");
  main.replaceChildren();
  let list = [];
  try { list = await api("/me/complaints"); } catch (e) {
    fail(e);
    main.append(h("div", { class: "card pad stack" }, h("p", { class: "notice" }, e.message || "Chargement impossible."),
      h("p", null, h("a", { href: "#/profil" }, "Retour à mon profil"))));
    return;
  }

  const form = h("form", { class: "card pad stack", onSubmit: async (ev) => {
    ev.preventDefault();
    const reason = ev.target.reason.value.trim();
    const details = ev.target.details.value.trim();
    if (!reason) return toast("Motif obligatoire.");
    try {
      await api("/me/complaints", { method: "POST", body: { reason, details } });
      toast("Réclamation envoyée.");
      complaintsPage();
    } catch (e) { fail(e); }
  } },
    h("h3", null, "Nouvelle réclamation"),
    h("label", { class: "field" }, "Motif",
      h("input", { class: "input", type: "text", name: "reason", required: true, maxlength: 200, placeholder: "Décrivez brièvement le problème" })),
    h("label", { class: "field" }, "Détails (optionnel)",
      h("textarea", { class: "input", name: "details", maxlength: 1000, rows: 4 })),
    h("button", { class: "btn", type: "submit" }, "Envoyer")
  );

  const STATUS = {
    OPEN: ["pill", "Ouverte"],
    IN_PROGRESS: ["pill pill-gold", "En cours"],
    RESOLVED: ["pill pill-green", "Résolue"],
    CLOSED: ["pill", "Fermée"],
  };
  const items = list.length
    ? list.map(c => {
        const [cls, label] = STATUS[c.status] || ["pill", c.status];
        return h("div", { class: "card" },
          h("div", { class: "row-between" },
            h("strong", null, c.reason),
            h("span", { class: cls }, label)
          ),
          h("p", { class: "small muted", style: "margin:6px 0 0" }, c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR") : ""),
          c.title ? h("p", { class: "small" }, "Annonce : " + c.title) : null,
          c.resolution ? h("p", { class: "small" }, "Résolution : " + c.resolution) : null,
          h("button", { class: "btn btn-small btn-outline", type: "button", onClick: () => openDetail(c.id), style: "margin-top:8px" }, "Voir / commenter")
        );
      })
    : [h("div", { class: "card empty-state" },
        h("div", { class: "mp-empty-ic" }, "📋"),
        h("h3", null, "Aucune réclamation"),
        h("p", null, "Vous n'avez pas encore déposé de réclamation.")
      )];

  main.append(h("section", { class: "stack" },
    h("h2", null, "Mes réclamations"),
    form,
    h("h3", null, "Historique"),
    ...items
  ));
}

async function openDetail(id) {
  try {
    const d = await api("/me/complaints/" + id);
    const comments = (d.comments || []).map(c => `· ${c.at?.slice(0,16) || ""} ${c.fromTeam ? "(Équipe ${brand()}) " : ""}: ${c.content}`).join("\n") || "Aucun commentaire.";
    const content = prompt("Commentaire (ou laisser vide pour fermer) :\n\n" + comments);
    if (content) {
      await api("/me/complaints/" + id + "/comment", { method: "POST", body: { content } });
      toast("Commentaire ajouté.");
    }
  } catch (e) { fail(e); }
}
