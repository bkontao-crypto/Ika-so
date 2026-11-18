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

// Demandes gratuites de mise à la une (repris de l'ancien centre) : mettre à la une ou refuser avec motif.
const featuredRequestsPanel = (reload) => {
  const box = h("div", { class: "stack" });
  const decideFR = (id, action, note) => act(() => api(`/staff/featured-requests/${encodeURIComponent(id)}/decision`, { method: "POST", body: { action, note } }), action === "ACCEPT" ? "Annonce mise à la une." : "Demande refusée, l'annonceur est prévenu.", reload);
  const row = (r, open) => h("article", { class: "card panel row" },
    h("div", { class: "grow stack" }, h("b", null, r.title || "Annonce"), h("p", { class: "muted small" }, `${r.neighborhood || ""} · demandé par ${r.requesterName} · ${dateTime(r.createdAt)}`),
      h("p", { class: "small" }, r.message ? `« ${r.message} »` : "Aucun message."),
      r.status === "PENDING" ? null : h("p", { class: "small muted" }, `${r.status === "ACCEPTED" ? "Acceptée" : "Refusée"}${r.note ? ` — ${r.note}` : ""}`)),
    open ? h("div", { class: "row" },
      h("a", { class: "btn sm", href: `/#/annonce/${encodeURIComponent(r.listingId)}`, target: "_blank", rel: "noopener" }, ico("external"), "Voir l'annonce"),
      h("button", { class: "btn primary sm", type: "button", onClick: () => decideFR(r.id, "ACCEPT", "") }, ico("check"), "Mettre à la une"),
      h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser la demande", [{ name: "note", label: "Motif du refus (obligatoire)", type: "textarea", required: true, max: 500 }], { submit: "Refuser" }); if (v) decideFR(r.id, "REJECT", v.note); } }, "Refuser")) : null);
  async function fill() {
    try {
      const [pending, done] = await Promise.all([api("/staff/featured-requests"), api("/staff/featured-requests?status=DONE")]);
      box.replaceChildren(...(pending.length ? pending.map((r) => row(r, true)) : [empty("Aucune demande de mise à la une en attente.", "check")]),
        done.length ? h("h3", { class: "tiny muted" }, "Traitées récemment") : null, ...done.slice(0, 30).map((r) => row(r, false)));
    } catch (error) { box.replaceChildren(errorBox(error.message || "Chargement impossible.", fill)); }
  }
  fill();
  return panel("Demandes de mise à la une", "Demandes gratuites envoyées par les annonceurs depuis « Mes annonces ». Aucun paiement n'est lié à cette demande.", box);
};

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
      h("div", { class: "stack" }, ...pending), featuredRequestsPanel(reload), h("div", { class: "cols2" }, panel("Signalements ouverts", null, reports), panel("En ligne (20 dernières)", null, online))];
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
            h("button", { class: "btn sm", type: "button", title: "Génère un lien à transmettre à la personne (valable 30 minutes, usage unique)", onClick: async () => {
              try { const link = await api(`/staff/accounts/${encodeURIComponent(r.userId)}/reset-link`, { method: "POST", body: {} }); await formDialog("Lien de réinitialisation", [{ name: "link", label: `Transmettez-le uniquement à ${r.fullName} (valable ${link.validMinutes} min, usage unique)`, value: link.link, max: 500 }], { submit: "Fermer" }); } catch (error) { fail(error); }
            } }, "Lien mot de passe"),
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

// ---------- Permissions du personnel (BUG-004) ----------
// Droits accordés à titre individuel à un administrateur ou un modérateur, en plus de ceux de leur rôle.
// Le contrôle des droits reste côté serveur (permission « permissions.grant » : Superadmin) ; chaque octroi est tracé dans le journal d'audit.
export const permissionsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Permissions du personnel",
  desc: "Droits accordés individuellement à un administrateur ou un modérateur, en plus de ceux de leur rôle. Chaque octroi et chaque retrait est tracé dans le journal d'audit.",
  load: async () => { const [perm, accounts] = await Promise.all([api("/staff/permissions"), api("/staff/accounts")]); return { perm, accounts }; },
  actions: ({ perm, accounts }, reload) => h("button", { class: "btn primary", type: "button", onClick: async () => {
    const staff = accounts.filter((a) => a.staffRole === "ADMIN" || a.staffRole === "MODERATOR");
    if (!staff.length) { toast("Aucun administrateur ni modérateur parmi les derniers comptes.", true); return; }
    const v = await formDialog("Accorder une permission", [
      { name: "userId", label: "Personne", type: "select", options: staff.map((a) => ({ value: a.userId, label: `${a.fullName} · ${a.staffRole}` })), required: true },
      { name: "permission", label: "Permission", type: "select", options: perm.grantable.map((p) => ({ value: p.code, label: `${p.label} (${p.code})` })), required: true },
      { name: "reason", label: "Motif (obligatoire, conservé dans le journal)", type: "textarea", required: true },
      { name: "days", label: "Durée en jours (1 à 365 ; vide = sans échéance)", type: "number", max: 3 },
    ], { submit: "Accorder", intro: "Une permission déjà donnée par le rôle ne peut pas être accordée. Les droits sensibles (rôles du personnel, attribution des permissions, statistiques Superadmin) ne sont jamais délégables." });
    if (v) act(() => api("/staff/permissions/grant", { method: "POST", body: { userId: v.userId, permission: v.permission, reason: v.reason, days: v.days ? Number(v.days) : undefined } }), "Permission accordée.", reload);
  } }, ico("check"), "Accorder une permission"),
  build({ perm, accounts }, reload) {
    const who = new Map(accounts.map((a) => [a.userId, a.fullName]));
    const rows = perm.grants;
    return [
      minis(mini("Attributions en cours", nf(rows.length)), mini("Personnes concernées", nf(new Set(rows.map((r) => r.userId)).size)), mini("Avec échéance", nf(rows.filter((r) => r.expiresAt).length))),
      panel(`Attributions en cours (${rows.length})`, "Les permissions expirées disparaissent d'elles-mêmes de cette liste.", rows.length ? table([
        { label: "Personne", render: (r) => h("div", { class: "item" }, h("b", null, r.name), h("small", null, r.staffRole)) },
        { label: "Permission", render: (r) => h("div", { class: "item" }, h("div", null, pill("info", r.permission)), h("small", null, perm.grantable.find((p) => p.code === r.permission)?.label ?? "")) },
        { label: "Motif", render: (r) => h("span", { class: "small" }, r.reason || "—") },
        { label: "Accordée", render: (r) => h("div", { class: "item" }, h("b", null, dateTime(r.grantedAt)), h("small", null, `par ${who.get(r.grantedBy) ?? r.grantedBy}`)) },
        { label: "Échéance", render: (r) => (r.expiresAt ? pill("gold", dateOnly(r.expiresAt)) : pill("neutral", "Sans échéance")) },
        { label: "", render: (r) => h("button", { class: "btn sm", type: "button", onClick: async () => {
          if (await confirmDialog("Retirer cette permission ?", `${r.name} perdra « ${r.permission} » (ses droits de rôle ne changent pas).`, "Retirer")) {
            act(() => api("/staff/permissions/revoke", { method: "POST", body: { userId: r.userId, permission: r.permission } }), "Permission retirée.", reload);
          }
        } }, "Retirer") },
      ], rows) : empty("Aucune permission accordée à titre individuel : chacun a uniquement les droits de son rôle.", "shield")),
    ];
  },
});

