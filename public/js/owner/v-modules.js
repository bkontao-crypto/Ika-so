// Modules du Owner Control Center. Chaque vue lit les endpoints existants (/staff/owner/*, /staff/*) : le contrôle des droits reste côté serveur.
import { api, h, ico, panel, empty, skeletons, errorBox, table, bars, pill, statusPill, nf, fcfa, dateTime, dateOnly, ago, initials, openDrawer, closeDrawer, formDialog, confirmDialog, act, fail, toast, CAT_COLORS } from "./ui.js";

/** Gabarit : en-tête + chargement asynchrone + reprise sur erreur. build(data, reload) → nœuds. */
function page(ctx, { eyebrow, title, desc, load, build, actions }) {
  const root = h("div", { class: "view" });
  const head = (extra) => h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, eyebrow), h("h1", null, title), desc ? h("p", null, desc) : null), h("div", { class: "actions" }, extra ?? null));
  async function reload() {
    root.replaceChildren(head(), skeletons(2, 120));
    try { const data = await load(); root.replaceChildren(head(actions?.(data, reload)), ...[].concat(build(data, reload))); } catch (e) { if (!e.stale) root.replaceChildren(head(), errorBox(e.message || "Chargement impossible.", reload)); }
  }
  reload();
  return root;
}
const mini = (l, v, sub) => h("div", { class: "card mini" }, h("small", null, l), h("strong", null, v), sub ? h("small", null, sub) : null);
const minis = (...m) => h("div", { class: "mini-stats" }, m);
const tracer = (ctx, type, id, label = "Retracer") => h("button", { class: "btn sm", type: "button", onClick: () => ctx.go(`#/trace/${type}/${encodeURIComponent(id)}`) }, ico("route"), label);
const adminLink = (label = "Ouvrir dans le centre de contrôle classique") => h("a", { class: "btn", href: "/admin" }, ico("external"), label);

// ---------- Pilotage ----------
export const listingsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Annonces & modération", desc: "File de modération, signalements et annonces en ligne.",
  load: () => api("/staff/queue"),
  actions: () => adminLink(),
  build(d, reload) {
    const s = d.stats;
    const pending = d.pending.length ? d.pending.map((it) => h("article", { class: "card panel row" },
      h("div", { class: "grow stack" }, h("div", { class: "row" }, pill("gold", "EN ATTENTE"), it.similarIds?.length ? pill("red", `Doublon possible (${it.similarIds.length})`) : null), h("b", null, it.title),
        h("p", { class: "muted small" }, `${it.transactionType} · ${it.category} · ${it.neighborhood} · ${fcfa(it.price)}`), h("p", { class: "muted small" }, `${it.ownerName}${it.phoneVerified ? " · numéro vérifié" : ""} · document déclaré : ${it.declaredDocument ?? "non précisé"} (sans garantie)`)),
      h("div", { class: "row" }, h("button", { class: "btn primary sm", type: "button", onClick: () => act(() => api(`/staff/listings/${encodeURIComponent(it.id)}/decision`, { method: "POST", body: { action: "APPROVE" } }), "Annonce publiée.", reload) }, ico("check"), "Approuver"),
        h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser l'annonce", [{ name: "reason", label: "Motif du refus (obligatoire)", type: "textarea", required: true, max: 500 }], { submit: "Refuser" }); if (v) act(() => api(`/staff/listings/${encodeURIComponent(it.id)}/decision`, { method: "POST", body: { action: "REJECT", reason: v.reason } }), "Annonce refusée.", reload); } }, ico("x"), "Refuser"), tracer(ctx, "listing", it.id))))
      : [empty("Rien en attente de modération.", "check")];
    const reports = d.reports.length ? table([{ label: "Annonce", render: (r) => h("div", { class: "item" }, h("b", null, r.title ?? r.listingId), h("small", null, r.details || "Sans précision")) }, { label: "Motif", key: "reason" },
      { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "listing", r.listingId), h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/reports/${encodeURIComponent(r.id)}/dismiss`, { method: "POST", body: {} }), "Signalement ignoré.", reload) }, "Ignorer")) }], d.reports) : empty("Aucun signalement ouvert.", "check");
    const online = table([{ label: "Annonce", render: (r) => h("div", { class: "item" }, h("b", null, r.title), h("small", null, r.neighborhood)) }, { label: "À la une", render: (r) => (r.featured ? pill("ok", "Oui") : pill("neutral", "Non")) },
      { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "listing", r.id), h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/listings/${encodeURIComponent(r.id)}/feature`, { method: "POST", body: { on: !r.featured } }), r.featured ? "Retirée de la une." : "Mise à la une (7 jours).", reload) }, r.featured ? "Retirer de la une" : "Mettre à la une")) }], d.online, { emptyText: "Aucune annonce en ligne." });
    return [minis(mini("Publiées", nf(s.published)), mini("En attente", nf(s.pending)), mini("Signalements ouverts", nf(s.open_reports)), mini("Nouvelles · 7 jours", nf(s.new_7d))),
      h("div", { class: "stack" }, ...pending), h("div", { class: "cols2" }, panel("Signalements ouverts", null, reports), panel("En ligne (20 dernières)", null, online))];
  },
});

