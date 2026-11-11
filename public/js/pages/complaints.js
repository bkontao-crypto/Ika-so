import { h, api, toast, fail } from "/js/dom.js";

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
    h("label", null, "Motif"),
    h("input", { name: "reason", required: true, maxlength: 200, placeholder: "Décrivez brièvement le problème" }),
    h("label", null, "Détails (optionnel)"),
    h("textarea", { name: "details", maxlength: 1000, rows: 3 }),
    h("button", { class: "btn", type: "submit" }, "Envoyer")
  );

  const items = list.length
    ? list.map(c => h("div", { class: "card pad" },
        h("strong", null, c.reason),
        h("p", { class: "small muted" }, `${c.status} · ${c.createdAt?.slice(0,16) || ""}`),
        c.title ? h("p", { class: "small" }, "Annonce : " + c.title) : null,
        c.resolution ? h("p", { class: "small" }, "Résolution : " + c.resolution) : null,
        h("button", { class: "btn btn-small", type: "button", onClick: () => openDetail(c.id) }, "Voir")
      ))
    : [h("p", { class: "muted" }, "Aucune réclamation.")];

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
    const comments = (d.comments || []).map(c => `· ${c.at?.slice(0,16) || ""} ${c.fromTeam ? "(Équipe Ika So) " : ""}: ${c.content}`).join("\n") || "Aucun commentaire.";
    const content = prompt("Commentaire (ou laisser vide pour fermer) :\n\n" + comments);
    if (content) {
      await api("/me/complaints/" + id + "/comment", { method: "POST", body: { content } });
      toast("Commentaire ajouté.");
    }
  } catch (e) { fail(e); }
}
