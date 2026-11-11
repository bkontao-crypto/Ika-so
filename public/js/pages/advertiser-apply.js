import { api, fail, h, mount, readProofFile, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

export async function advertiserApplyPage() {
  if (needLogin()) return;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const type = params.get("type") === "agence" ? "AGENCE" : "PARTICULIER";
  const mine = await api("/me/advertiser-applications").catch(() => []);
  const pending = mine.find((a) => ["PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED"].includes(a.status));

  const STATUS = { PENDING: "en attente d'examen", UNDER_REVIEW: "en cours d'examen", ADDITIONAL_INFO_REQUIRED: "informations complémentaires demandées" };
  // Demande déjà envoyée : on peut y joindre une pièce (utile quand l'équipe demande des informations).
  const openRequest = (a) => h("div", { class: "card pad stack" },
    h("p", { class: "notice" }, `Vous avez déjà une demande en cours (${STATUS[a.status] || a.status}).`),
    a.status === "ADDITIONAL_INFO_REQUIRED" && a.admin_note ? h("p", null, `Message de l'équipe : ${a.admin_note}`) : null,
    h("p", { class: "small muted" }, `Pièces jointes : ${a.documents_count ?? 0} sur 5. Toutes sont facultatives.`),
    h("label", { class: "btn" }, "Ajouter une pièce (photo ou PDF, 700 Ko au plus)", h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": "Ajouter une pièce à la demande", onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await api(`/me/advertiser-applications/${encodeURIComponent(a.id)}/documents`, { method: "POST", body: { label: "AUTRE", fileData: await readProofFile(file) } });
        toast("Pièce ajoutée à votre demande.");
        location.reload();
      } catch (error) { fail(error); }
    } }),
    // Agence : le RCCM peut être (re)envoyé après le dépôt ; il suit le circuit de certification d'agence (contrôle par l'équipe).
    a.type === "AGENCE" ? h("label", { class: "btn" }, "Envoyer le RCCM de l'agence (photo ou PDF, 700 Ko au plus)", h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": "Envoyer le RCCM de l'agence", onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await api("/me/proofs", { method: "POST", body: { kind: "AGENCE", fileData: await readProofFile(file) } });
        toast("RCCM envoyé : l'équipe le contrôlera. Le badge « Agence vérifiée » n'est donné qu'après ce contrôle.");
      } catch (error) { fail(error); }
    } })) : null));

  // Toutes les pièces sont facultatives, pour les particuliers comme pour les agences.
  const optionalDocs = [
    ["doc_identity", "PIECE_IDENTITE", "Pièce d'identité (facultatif)"],
    ["doc_other", "AUTRE", type === "AGENCE" ? "Autre justificatif (facultatif)" : "Registre de commerce ou autre justificatif (facultatif)"],
  ];
  const fileField = (name, text) => h("label", { class: "field" }, `${text} : photo ou PDF, 700 Ko au plus`,
    h("input", { class: "input", name, type: "file", accept: "image/*,application/pdf" }));

  const form = h("form", { class: "card pad stack", onSubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      // Lire les fichiers avant l'envoi : un fichier illisible ou trop lourd est signalé tout de suite, sans demande à moitié créée.
      const read = async (file) => (file && file.size ? readProofFile(file) : null);
      const rccm = type === "AGENCE" ? await read(f.get("rccm")) : null;
      const extra = [];
      for (const [name, label] of optionalDocs) { const data = await read(f.get(name)); if (data) extra.push({ label, fileData: data }); }
      const created = await api("/me/advertiser-applications", { method: "POST", body: {
        type,
        fullName: f.get("fullName"),
        phone: f.get("phone"),
        city: f.get("city"),
        description: f.get("description"),
        agencyName: f.get("agencyName"),
        displayRole: type === "AGENCE" ? "Agence immobilière" : "Propriétaire direct",
      } });
      const failed = [];
      if (rccm) {
        // Même circuit que la certification d'agence : contrôle par l'équipe, badge « Agence vérifiée » seulement après acceptation.
        try { await api("/me/proofs", { method: "POST", body: { kind: "AGENCE", fileData: rccm } }); } catch (error) { failed.push(error.message); }
      }
      for (const doc of extra) {
        try { await api(`/me/advertiser-applications/${encodeURIComponent(created.id)}/documents`, { method: "POST", body: doc }); } catch (error) { failed.push(error.message); }
      }
      if (failed.length) toast(`Demande envoyée, mais une pièce n'a pas été reçue : ${failed[0]} Vous pourrez la renvoyer à la demande de l'équipe.`, true);
      else toast("Demande envoyée. Vous serez notifié de la décision.");
      location.hash = "#/profil";
    } catch (error) { fail(error); }
  } },
    h("h2", null, type === "AGENCE" ? "Demande pour une agence immobilière" : "Devenir annonceur particulier (gratuit)"),
    h("label", { class: "field" }, "Nom complet", h("input", { class: "input", name: "fullName", required: true })),
    h("label", { class: "field" }, "Téléphone", h("input", { class: "input", name: "phone", required: true })),
    h("label", { class: "field" }, "Ville / commune", h("input", { class: "input", name: "city" })),
    type === "AGENCE" ? h("label", { class: "field" }, "Nom de l'agence", h("input", { class: "input", name: "agencyName", required: true })) : null,
    h("label", { class: "field" }, "Description de votre activité", h("textarea", { class: "input", name: "description", rows: 4 })),
    type === "AGENCE" ? fileField("rccm", "Registre de commerce (RCCM), facultatif") : null,
    ...optionalDocs.map(([name, , text]) => fileField(name, text)),
    h("p", { class: "small muted" }, type === "AGENCE"
      ? "Aucune pièce n'est obligatoire. Le RCCM est contrôlé par l'équipe ; le badge « Agence vérifiée » n'est donné qu'après ce contrôle."
      : "Aucune pièce n'est obligatoire : vous pouvez en joindre pour faciliter l'examen de votre demande. L'équipe peut en demander d'autres."),
    h("button", { class: "btn btn-primary", type: "submit" }, "Envoyer la demande"));

  // Pièces conservées après décision : une année, renouvelable par le titulaire.
  const kept = mine.filter((a) => (a.documents_count ?? 0) > 0 && a.documents_expire_at && ["APPROVED", "REJECTED"].includes(a.status));
  const keptNotice = (a) => h("div", { class: "card pad stack" },
    h("p", { class: "small" }, `Vos ${a.documents_count} pièce(s) jointe(s) sont conservées jusqu'au ${new Date(a.documents_expire_at).toLocaleDateString("fr-FR")}, puis supprimées. Seule la décision est gardée.`),
    h("button", { class: "btn btn-small", type: "button", onClick: async () => {
      try { await api(`/me/advertiser-applications/${encodeURIComponent(a.id)}/documents/renew`, { method: "POST" }); toast("Conservation prolongée d'une année."); location.reload(); } catch (error) { fail(error); }
    } }, "Conserver une année de plus"));

  mount(app,
    h("h1", { class: "title" }, "Devenir annonceur"),
    pending ? openRequest(pending) : form,
    ...kept.map(keptNotice));
}