export const usersView = (ctx) => {
  let q = "";
  return page(ctx, {
    eyebrow: "PILOTAGE", title: "Utilisateurs & comptes", desc: "100 derniers comptes. Les numéros sont masqués ; le dossier de traçage donne tout l'historique d'un compte.",
    load: () => api("/staff/accounts"), actions: () => adminLink(),
    build(rows, reload) {
      const box = h("div");
      const draw = () => {
        const f = rows.filter((r) => !q || `${r.fullName} ${r.userId} ${r.staffRole} ${r.accountStatus}`.toLowerCase().includes(q));
        box.replaceChildren(table([{ label: "Compte", render: (r) => h("div", { class: "row" }, h("span", { class: "avatar" }, initials(r.fullName)), h("div", { class: "item" }, h("b", null, r.fullName), h("small", null, `${r.phone ? `•••• ${String(r.phone).slice(-2)}` : "sans numéro"} · ${r.userId.slice(0, 12)}`))) },
          { label: "Rôle", render: (r) => pill(r.staffRole === "USER" ? "neutral" : "info", r.staffRole) }, { label: "Statut", render: (r) => statusPill(r.accountStatus) },
          { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "user", r.userId),
            h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Statut du compte", [{ name: "status", label: "Nouveau statut", type: "select", options: ["ACTIVE", "RESTRICTED", "BANNED"], value: r.accountStatus }, { name: "reason", label: "Motif (obligatoire sauf réactivation)", type: "textarea", max: 500 }], { intro: r.fullName }); if (v) act(() => api(`/staff/accounts/${encodeURIComponent(r.userId)}/status`, { method: "POST", body: v }), "Statut mis à jour.", reload); } }, "Statut"),
            h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Rôle équipe", [{ name: "role", label: "Rôle", type: "select", options: ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"], value: r.staffRole }], { intro: `${r.fullName} · le dernier SUPERADMIN actif ne peut pas être rétrogradé.` }); if (v) act(() => api(`/staff/accounts/${encodeURIComponent(r.userId)}/role`, { method: "POST", body: v }), "Rôle mis à jour.", reload); } }, "Rôle")) }], f, { emptyText: "Aucun compte ne correspond." }));
      };
      const input = h("input", { class: "input", type: "search", placeholder: "Filtrer par nom, identifiant, rôle…", "aria-label": "Filtrer" });
      input.addEventListener("input", () => { q = input.value.trim().toLowerCase(); draw(); });
      draw();
      return [h("div", { class: "toolbar" }, input), panel(`Comptes (${rows.length})`, null, box)];
    },
  });
};

export const agenciesView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Agences & annonceurs", desc: "Profils d'agence et annonceurs vérifiés.", load: () => api("/staff/owner/agencies"),
  build: (rows) => [minis(mini("Agences / annonceurs", nf(rows.length)), mini("Vérifiés", nf(rows.filter((r) => r.verifiedAt).length)), mini("Annonces publiées", nf(rows.reduce((a, r) => a + r.published, 0)))),
    panel("Agences", null, table([{ label: "Agence", render: (r) => h("div", { class: "item" }, h("b", null, r.agency ?? r.name), h("small", null, r.name)) }, { label: "Vérifiée", render: (r) => (r.verifiedAt ? pill("ok", dateOnly(r.verifiedAt)) : pill("neutral", "Non")) }, { label: "Statut", render: (r) => statusPill(r.status) },
      { label: "Publiées", key: "published", num: true }, { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "user", r.userId), h("a", { class: "btn sm", href: `/#/annonceur/${encodeURIComponent(r.userId)}`, target: "_blank", rel: "noopener" }, ico("external"), "Profil")) }], rows))],
});

export const trustView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Confiance & vérifications", desc: "Pièces à contrôler, alertes et signalements de confiance. Le contrôle des pièces (documents sensibles) reste dans le centre de contrôle classique.",
  load: () => api("/staff/trust"), actions: () => adminLink("Contrôler les pièces"),
  build(t) {
    const n = (a) => (a ?? []).length;
    const sec = (title, rows, cols) => panel(`${title} (${n(rows)})`, null, table(cols, rows ?? [], { emptyText: "Rien à traiter." }));
    return [minis(mini("Pièces à contrôler", nf(n(t.proofs))), mini("Alertes ouvertes", nf(n(t.alerts))), mini("Commentaires signalés", nf(n(t.commentReports))), mini("Personnes / avis signalés", nf(n(t.userReports) + n(t.reviewReports)))),
      h("div", { class: "cols2" }, sec("Pièces justificatives", t.proofs, [{ label: "Dépôt", render: (r) => h("div", { class: "item" }, h("b", null, r.kind ?? r.type ?? "Pièce"), h("small", null, r.ownerName ?? r.listingTitle ?? "")) }, { label: "Date", render: (r) => dateOnly(r.createdAt ?? r.created_at) }]),
        sec("Alertes", t.alerts, [{ label: "Alerte", render: (r) => h("div", { class: "item" }, h("b", null, r.kind ?? "Alerte"), h("small", null, r.detail ?? "")) }, { label: "Date", render: (r) => dateOnly(r.createdAt ?? r.created_at) }]))];
  },
});