// Demandes annonceurs (repris de l'ancien centre) : approuver, demander des informations, refuser ; pièces consultables.
const APP_DOC = (l) => (l === "PIECE_IDENTITE" ? "pièce d'identité" : l === "RCCM" ? "RCCM" : "justificatif");
async function openAppDoc(appId, doc) {
  try {
    const { fileData } = await api(`/staff/advertiser-applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(doc.id)}`);
    const bytes = Uint8Array.from(atob(fileData.split(",")[1]), (c) => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: fileData.slice(5, fileData.indexOf(";")) })), "_blank", "noopener");
  } catch (error) { fail(error); }
}
const applicationsPanel = (reload) => {
  const box = h("div", { class: "stack" });
  const decide = (a, body, ok) => act(() => api(`/staff/advertiser-applications/${encodeURIComponent(a.id)}/decide`, { method: "POST", body }), ok, reload);
  async function fill() {
    try {
      const apps = await api("/staff/advertiser-applications?status=PENDING");
      box.replaceChildren(...(apps.length ? apps.map((a) => h("article", { class: "card panel stack" },
        h("div", { class: "row" }, h("b", null, a.full_name || a.user_name || a.user_id), pill("neutral", a.type)),
        h("p", { class: "muted small" }, a.data?.description || "Aucune description."),
        h("p", { class: "muted small" }, `Demandé : ${a.display_role_requested || "—"} · ${dateOnly(a.created_at)}`),
        (a.documents || []).length ? h("div", { class: "row" }, a.documents.map((d) => h("button", { class: "btn sm", type: "button", onClick: () => openAppDoc(a.id, d) }, ico("external"), `Voir : ${APP_DOC(d.label)}`))) : h("p", { class: "muted small" }, "Aucune pièce jointe (facultatif)."),
        h("div", { class: "row" },
          h("button", { class: "btn primary sm", type: "button", onClick: () => decide(a, { action: "APPROVE" }, "Demande approuvée.") }, ico("check"), "Approuver"),
          h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Demander des informations", [{ name: "note", label: "Informations à demander au candidat", type: "textarea", required: true, max: 500 }], { submit: "Envoyer" }); if (v) decide(a, { action: "NEED_INFO", note: v.note }, "Informations demandées."); } }, "Demander des infos"),
          h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser la demande", [{ name: "note", label: "Motif du refus", type: "textarea", required: true, max: 500 }], { submit: "Refuser" }); if (v) decide(a, { action: "REJECT", note: v.note }, "Demande refusée."); } }, "Refuser")))) : [empty("Aucune demande annonceur en attente.", "check")]));
    } catch (error) { box.replaceChildren(errorBox(error.message || "Chargement impossible.", fill)); }
  }
  fill();
  return panel("Demandes annonceurs en attente", "Approuver, demander des informations ou refuser. Les pièces se consultent sans être téléchargées.", box);
};

export const agenciesView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Agences & annonceurs", desc: "Profils d'agence et annonceurs vérifiés.", load: () => api("/staff/owner/agencies"),
  build: (rows, reload) => [applicationsPanel(reload), minis(mini("Agences / annonceurs", nf(rows.length)), mini("Vérifiés", nf(rows.filter((r) => r.verifiedAt).length)), mini("Annonces publiées", nf(rows.reduce((a, r) => a + r.published, 0)))),
    panel("Agences", null, table([{ label: "Agence", render: (r) => h("div", { class: "item" }, h("b", null, r.agency ?? r.name), h("small", null, r.name)) }, { label: "Vérifiée", render: (r) => (r.verifiedAt ? pill("ok", dateOnly(r.verifiedAt)) : pill("neutral", "Non")) }, { label: "Statut", render: (r) => statusPill(r.status) },
      { label: "Publiées", key: "published", num: true }, { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "user", r.userId), h("a", { class: "btn sm", href: `/#/annonceur/${encodeURIComponent(r.userId)}`, target: "_blank", rel: "noopener" }, ico("external"), "Profil")) }], rows))],
});

// Pièces justificatives (repris de l'ancien centre) : consultation, acceptation avec contrôle noté, refus motivé.
const openProof = async (id) => {
  try {
    const { fileData } = await api(`/staff/proofs/${encodeURIComponent(id)}/file`);
    const bytes = Uint8Array.from(atob(fileData.split(",")[1]), (c) => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: fileData.slice(5, fileData.indexOf(";")) })), "_blank", "noopener");
  } catch (error) { fail(error); }
};
const proofsPanel = (proofs, reload) => {
  const decide = (id, body, ok) => act(() => api(`/staff/proofs/${encodeURIComponent(id)}/decision`, { method: "POST", body }), ok, reload);
  const card = (p) => h("article", { class: "card panel row" },
    h("div", { class: "grow stack" }, h("div", { class: "row" }, pill("gold", p.kind === "AGENCE" ? "AGENCE" : "DOCUMENT")), h("b", null, p.listingTitle ?? `Agence de ${p.ownerName}`),
      h("p", { class: "muted small" }, `${p.ownerName}${p.declaredDocument ? ` · document déclaré : ${p.declaredDocument}` : ""} · ${dateOnly(p.createdAt ?? p.created_at)}`),
      h("p", { class: "muted small" }, "Un badge n'est donné qu'après un vrai contrôle (cadastre, greffe, mairie…).")),
    h("div", { class: "row" },
      h("button", { class: "btn sm", type: "button", onClick: () => openProof(p.id) }, ico("external"), "Voir la pièce"),
      h("button", { class: "btn primary sm", type: "button", onClick: async () => {
        const fields = [{ name: "note", label: "Qu'avez-vous contrôlé ? (organisme, numéro)", type: "textarea", required: true, max: 300 }];
        if (p.kind === "AGENCE") fields.push({ name: "agencyName", label: "Nom de l'agence", required: true, max: 120 });
        const v = await formDialog("Pièce contrôlée", fields, { submit: "Accepter" });
        if (v) decide(p.id, { action: "ACCEPT", note: v.note, agencyName: v.agencyName ?? "" }, "Pièce acceptée, badge donné.");
      } }, ico("check"), "Contrôlée : accepter"),
      h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser la pièce", [{ name: "note", label: "Motif du refus", type: "textarea", required: true, max: 300 }], { submit: "Refuser" }); if (v) decide(p.id, { action: "REFUSE", note: v.note }, "Pièce refusée."); } }, "Refuser")));
  return panel(`Pièces à contrôler (${proofs.length})`, null, proofs.length ? h("div", { class: "stack" }, proofs.map(card)) : empty("Aucune pièce en attente.", "check"));
};
// Liste noire (repris de l'ancien centre) : téléphones et e-mails bloqués ; les comptes concernés sont bloqués.
const blacklistPanel = (reload) => {
  const box = h("div", { class: "stack" });
  async function fill() {
    try {
      const list = await api("/staff/blacklist");
      box.replaceChildren(
        h("div", { class: "row" }, h("button", { class: "btn primary sm", type: "button", onClick: async () => {
          const v = await formDialog("Ajouter à la liste noire", [
            { name: "kind", label: "Type", type: "select", options: [{ value: "PHONE", label: "Numéro de téléphone" }, { value: "EMAIL", label: "Adresse e-mail" }], value: "PHONE" },
            { name: "value", label: "Numéro (ex. +223 76 12 34 56) ou adresse e-mail", required: true, max: 120 },
            { name: "reason", label: "Motif", type: "textarea", required: true, max: 300 }], { submit: "Ajouter", intro: "Les comptes concernés sont bloqués." });
          if (v) act(() => api("/staff/blacklist", { method: "POST", body: { kind: v.kind, value: v.value.trim(), reason: v.reason } }), "Ajouté. Les comptes concernés sont bloqués.", fill);
        } }, "Ajouter")),
        ...(list.length ? list.map((b) => h("article", { class: "card panel row" }, h("div", { class: "grow" }, h("b", null, `${b.kind === "PHONE" ? "Téléphone" : "E-mail"} ${b.value}`), h("p", { class: "muted small" }, b.reason)),
          h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/blacklist/${encodeURIComponent(b.id)}/remove`, { method: "POST", body: {} }), "Retiré de la liste noire.", fill) }, "Retirer"))) : [empty("Liste noire vide.", "check")]));
    } catch (error) { box.replaceChildren(errorBox(error.message || "Chargement impossible.", fill)); }
  }
  fill();
  return panel("Liste noire", "Téléphones et adresses e-mail bloqués.", box);
};
export const trustView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Confiance & vérifications", desc: "Pièces justificatives à contrôler, alertes, signalements de confiance et liste noire.",
  load: () => api("/staff/trust"),
  build(t, reload) {
    const n = (a) => (a ?? []).length;
    const sec = (title, rows, cols) => panel(`${title} (${n(rows)})`, null, table(cols, rows ?? [], { emptyText: "Rien à traiter." }));
    return [minis(mini("Pièces à contrôler", nf(n(t.proofs))), mini("Alertes ouvertes", nf(n(t.alerts))), mini("Commentaires signalés", nf(n(t.commentReports))), mini("Personnes / avis signalés", nf(n(t.userReports) + n(t.reviewReports)))),
      proofsPanel(t.proofs ?? [], reload),
      h("div", { class: "cols2" },
        sec("Alertes", t.alerts, [{ label: "Alerte", render: (r) => h("div", { class: "item" }, h("b", null, r.kind ?? "Alerte"), h("small", null, r.detail ?? "")) }, { label: "Date", render: (r) => dateOnly(r.createdAt ?? r.created_at) }]),
        blacklistPanel(reload))];
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

// Paiements (repris de l'ancien centre) : tarifs des offres, rapprochement, remboursements notés.
const offersPanel = (offers, reload) => panel("Offres (tarifs)", "Une offre inactive ou à prix 0 n'est jamais proposée au public. Les prix relèvent de la permission « offres.tarifs » (Superadmin par défaut).",
  offers?.length ? h("div", { class: "stack" }, offers.map((o) => h("article", { class: "card panel row" },
    h("div", { class: "grow" }, h("b", null, o.label), h("p", { class: "muted small" }, `${fcfa(o.priceXof)} · ${o.active ? "active" : "inactive"}`)),
    h("div", { class: "row" },
      h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Fixer le prix", [{ name: "price", label: "Prix en FCFA (nombre entier)", type: "number", required: true, max: 12 }], { submit: "Enregistrer" }); if (v) act(() => api(`/staff/offers/${encodeURIComponent(o.code)}`, { method: "POST", body: { priceXof: Number(v.price), active: o.active } }), "Prix enregistré.", reload); } }, "Fixer le prix"),
      h("button", { class: "btn primary sm", type: "button", onClick: () => act(() => api(`/staff/offers/${encodeURIComponent(o.code)}`, { method: "POST", body: { priceXof: o.priceXof, active: !o.active } }), o.active ? "Offre désactivée." : "Offre activée.", reload) }, o.active ? "Désactiver" : "Activer"))))) : empty("Aucune offre.", "wallet"));
const reconcilePanels = (rec, reload) => {
  if (!rec) return [panel("Rapprochement", null, empty("Rapprochement indisponible pour votre rôle.", "wallet"))];
  const money = (x) => fcfa(x);
  const refundForm = async (p) => {
    const v = await formDialog("Noter un remboursement", [
      { name: "reason", label: "Motif du remboursement (obligatoire)", type: "textarea", required: true, max: 300 },
      { name: "refundRef", label: "Référence fournisseur (facultatif)", max: 120 }], { submit: "Confirmer le remboursement", intro: "Confirmez que l'argent a bien été rendu chez le fournisseur. Les jours donnés par ce paiement seront retirés de l'annonce." });
    if (v) act(() => api(`/staff/payments/${encodeURIComponent(p.id)}/refund`, { method: "POST", body: { reason: v.reason, refundRef: v.refundRef ?? "" } }), "Remboursement noté.", reload);
  };
  return [
    panel("À vérifier", `Payé au total : ${money(rec.paid.totalXof)} en ${rec.paid.count} paiement(s).${rec.repaired ? ` ${rec.repaired} paiement(s) réparé(s) à l'ouverture.` : ""}${rec.expired ? ` ${rec.expired} paiement(s) en attente depuis plus de 24 h marqué(s) expiré(s).` : ""}`,
      table([{ label: "Statut", key: "status" }, { label: "Montant", render: (p) => money(p.amountXof), num: true }, { label: "Annonce", render: (p) => tracer(ctx0, "listing", p.listingId, "Retracer") }, { label: "Date", render: (p) => dateTime(p.createdAt) }, { label: "Référence", render: (p) => h("small", null, p.id) }], rec.toReview, { emptyText: "Rien à vérifier." })),
    panel(`Remboursements à confirmer chez le fournisseur (${rec.refundsToConfirm.length})`, `Déjà remboursé : ${money(rec.refunded.totalXof)} en ${rec.refunded.count} paiement(s). Un remboursement n'est « confirmé » que lorsque le fournisseur le signale.`,
      table([{ label: "Montant", render: (p) => money(p.amountXof), num: true }, { label: "Motif", render: (p) => h("small", null, p.refundReason ?? "—") }, { label: "Noté le", render: (p) => dateTime(p.refundedAt) }, { label: "Référence", render: (p) => h("small", null, p.id) }], rec.refundsToConfirm, { emptyText: "Rien à rapprocher." })),
    panel("Noter un remboursement", "À faire une fois l'argent rendu chez le fournisseur.",
      rec.refundable.length ? h("div", { class: "stack" }, rec.refundable.map((p) => h("article", { class: "card panel row" },
        h("div", { class: "grow" }, h("b", null, `${money(p.amountXof)} · ${p.days} jours`), h("p", { class: "muted small" }, `annonce ${p.listingId} · ${dateTime(p.paidAt ?? p.createdAt)}`)),
        h("button", { class: "btn sm", type: "button", onClick: () => refundForm(p) }, "Noter un remboursement")))) : empty("Aucun paiement confirmé à rembourser.", "wallet")),
  ];
};
let ctx0 = null;
export const paymentsView = (ctx) => { ctx0 = ctx; return page(ctx, {
  eyebrow: "PILOTAGE", title: "Paiements & finances", desc: "Encaissements, tarifs des offres, rapprochement et remboursements.",
  load: async () => { const [o, s, rec, offers] = await Promise.all([api("/staff/owner/overview"), api("/staff/owner/subscriptions"), api("/staff/payments/reconcile").catch(() => null), api("/staff/offers").catch(() => [])]); return { o, s, rec, offers }; },
  build({ o, s, rec, offers }, reload) {
    const f = o.finance;
    return [minis(mini("Paiements réussis", nf(f.paymentsPaid)), mini("Montant encaissé", fcfa(Number(f.amountPaid))), mini("En attente", nf(f.paymentsPending)), mini("Statuts suivis", nf(Object.keys(s.byStatus).length))),
      offersPanel(offers, reload),
      h("div", { class: "cols2" }, panel("Par statut", null, bars(Object.entries(s.byStatus).map(([k, v]) => ({ label: k, value: v.count })))),
        panel("Montants par statut", null, table([{ label: "Statut", render: (r) => statusPill(r[0]) }, { label: "Nombre", render: (r) => nf(r[1].count), num: true }, { label: "Total", render: (r) => fcfa(r[1].total), num: true }], Object.entries(s.byStatus)))),
      ...reconcilePanels(rec, reload),
      panel("20 derniers paiements", null, table([{ label: "Formule", key: "label" }, { label: "Montant", render: (r) => fcfa(r.amount), num: true }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Date", render: (r) => dateTime(r.createdAt) }], s.recent, { emptyText: "Aucun paiement." }))];
  },
}); };

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

// Page d'accueil (repris de l'ancien centre) : tous les textes, couleurs, avantages et photo d'arrière-plan (import ou URL).
const HOME_FIELDS = [
  ["badge", "Petit bandeau supérieur", "L’immobilier au Mali, en toute confiance"],
  ["titleLine1", "Titre – première ligne", "Trouvez votre"],
  ["titleLine2", "Titre – deuxième ligne", "bien immobilier idéal"],
  ["subtitle", "Texte descriptif", "Maisons, appartements…"],
  ["assurance1", "Avantage 1", "Annonces modérées"],
  ["assurance2", "Avantage 2", "Téléphones vérifiés"],
  ["assurance3", "Avantage 3", "Contact direct"],
  ["trustTitle", "Titre du macaron confiance", "Confiance"],
  ["trustLine1", "Ligne 1 du macaron", "Sécurité"],
  ["trustLine2", "Ligne 2 du macaron", "Sérénité"],
  ["overlayColor", "Couleur de l’overlay (hex)", "#091f19"],
  ["overlayOpacity", "Opacité de l’overlay (0 à 1)", "0.75"],
  ["accentColor", "Couleur d’accent (titre, badge)", "#C9EF75"],
  ["textColor", "Couleur du texte principal", "#ffffff"],
];
export const homepageView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Page d’accueil", desc: "Textes, couleurs, avantages et photo d’arrière-plan du site public.",
  load: async () => api("/homepage-settings"),
  actions: () => h("a", { class: "btn", href: "/", target: "_blank", rel: "noopener" }, ico("external"), "Voir le site"),
  build(s, reload) {
    const original = { ...s };
    const draft = { ...s };
    const inputs = {};
    const imageInput = h("input", { class: "input", maxlength: "1200", placeholder: "/media/ma-photo.jpg", value: draft.image ?? "" });
    inputs.image = imageInput;
    imageInput.addEventListener("input", () => { draft.image = imageInput.value; });
    const uploadStatus = h("span", { class: "small muted", role: "status" }, "JPEG, PNG ou WebP · 2 Mo maximum.");
    const fileInput = h("input", { class: "input", type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "Choisir une photo depuis le téléphone" });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0]; if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) { uploadStatus.textContent = "Format non accepté ou fichier supérieur à 2 Mo."; fileInput.value = ""; return; }
      try {
        uploadStatus.textContent = "Envoi de la photo…";
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Lecture de la photo impossible.")); reader.readAsDataURL(file); });
        const result = await api("/staff/homepage-image", { method: "POST", body: { dataUrl } });
        draft.image = result.image; imageInput.value = result.image; uploadStatus.textContent = "Photo importée. Pensez à enregistrer.";
      } catch (error) { uploadStatus.textContent = error.message || "Envoi impossible."; }
      fileInput.value = "";
    });
    const fieldNodes = HOME_FIELDS.map(([key, label, placeholder]) => {
      const i = h("input", { class: "input", maxlength: "300", placeholder, value: draft[key] ?? "" });
      inputs[key] = i;
      i.addEventListener("input", () => { draft[key] = i.value; });
      return h("label", { class: "field" }, h("span", null, label), i);
    });
    const save = h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/homepage-settings", { method: "PUT", body: draft }), "Page d’accueil enregistrée.", reload) }, "Enregistrer les modifications");
    const reset = h("button", { class: "btn", type: "button", onClick: () => { Object.keys(draft).forEach((k) => delete draft[k]); Object.assign(draft, original); for (const [k, el] of Object.entries(inputs)) el.value = original[k] ?? ""; uploadStatus.textContent = "Modifications locales annulées."; } }, "Annuler les modifications");
    return [panel("Photo d’arrière-plan", null, h("div", { class: "stack" },
        h("label", { class: "field" }, h("span", null, "Adresse de la photo (importée, ou fichier /media/… du site)"), imageInput),
        h("div", { class: "field" }, h("span", null, "Importer depuis mon téléphone"), fileInput, uploadStatus))),
      panel("Textes et couleurs", null, h("div", { class: "form two" }, ...fieldNodes)),
      h("div", { class: "row" }, save, reset)];
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