export const complaintsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Signalements & réclamations", desc: "Statuts : ouverte → en cours → résolue → close. Prioritaire = ouverte depuis plus de 72 h.",
  load: () => api("/staff/owner/complaints"),
  build(c, reload) {
    const old = (r) => Date.now() - new Date(r.created_at).getTime() > 72 * 3_600_000;
    const open = (id) => openComplaint(ctx, id, reload);
    return [minis(mini("Annonces signalées", nf(c.listingReports.length)), mini("Prioritaires (> 72 h)", nf(c.listingReports.filter(old).length)), mini("Personnes signalées", nf(c.userReports.length))),
      panel("Réclamations sur annonces", "Cliquez « Traiter » pour affecter, commenter, résoudre ou clore", table([{ label: "Dossier", render: (r) => h("div", { class: "item" }, h("b", null, r.title ?? r.listing_id), h("small", null, `#${r.id.slice(0, 10)}`)) }, { label: "Motif", key: "reason" }, { label: "Statut", render: (r) => statusPill(r.status) },
        { label: "Âge", render: (r) => (old(r) ? pill("red", ago(r.created_at)) : ago(r.created_at)) }, { label: "", render: (r) => h("div", { class: "row" }, h("button", { class: "btn primary sm", type: "button", onClick: () => open(r.id) }, "Traiter"), tracer(ctx, "listing", r.listing_id)) }], c.listingReports, { emptyText: "Aucune réclamation ouverte." })),
      panel("Signalements de personnes", "Traitement dans le centre de contrôle classique (extraits de conversation)", table([{ label: "Signalé", render: (r) => tracer(ctx, "user", r.reported_id, "Retracer le compte") }, { label: "Motif", key: "reason" }, { label: "Date", render: (r) => ago(r.created_at) }], c.userReports, { emptyText: "Aucun signalement de personne." }))];
  },
});
async function openComplaint(ctx, id, reload) {
  try {
    const r = await api(`/staff/owner/complaints/${encodeURIComponent(id)}`);
    const refresh = () => { closeDrawer(); reload(); };
    openDrawer(`Dossier #${id.slice(0, 10)}`, h("div", { class: "row" }, statusPill(r.status), pill("neutral", r.reason)), h("p", { class: "note" }, r.details || "Sans précision."), r.title ? h("p", { class: "small" }, `Annonce : ${r.title}`) : null,
      h("dl", { class: "kv" }, h("dt", null, "Déposé"), h("dd", null, dateTime(r.created_at)), h("dt", null, "Affecté à"), h("dd", null, r.assigned_to ?? "Personne"), h("dt", null, "Résolution"), h("dd", null, r.resolution ?? "—")),
      h("h3", { class: "tiny muted" }, "HISTORIQUE"), ...(r.comments.length ? r.comments.map((c) => h("div", { class: "note" }, h("b", null, c.visible_to_complainant ? "Visible du plaignant" : "Note interne"), h("p", null, c.content), h("small", null, dateTime(c.created_at)))) : [h("p", { class: "muted small" }, "Aucun commentaire.")]),
      h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/owner/complaints/${encodeURIComponent(id)}/assign`, { method: "POST", body: { assigneeId: ctx.userId } }), "Dossier affecté à vous.", refresh) }, "M'affecter"),
        h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Commentaire", [{ name: "content", label: "Message", type: "textarea", required: true, max: 500 }, { name: "visible", label: "Visible du plaignant ?", type: "select", options: [{ value: "no", label: "Non (note interne)" }, { value: "yes", label: "Oui" }] }]); if (v) act(() => api(`/staff/owner/complaints/${encodeURIComponent(id)}/comment`, { method: "POST", body: { content: v.content, visible: v.visible === "yes" } }), "Commentaire ajouté.", refresh); } }, "Commenter"),
        h("button", { class: "btn primary sm", type: "button", onClick: async () => { const v = await formDialog("Résoudre", [{ name: "resolution", label: "Résolution", type: "textarea", required: true, max: 500 }]); if (v) act(() => api(`/staff/owner/complaints/${encodeURIComponent(id)}/resolve`, { method: "POST", body: v }), "Dossier résolu.", refresh); } }, "Résoudre"),
        h("button", { class: "btn sm", type: "button", onClick: async () => { if (await confirmDialog("Clore le dossier", "Un dossier clos ne se rouvre pas.", "Clore")) act(() => api(`/staff/owner/complaints/${encodeURIComponent(id)}/close`, { method: "POST" }), "Dossier clos.", refresh); } }, "Clore")));
  } catch (e) { fail(e); }
}

export const paymentsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Paiements & finances", desc: "Encaissements et paiements récents. Rapprochement et remboursements : centre de contrôle classique (onglet Paiements).",
  load: async () => { const [o, s] = await Promise.all([api("/staff/owner/overview"), api("/staff/owner/subscriptions")]); return { o, s }; }, actions: () => adminLink("Rapprochement & remboursements"),
  build({ o, s }) {
    const f = o.finance;
    return [minis(mini("Paiements réussis", nf(f.paymentsPaid)), mini("Montant encaissé", fcfa(Number(f.amountPaid))), mini("En attente", nf(f.paymentsPending)), mini("Statuts suivis", nf(Object.keys(s.byStatus).length))),
      h("div", { class: "cols2" }, panel("Par statut", null, bars(Object.entries(s.byStatus).map(([k, v]) => ({ label: k, value: v.count })))),
        panel("Montants par statut", null, table([{ label: "Statut", render: (r) => statusPill(r[0]) }, { label: "Nombre", render: (r) => nf(r[1].count), num: true }, { label: "Total", render: (r) => fcfa(r[1].total), num: true }], Object.entries(s.byStatus)))),
      panel("20 derniers paiements", null, table([{ label: "Formule", key: "label" }, { label: "Montant", render: (r) => fcfa(r.amount), num: true }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Date", render: (r) => dateTime(r.createdAt) }], s.recent, { emptyText: "Aucun paiement." }))];
  },
});

export const subscriptionsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Abonnements & formules", desc: "Formules de mise à la une : prix et activation. Aucun tarif n'est imposé.", load: () => api("/staff/owner/offers"),
  actions: (_, reload) => h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Nouvelle formule", [{ name: "code", label: "Code", required: true, max: 20 }, { name: "label", label: "Libellé", required: true, max: 80 }, { name: "days", label: "Durée (jours)", type: "number", value: 7 }, { name: "price", label: "Prix (FCFA)", type: "number", value: 0 }]); if (v) act(() => api("/staff/owner/offers", { method: "POST", body: v }), "Formule créée.", reload); } }, ico("plus"), "Nouvelle formule"),
  build: (rows, reload) => panel("Formules", null, table([{ label: "Code", key: "code" }, { label: "Libellé", key: "label" }, { label: "Durée", render: (r) => `${r.days} j`, num: true }, { label: "Prix", render: (r) => fcfa(r.price_xof), num: true }, { label: "Active", render: (r) => (r.active ? pill("ok", "Oui") : pill("neutral", "Non")) },
    { label: "", render: (r) => h("button", { class: "btn sm", type: "button", onClick: () => act(() => api("/staff/owner/offers/toggle", { method: "POST", body: { code: r.code } }), "Formule modifiée.", reload) }, r.active ? "Désactiver" : "Activer") }], rows)),
});

// ---------- Croissance ----------
const STAGES = [["NEW", "Nouveau"], ["CONTACTED", "Contacté"], ["VISIT_PLANNED", "Visite planifiée"], ["VISIT_DONE", "Visite faite"], ["NEGOTIATION", "Négociation"], ["WON", "Gagné"], ["LOST", "Perdu"]];
export const crmView = (ctx) => page(ctx, {
  eyebrow: "CROISSANCE", title: "CRM & pipeline", desc: "7 étapes commerciales. Changez l'étape d'un contact depuis sa carte.", load: () => api("/staff/owner/pipeline"),
  actions: (_, reload) => h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Nouveau contact", [{ name: "name", label: "Nom", required: true, max: 80 }, { name: "phone", label: "Téléphone", max: 30 }, { name: "note", label: "Note", type: "textarea", max: 500 }]); if (v) act(() => api("/staff/owner/pipeline", { method: "POST", body: v }), "Contact ajouté.", reload); } }, ico("plus"), "Nouveau contact"),
  build: (d, reload) => h("div", { class: "kanban" }, STAGES.map(([k, l]) => h("section", { class: "col" }, h("h3", null, l, pill("neutral", String(d.counts[k] ?? 0))),
    ...d.items.filter((i) => i.stage === k).map((i) => { const sel = h("select", { class: "select", "aria-label": "Étape" }, STAGES.map(([v, t]) => h("option", { value: v, selected: v === i.stage }, t))); sel.addEventListener("change", () => act(() => api(`/staff/owner/pipeline/${encodeURIComponent(i.id)}/stage`, { method: "POST", body: { stage: sel.value } }), "Étape mise à jour.", reload));
      return h("div", { class: "kcard" }, h("b", null, i.name || "Sans nom"), i.title ? h("span", { class: "muted" }, i.title) : null, i.note ? h("span", { class: "muted" }, i.note) : null, h("small", { class: "muted" }, ago(i.updatedAt)), sel); })))),
});

export const contactsView = (ctx) => page(ctx, {
  eyebrow: "CROISSANCE", title: "Contacts & visites", desc: "Clics de contact et demandes de visite récents (200 au plus).", load: () => api("/staff/owner/crm?limit=100"),
  build: (d, reload) => h("div", { class: "cols2" }, panel("Contacts récents", null, table([{ label: "Annonce", render: (r) => h("div", { class: "item" }, h("b", null, r.title ?? r.listing_id), h("small", null, r.neighborhood ?? "")) }, { label: "Canal", render: (r) => pill("info", r.kind === "CALL" ? "Appel" : "WhatsApp") }, { label: "Quand", render: (r) => ago(r.created_at) }], d.contacts, { emptyText: "Aucun contact." })),
    panel("Demandes de visite", null, table([{ label: "Annonce", render: (r) => r.title ?? r.listing_id }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Proposée", render: (r) => dateTime(r.proposed_at) },
      { label: "", render: (r) => { const sel = h("select", { class: "select", "aria-label": "Statut" }, ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"].map((v) => h("option", { value: v, selected: v === r.status }, v))); sel.addEventListener("change", () => act(() => api(`/staff/owner/visits/${encodeURIComponent(r.id)}/status`, { method: "POST", body: { status: sel.value } }), "Statut mis à jour.", reload)); return sel; } }], d.visits, { emptyText: "Aucune demande." }))),
});

export const marketingView = (ctx) => page(ctx, {
  eyebrow: "CROISSANCE", title: "Marketing & campagnes", desc: "Campagnes et annonces mises à la une.", load: () => api("/staff/owner/marketing"),
  actions: (_, reload) => h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Nouvelle campagne", [{ name: "name", label: "Nom", required: true, max: 80 }, { name: "kind", label: "Type", type: "select", options: ["PROMO", "BANNER", "SPONSORED", "NEWS"] }, { name: "content", label: "Texte", type: "textarea", max: 500 }]); if (v) act(() => api("/staff/owner/campaigns", { method: "POST", body: v }), "Campagne créée (brouillon).", reload); } }, ico("plus"), "Nouvelle campagne"),
  build: (d, reload) => [panel("Campagnes", null, table([{ label: "Nom", key: "name" }, { label: "Type", render: (r) => pill("info", r.kind) }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Période", render: (r) => `${dateOnly(r.startsAt)} → ${dateOnly(r.endsAt)}` },
    { label: "", render: (r) => h("div", { class: "row" }, ...[["ACTIVE", "Activer"], ["PAUSED", "Pause"], ["ENDED", "Terminer"]].filter(([v]) => v !== r.status).map(([v, l]) => h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/owner/campaigns/${encodeURIComponent(r.id)}/status`, { method: "POST", body: { status: v } }), "Campagne mise à jour.", reload) }, l))) }], d.campaigns, { emptyText: "Aucune campagne." })),
    panel("À la une actuellement", null, table([{ label: "Annonce", render: (r) => h("div", { class: "item" }, h("b", null, r.title), h("small", null, r.neighborhood)) }, { label: "Jusqu'au", render: (r) => dateOnly(r.until) }, { label: "", render: (r) => tracer(ctx, "listing", r.id) }], d.featured, { emptyText: "Aucune annonce à la une." }))],
});

export const newslettersView = (ctx) => page(ctx, {
  eyebrow: "CROISSANCE", title: "Newsletters", desc: "« Envoyée » n'apparaît qu'après un envoi réel, aux abonnés consentants uniquement.", load: () => api("/staff/owner/newsletters"),
  actions: (_, reload) => [h("button", { class: "btn", type: "button", onClick: async () => { const v = await formDialog("Notification collective", [{ name: "title", label: "Titre", required: true, max: 120 }, { name: "body", label: "Message", type: "textarea", required: true, max: 500 }, { name: "target", label: "Cible", type: "select", options: [{ value: "ALL", label: "Tous les comptes actifs" }, { value: "AGENCIES", label: "Agences" }, { value: "STAFF", label: "Équipe" }] }]); if (v) act(async () => { const o = await api("/staff/owner/broadcast", { method: "POST", body: v }); toast(`${o.sent} destinataire(s).`); }, "Notification envoyée.", reload); } }, ico("bell"), "Notification collective"),
    h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Nouvelle newsletter", [{ name: "subject", label: "Objet", required: true, max: 120 }, { name: "content", label: "Contenu", type: "textarea", required: true, max: 5000 }]); if (v) act(() => api("/staff/owner/newsletters", { method: "POST", body: v }), "Brouillon créé.", reload); } }, ico("plus"), "Nouvelle newsletter")],
  build: (rows, reload) => panel("Newsletters", null, table([{ label: "Objet", key: "subject" }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Destinataires", render: (r) => (r.recipients == null ? "—" : `${r.recipients}${r.failed ? ` (${r.failed} échec)` : ""}`), num: true }, { label: "Créée", render: (r) => dateOnly(r.created_at) },
    { label: "", render: (r) => (r.status === "DRAFT" ? h("button", { class: "btn sm primary", type: "button", onClick: async () => { if (await confirmDialog("Envoyer la newsletter", "Envoi réel aux abonnés consentants. Action irréversible.", "Envoyer")) act(async () => { const o = await api(`/staff/owner/newsletters/${encodeURIComponent(r.id)}/send`, { method: "POST" }); toast(`${o.recipients} envoyé(s), ${o.failed} échec(s).`); }, "Traitement terminé.", reload); } }, "Envoyer") : null) }], rows, { emptyText: "Aucune newsletter." })),
});

export const regionsView = (ctx) => page(ctx, {
  eyebrow: "CROISSANCE", title: "Régions & tendances", desc: "Répartition des annonces par quartier et prix médians déclarés (90 jours).",
  load: async () => { const [r, t] = await Promise.all([api("/staff/owner/regions"), api("/staff/owner/trends?days=90")]); return { r, t }; },
  build: ({ r, t }) => h("div", { class: "cols2" }, panel("Annonces par quartier", "Publiées", bars(r.slice(0, 12).map((x) => ({ label: x.neighborhood, value: x.published })))),
    panel("Prix médians par catégorie", "Prix déclarés, non vérifiés", table([{ label: "Catégorie", key: "category" }, { label: "Annonces", key: "count", num: true }, { label: "Prix médian", render: (x) => fcfa(x.medianPrice), num: true }], t.byCategory))),
});

export const aiView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Assistance IA", desc: "Détection de doublons, prix atypiques et rafales ; aide à la rédaction. Règles automatiques : elles suggèrent, vous décidez.", load: () => api("/staff/owner/ai"),
  actions: () => h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Aide à la rédaction", [{ name: "category", label: "Catégorie", type: "select", options: ["Maison", "Appartement", "Terrain", "Studio"] }, { name: "transaction", label: "Transaction", type: "select", options: ["Vente", "Location"] }, { name: "neighborhood", label: "Quartier" }, { name: "price", label: "Prix", type: "number" }, { name: "surface", label: "Surface m²", type: "number" }, { name: "rooms", label: "Pièces", type: "number" }]); if (!v) return; try { const o = await api("/staff/owner/ai/write", { method: "POST", body: v }); openDrawer("Suggestions de rédaction", ...o.suggestedTitles.map((t) => h("p", { class: "note" }, t)), h("p", { class: "note" }, o.suggestedDescription), h("ul", null, ...o.tips.map((x) => h("li", null, x)))); } catch (e) { fail(e); } } }, ico("sparkles"), "Aide à la rédaction"),
  build: (a) => [minis(mini("Doublons possibles", nf(a.potentialDuplicates.length)), mini("Prix atypiques", nf(a.priceOutliers.length)), mini("Rafales (24 h)", nf(a.bursts.length))),
    h("div", { class: "cols2" }, panel("Doublons potentiels", "Même quartier, même type, prix à 5 %", table([{ label: "Annonce A", render: (r) => h("button", { class: "link", type: "button", onClick: () => ctx.go(`#/trace/listing/${encodeURIComponent(r.id1)}`) }, r.title1) }, { label: "Annonce B", render: (r) => h("button", { class: "link", type: "button", onClick: () => ctx.go(`#/trace/listing/${encodeURIComponent(r.id2)}`) }, r.title2) }, { label: "Quartier", key: "neighborhood" }], a.potentialDuplicates, { emptyText: "Aucun doublon détecté." })),
      panel("Prix atypiques", "< 100 000 ou > 500 M FCFA", table([{ label: "Annonce", render: (r) => h("button", { class: "link", type: "button", onClick: () => ctx.go(`#/trace/listing/${encodeURIComponent(r.id)}`) }, r.title) }, { label: "Prix", render: (r) => fcfa(r.price), num: true }], a.priceOutliers, { emptyText: "Aucun prix atypique." }))),
    panel("Rafales de dépôts", "3 annonces ou plus en 24 h par la même personne", table([{ label: "Compte", render: (r) => tracer(ctx, "user", r.ownerId) }, { label: "Annonces", key: "count", num: true }], a.bursts, { emptyText: "Aucune rafale." }))],
});

// ---------- Système ----------
export const reportsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Rapports & exports", desc: "Chaque export du journal des mouvements est inscrit au journal d'audit.", load: async () => api("/staff/owner/report"),
  build(r) {
    const link = (href, icon, t, sub, dl) => h("a", { class: "module", href, download: dl ?? null }, h("span", { class: "moduleico" }, ico(icon)), h("span", null, h("b", null, t), h("small", null, sub)));
    return [h("section", { class: "grid modules" }, link("/api/staff/owner/report.pdf", "file", "Rapport complet PDF", "Synthèse Owner", "owner-report.pdf"), link("/api/staff/owner/export.csv", "download", "Indicateurs CSV", "Vue d'ensemble", "owner-overview.csv"), link("/api/staff/owner/listings.csv", "list", "Annonces CSV", "500 dernières", "listings-report.csv"),
      link("/api/staff/owner/activity/export.csv?categories=admin,account,security,listing,engagement,safety,finance,growth,system", "pulse", "Mouvements CSV", "Toutes catégories (5 000 lignes)", "mouvements-ika-so.csv")),
      minis(mini("Annonces", nf(r.overview.listings.total)), mini("Utilisateurs", nf(r.overview.users.total)), mini("Agences", nf(r.agenciesCount)), mini("Réclamations ouvertes", nf(r.openComplaints))),
      h("p", { class: "note" }, `Rapport généré le ${dateTime(r.generatedAt)}. Base de données : ${r.health.database === "ok" ? "connectée" : "injoignable"}.`)];
  },
});

export const monitoringView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Surveillance & incidents", desc: "Santé du serveur, incidents ouverts, contrôles automatiques toutes les 15 minutes.",
  load: async () => { const [m, i] = await Promise.all([api("/staff/owner/monitoring"), api("/staff/owner/incidents")]); return { m, i }; },
  actions: (_, reload) => [h("button", { class: "btn", type: "button", onClick: () => act(async () => { const o = await api("/staff/owner/incidents/check", { method: "POST" }); toast(`${o.created} incident(s) créé(s).`); }, "Contrôle terminé.", reload) }, ico("refresh"), "Vérifier maintenant"),
    h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Déclarer un incident", [{ name: "message", label: "Message", required: true, max: 300 }, { name: "kind", label: "Type", type: "select", options: ["OTHER", "DB", "PAYMENT", "STORAGE", "ERROR"] }, { name: "severity", label: "Gravité", type: "select", options: ["WARNING", "INFO", "CRITICAL"] }]); if (v) act(() => api("/staff/owner/incidents", { method: "POST", body: v }), "Incident déclaré.", reload); } }, ico("plus"), "Déclarer")],
  build: ({ m, i }, reload) => [minis(mini("Base de données", m.database === "ok" ? "OK" : "Erreur"), mini("Mémoire (Mo)", nf(m.memory.rss), `heap ${m.memory.heapUsed}/${m.memory.heapTotal}`), mini("Paiements en attente (7 j)", nf(m.pendingPayments7d)), mini("Réclamations ouvertes", nf(m.openReports))),
    panel("Incidents", null, table([{ label: "Gravité", render: (r) => pill({ CRITICAL: "red", WARNING: "gold", INFO: "info" }[r.severity] ?? "neutral", r.severity) }, { label: "Type", key: "kind" }, { label: "Message", render: (r) => r.message }, { label: "Date", render: (r) => dateTime(r.created_at) },
      { label: "", render: (r) => (r.resolved ? pill("ok", "Résolu") : h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/owner/incidents/${encodeURIComponent(r.id)}/resolve`, { method: "POST" }), "Incident résolu.", reload) }, "Résoudre")) }], i, { emptyText: "Aucun incident." }))],
});

export const backupsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Sauvegardes & restaurations", desc: "Vraie sauvegarde pg_dump (format custom) contrôlée par pg_restore --list et empreinte SHA-256. « Notée » = simple note, sans fichier.",
  load: async () => { const [b, r] = await Promise.all([api("/staff/owner/backups"), api("/staff/owner/restores")]); return { b, r }; },
  actions: (_, reload) => [h("button", { class: "btn primary", type: "button", onClick: () => act(async () => { const o = await api("/staff/owner/backup/auto", { method: "POST" }); toast(o.skipped ? o.reason : `Sauvegarde ${o.status}.`, o.status === "FAILED"); }, "Demande traitée.", reload) }, ico("database"), "Sauvegarde réelle maintenant"),
    h("button", { class: "btn", type: "button", onClick: async () => { const v = await formDialog("Noter une sauvegarde", [{ name: "note", label: "Note", required: true, max: 200 }]); if (v) act(() => api("/staff/owner/backups", { method: "POST", body: v }), "Note enregistrée.", reload); } }, "Noter"),
    h("button", { class: "btn", type: "button", onClick: async () => { const v = await formDialog("Noter une restauration", [{ name: "note", label: "Note", required: true, max: 200 }]); if (v) act(() => api("/staff/owner/restores", { method: "POST", body: v }), "Restauration notée.", reload); } }, "Noter une restauration")],
  build: ({ b, r }, reload) => [panel("Journal des sauvegardes", null, table([{ label: "Statut", render: (x) => statusPill(x.status) }, { label: "Type", key: "kind" }, { label: "Fichier", render: (x) => x.file_name ?? x.note ?? "—" }, { label: "Taille", render: (x) => (x.size_bytes ? `${(x.size_bytes / 1048576).toFixed(1)} Mo` : "—"), num: true },
    { label: "Contrôlée", render: (x) => (x.verified_at ? dateTime(x.verified_at) : "—") }, { label: "Date", render: (x) => dateTime(x.created_at) },
    { label: "", render: (x) => (x.status === "OK" ? h("button", { class: "btn sm", type: "button", onClick: () => act(async () => { const o = await api(`/staff/owner/backups/${encodeURIComponent(x.id)}/verify`, { method: "POST" }); toast(o.ok ? "Archive conforme." : "Archive non conforme.", !o.ok); }, "Contrôle terminé.", reload) }, "Contrôler") : null) }], b, { emptyText: "Aucune sauvegarde." })),
    panel("Journal des restaurations", null, table([{ label: "Note", key: "note" }, { label: "Date", render: (x) => dateTime(x.created_at) }], r, { emptyText: "Aucune restauration notée." }))],
});

export const homepageView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Page d’accueil", desc: "Image de fond, couleur et opacité de l’overlay. Appliqué au site public.",
  load: async () => api("/homepage-settings"),
  build(s, reload) {
    const f = { ...s };
    const inp = (k, l, type = "text") => { const i = h("input", { class: "input", type, value: f[k] ?? "" }); i.addEventListener("input", () => { f[k] = i.value; }); return h("label", { class: "field" }, l, i); };
    return [panel("Apparence de l’accueil", null, h("div", { class: "form two" },
      inp("image", "URL de l’image de fond"),
      inp("overlayColor", "Couleur de l’overlay"),
      inp("overlayOpacity", "Opacité (0–1)"),
      h("div", { class: "wide" }, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/homepage-settings", { method: "PUT", body: f }), "Page d’accueil enregistrée.", reload) }, "Enregistrer"))))];
  },
});

export const settingsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Paramètres plateforme", desc: "Identité, contact, devise et journal de connexions.",
  load: async () => { const [s, sec] = await Promise.all([api("/staff/owner/settings"), api("/staff/owner/security-log")]); return { s, sec }; },
  build({ s, sec }, reload) {
    const f = { platformName: s.platformName, contactEmail: s.contactEmail, contactPhone: s.contactPhone, currency: s.currency };
    const inp = (k, l) => { const i = h("input", { class: "input", value: f[k] ?? "" }); i.addEventListener("input", () => { f[k] = i.value; }); return h("label", { class: "field" }, l, i); };
    return [panel("Identité & contact", null, h("div", { class: "form two" }, inp("platformName", "Nom de la plateforme"), inp("contactEmail", "E-mail de contact"), inp("contactPhone", "Téléphone de contact"), inp("currency", "Devise"),
      h("div", { class: "wide" }, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/settings", { method: "PUT", body: f }), "Paramètres enregistrés.", reload) }, "Enregistrer")))),
      panel("Journal de connexions", "Connexions, déconnexions, inscriptions et échecs de connexion : sans adresse IP, sans e-mail saisi, sans agent utilisateur brut (famille d'appareil seulement).",
        h("div", { class: "stack" }, h("div", { class: "row" }, sec.enabled ? pill("ok", "Activé") : pill("neutral", "Désactivé"), sec.available ? h("span", { class: "muted small" }, `${nf(sec.total)} ligne(s) · ${nf(sec.last24h)} sur 24 h${sec.since ? ` · depuis ${dateOnly(sec.since)}` : ""}`) : pill("gold", "Migration 042 à appliquer")),
          h("p", { class: "note warn" }, "À faire valider avec le juriste / l'APDP avant mise en production, comme la collecte analytique. Conservation proposée : 12 mois (purge à brancher)."),
          h("div", null, h("button", { class: "btn", type: "button", onClick: () => act(() => api("/staff/owner/security-log", { method: "PUT", body: { enabled: !sec.enabled } }), sec.enabled ? "Journal désactivé." : "Journal activé.", reload) }, sec.enabled ? "Désactiver" : "Activer"))))];
  },
});

export const seoView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "SEO, logo & pages légales", desc: "Appliqués au site public (cache 30 s). Les pages légales doivent être validées par un juriste.",
  load: async () => { const [seo, logo, legal] = await Promise.all([api("/staff/owner/seo"), api("/staff/owner/logo"), api("/staff/owner/legal")]); return { seo, logo, legal }; },
  build({ seo, logo, legal }, reload) {
    const S = { ...seo }; const L = { ...legal }; const G = { logoUrl: logo.logoUrl };
    const fld = (o, k, l, area, max) => { const i = h(area ? "textarea" : "input", { class: "input", maxlength: max ?? 300 }); i.value = o[k] ?? ""; i.addEventListener("input", () => { o[k] = i.value; }); return h("label", { class: "field wide" }, l, i); };
    return [panel("Référencement", null, h("div", { class: "form" }, fld(S, "title", "Titre (120 max)", false, 120), fld(S, "description", "Description (300 max)", true, 300), fld(S, "keywords", "Mots-clés", false, 200), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/seo", { method: "PUT", body: S }), "SEO enregistré.", reload) }, "Enregistrer")))),
      panel("Logo", "Chemin du site (/media/…) ou adresse https", h("div", { class: "form" }, fld(G, "logoUrl", "Adresse du logo", false, 500), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/logo", { method: "PUT", body: G }), "Logo enregistré.", reload) }, "Enregistrer")))),
      panel("Pages légales", "CGU, confidentialité, mentions légales", h("div", { class: "form" }, fld(L, "cgu", "Conditions générales", true, 10000), fld(L, "privacy", "Politique de confidentialité", true, 10000), fld(L, "mentions", "Mentions légales", true, 5000), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/legal", { method: "PUT", body: L }), "Pages légales publiées.", reload) }, "Enregistrer et publier"))))];
  },
});

export const i18nView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Langues, catégories & redirections", desc: "Les langues et catégories ne sont pas encore lues par le site public ; les redirections (internes) sont appliquées en 301.",
  load: async () => { const [l, c, r] = await Promise.all([api("/staff/owner/languages"), api("/staff/owner/categories"), api("/staff/owner/redirects")]); return { l, c, r }; },
  actions: (_, reload) => h("button", { class: "btn primary", type: "button", onClick: async () => { const v = await formDialog("Nouvelle redirection", [{ name: "from", label: "Adresse source (/ancienne-page)", required: true }, { name: "to", label: "Adresse cible (/nouvelle-page)", required: true }]); if (v) act(() => api("/staff/owner/redirects", { method: "POST", body: v }), "Redirection créée.", reload); } }, ico("plus"), "Nouvelle redirection"),
  build({ l, c, r }, reload) {
    const toggles = (rows, url) => table([{ label: "Libellé", key: "label" }, { label: "Code", key: "code" }, { label: "Actif", render: (x) => (x.active ? pill("ok", "Oui") : pill("neutral", "Non")) }, { label: "", render: (x) => h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(url, { method: "POST", body: { code: x.code } }), "Mis à jour.", reload) }, x.active ? "Désactiver" : "Activer") }], rows, { emptyText: "Aucun élément (migration non appliquée ?)." });
    return [h("div", { class: "cols2" }, panel("Langues", null, toggles(l, "/staff/owner/languages/toggle")), panel("Catégories", null, toggles(c, "/staff/owner/categories/toggle"))),
      panel("Redirections", null, table([{ label: "De", key: "from_path" }, { label: "Vers", key: "to_path" }, { label: "Active", render: (x) => (x.active ? pill("ok", "Oui") : pill("neutral", "Non")) }], r, { emptyText: "Aucune redirection." }))];
  },
});

// ---------- Quartiers & pays (listes des formulaires d'annonce, des filtres et des pages « Quartiers ») ----------
export const placesView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Quartiers & pays",
  desc: "Ces listes alimentent le formulaire d'annonce, les filtres de recherche, la carte et les pages « Quartiers ». Un changement est visible sur le site en moins d'une minute.",
  load: () => api("/staff/owner/places"),
  actions: ({ countries }, reload) => [
    h("button", { class: "btn primary", type: "button", onClick: async () => {
      const v = await formDialog("Nouveau quartier", zoneFields(countries), { submit: "Ajouter", intro: "Latitude et longitude en degrés décimaux (ex. 12.639 et -8.002) : elles servent à placer l'annonce sur la carte." });
      if (v) act(() => api("/staff/owner/zones", { method: "POST", body: v }), "Quartier ajouté.", reload);
    } }, ico("plus"), "Ajouter un quartier"),
    h("button", { class: "btn", type: "button", onClick: async () => {
      const v = await formDialog("Ajouter plusieurs quartiers", [
        { name: "countryCode", label: "Pays", type: "select", options: activeCountries(countries), required: true },
        { name: "lines", label: "Un quartier par ligne : Nom;latitude;longitude", type: "textarea", required: true },
      ], { submit: "Ajouter tout", intro: "Exemple : Magnambougou;12.628;-7.953. Tout est refusé si une ligne est incorrecte." });
      if (v) act(async () => { const r = await api("/staff/owner/zones/bulk", { method: "POST", body: v }); toast(`${r.added} quartier(s) ajouté(s).`); }, "Ajout terminé.", reload);
    } }, "Ajouter plusieurs quartiers"),
    h("button", { class: "btn", type: "button", onClick: async () => {
      const v = await formDialog("Nouveau pays", countryFormFields(), { submit: "Ajouter", intro: "Le pays est créé désactivé : ajoutez d'abord ses quartiers, puis activez-le." });
      if (v) act(() => api("/staff/owner/countries", { method: "POST", body: v }), "Pays ajouté (désactivé).", reload);
    } }, "Ajouter un pays"),
  ],
  build({ countries, zones }, reload) {
    const nameOf = (code) => countries.find((c) => c.code === code)?.name ?? code;
    const countryTable = table([
      { label: "Pays", render: (c) => `${c.name} (${c.code})` }, { label: "Devise", key: "currency" }, { label: "Fuseau", key: "timezone" },
      { label: "Quartiers", render: (c) => nf(c.zones) }, { label: "Annonces", render: (c) => nf(c.listings) },
      { label: "Statut", render: (c) => (c.active ? pill("ok", "Actif") : pill("neutral", "Désactivé")) },
      { label: "", render: (c) => h("div", { class: "row" },
        h("button", { class: "btn sm", type: "button", onClick: async () => {
          const v = await formDialog(`Modifier ${c.name}`, countryFormFields(c, true), { submit: "Enregistrer" });
          if (v) act(() => api(`/staff/owner/countries/${c.code}`, { method: "PUT", body: v }), "Pays modifié.", reload);
        } }, "Modifier"),
        h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/owner/countries/${c.code}/active`, { method: "POST", body: { active: !c.active } }), c.active ? "Pays désactivé." : "Pays activé.", reload) }, c.active ? "Désactiver" : "Activer"),
        h("button", { class: "btn sm", type: "button", onClick: async () => { if (await confirmDialog("Supprimer ce pays ?", `${c.name} sera supprimé (possible seulement sans quartier ni annonce).`, "Supprimer")) act(() => api(`/staff/owner/countries/${c.code}/delete`, { method: "POST", body: {} }), "Pays supprimé.", reload); } }, "Supprimer")) },
    ], countries, { emptyText: "Aucun pays." });
    const zoneTable = table([
      { label: "Quartier", key: "name" }, { label: "Pays", render: (z) => nameOf(z.countryCode) },
      { label: "Position", render: (z) => `${z.lat.toFixed(4)} ; ${z.lng.toFixed(4)}` }, { label: "Annonces", render: (z) => nf(z.listings) },
      { label: "Statut", render: (z) => (z.active ? pill("ok", "Proposé") : pill("neutral", "Masqué")) },
      { label: "", render: (z) => h("div", { class: "row" },
        h("button", { class: "btn sm", type: "button", onClick: async () => {
          const v = await formDialog(`Modifier ${z.name}`, zoneFields(countries, z), { submit: "Enregistrer" });
          if (v) act(() => api(`/staff/owner/zones/${z.id}`, { method: "PUT", body: v }), "Quartier modifié.", reload);
        } }, "Modifier"),
        h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/owner/zones/${z.id}/active`, { method: "POST", body: { active: !z.active } }), z.active ? "Quartier masqué." : "Quartier de nouveau proposé.", reload) }, z.active ? "Masquer" : "Afficher"),
        h("button", { class: "btn sm", type: "button", onClick: async () => { if (await confirmDialog("Supprimer ce quartier ?", `${z.name} sera supprimé (refusé s'il a des annonces : masquez-le alors).`, "Supprimer")) act(() => api(`/staff/owner/zones/${z.id}/delete`, { method: "POST", body: {} }), "Quartier supprimé.", reload); } }, "Supprimer")) },
    ], zones, { emptyText: "Aucun quartier." });
    return [panel("Pays", "Un pays désactivé disparaît des formulaires ; ses annonces existantes restent en ligne.", countryTable),
      panel(`Quartiers (${nf(zones.length)})`, "Un quartier masqué n'est plus proposé, mais les annonces qui le portent gardent leur nom et leur position.", zoneTable)];
  },
});
const activeCountries = (countries) => countries.filter((c) => c.active).map((c) => ({ value: c.code, label: c.name }));
function zoneFields(countries, z = null) {
  const options = (z ? countries : countries.filter((c) => c.active)).map((c) => ({ value: c.code, label: c.name }));
  return [
    { name: "name", label: "Nom du quartier", required: true, value: z?.name, max: 60 },
    { name: "countryCode", label: "Pays", type: "select", options, required: true, value: z?.countryCode },
    { name: "lat", label: "Latitude", required: true, value: z?.lat, max: 12 },
    { name: "lng", label: "Longitude", required: true, value: z?.lng, max: 12 },
  ];
}
function countryFormFields(c = null, editing = false) {
  return [
    ...(editing ? [] : [{ name: "code", label: "Code pays (2 lettres, ex. SN)", required: true, max: 2 }]),
    { name: "name", label: "Nom du pays", required: true, value: c?.name, max: 60 },
    { name: "currency", label: "Devise (3 lettres, ex. XOF)", required: true, value: c?.currency, max: 3 },
    { name: "timezone", label: "Fuseau horaire (ex. Africa/Dakar)", required: true, value: c?.timezone, max: 40 },
  ];
}
