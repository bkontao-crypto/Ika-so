// Modules du Owner Control Center. Chaque vue lit les endpoints existants (/staff/owner/*, /staff/*) : le contrôle des droits reste côté serveur.
import { api, h, ico, panel, empty, skeletons, errorBox, table, bars, pill, statusPill, nf, fcfa, dateTime, dateOnly, ago, initials, openDrawer, closeDrawer, formDialog, confirmDialog, act, fail, toast, CAT_COLORS } from "./ui.js";
import { previewDocument } from "./proof-viewer.js";
import { proofHistoryPanel } from "./v-proof-history.js";

/** Gabarit : en-tête + chargement asynchrone + reprise sur erreur. build(data, reload) → nœuds. */
function page(ctx, { eyebrow, title, desc, load, build, actions }) {
  const root = h("div", { class: "view" });
  const head = (extra) => h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, eyebrow), h("h1", null, title), desc ? h("p", null, desc) : null), h("div", { class: "actions" }, extra ?? null));
  async function reload() {
    root.replaceChildren(head(), skeletons(2, 120));
    try { const data = await load(); root.replaceChildren(head(actions?.(data, reload)), ...[].concat(build(data, reload)).filter((n) => n != null && n !== false)); } catch (e) { if (!e.stale) root.replaceChildren(head(), errorBox(e.message || "Chargement impossible.", reload)); }
  }
  reload();
  return root;
}
const mini = (l, v, sub) => h("div", { class: "card mini" }, h("small", null, l), h("strong", null, v), sub ? h("small", null, sub) : null);
const minis = (...m) => h("div", { class: "mini-stats" }, m);
const tracer = (ctx, type, id, label = "Retracer") => h("button", { class: "btn sm", type: "button", onClick: () => ctx.go(`#/trace/${type}/${encodeURIComponent(id)}`) }, ico("route"), label);

// Demandes gratuites de mise à la une (repris de l'ancien centre) : mettre à la une ou refuser avec motif.
const featuredRequestsPanel = (reload) => {
  const box = h("div", { class: "stack" });
  const decideFR = (id, action, note, months) => act(() => api(`/staff/featured-requests/${encodeURIComponent(id)}/decision`, { method: "POST", body: { action, note, months } }), action === "ACCEPT" ? "Annonce mise à la une." : "Demande refusée, l'annonceur est prévenu.", reload);
  const row = (r, open, max = 1) => h("article", { class: "card panel row" },
    h("div", { class: "grow stack" }, h("b", null, r.title || "Annonce"), h("p", { class: "muted small" }, `${r.neighborhood || ""} · demandé par ${r.requesterName} · ${dateTime(r.createdAt)}`),
      h("p", { class: "small" }, r.message ? `« ${r.message} »` : "Aucun message."),
      r.status === "PENDING" ? null : h("p", { class: "small muted" }, `${r.status === "ACCEPTED" ? "Acceptée" : "Refusée"}${r.note ? ` — ${r.note}` : ""}`)),
    open ? h("div", { class: "row" },
      h("a", { class: "btn sm", href: `/#/annonce/${encodeURIComponent(r.listingId)}`, target: "_blank", rel: "noopener" }, ico("external"), "Voir l'annonce"),
      h("select", { "aria-label": "Durée de mise à la une" }, ...Array.from({ length: max }, (_, i) => h("option", { value: String(i + 1) }, `${i + 1} mois`))),
      h("button", { class: "btn primary sm", type: "button", onClick: (e) => decideFR(r.id, "ACCEPT", "", Number(e.currentTarget.parentElement.querySelector("select").value)) }, ico("check"), "Mettre à la une"),
      h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser la demande", [{ name: "note", label: "Motif du refus (obligatoire)", type: "textarea", required: true, max: 500 }], { submit: "Refuser" }); if (v) decideFR(r.id, "REJECT", v.note); } }, "Refuser")) : null);
  async function fill() {
    try {
      const [pending, done, offers] = await Promise.all([api("/staff/featured-requests"), api("/staff/featured-requests?status=DONE"), api("/offers").catch(() => ({}))]);
      const max = offers?.manualFeaturedMaxMonths ?? 1;
      box.replaceChildren(...(pending.length ? pending.map((r) => row(r, true, max)) : [empty("Aucune demande de mise à la une en attente.", "check")]),
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
    return [minis(mini("Publiées", nf(s.published)), mini("En attente", nf(s.pending)), mini("Signalements ouverts", nf(s.openReports)), mini("Nouvelles · 7 jours", nf(s.newListings7d))),
      h("div", { class: "stack" }, ...pending), featuredRequestsPanel(reload), h("div", { class: "cols2" }, panel("Signalements ouverts", null, reports), panel("En ligne (20 dernières)", null, online))];
  },
});

export const usersView = (ctx) => {
  let q = "";
  return page(ctx, {
    eyebrow: "PILOTAGE", title: "Utilisateurs & comptes", desc: "100 derniers comptes. Les numéros sont masqués ; le dossier de traçage donne tout l'historique d'un compte.",
    load: () => api("/staff/accounts"),
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
            (ctx.isSuperadmin() ? h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Rôle équipe", [{ name: "role", label: "Rôle", type: "select", options: ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"], value: r.staffRole }], { intro: `${r.fullName} · le dernier SUPERADMIN actif ne peut pas être rétrogradé.` }); if (v) act(() => api(`/staff/accounts/${encodeURIComponent(r.userId)}/role`, { method: "POST", body: v }), "Rôle mis à jour.", reload); } }, "Rôle") : null)) }], f, { emptyText: "Aucun compte ne correspond." }));
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

// ---------- Délégations de modules (DEC-003) ----------
// Le Superadmin confie des modules du centre de contrôle à un administrateur. Chaque case coche/décoche aussitôt ; le serveur reste la barrière réelle.
const DELEG_GROUPS = [
  ["Pilotage", [["dashboard", "Tableau de bord"], ["overview", "Vue générale"], ["activity", "Mouvements du site"], ["charts", "Graphiques"], ["trends", "Tendances"], ["regions", "Régions"], ["report", "Rapports"], ["report.pdf", "Rapport complet PDF"], ["premium-funnel", "Entonnoir Premium"], ["subscriptions", "Abonnements"]]],
  ["Surveillance", [["monitoring", "Surveillance"], ["health", "État du système"], ["incidents", "Incidents"]]],
  ["Clients et croissance", [["agencies", "Agences et annonceurs"], ["crm", "CRM"], ["pipeline", "Pipeline"], ["visits", "Visites"], ["marketing", "Marketing"], ["campaigns", "Campagnes"], ["partners", "Partenaires"]]],
  ["Contenu et confiance", [["moderation", "Annonces et modération"], ["reviews", "Avis"], ["trust", "Confiance et vérifications"], ["complaints", "Réclamations"], ["imports", "Imports"], ["duplicates", "Doublons"]]],
  ["Comptes et finances", [["users", "Utilisateurs et comptes"], ["payments", "Paiements"]]],
];
export const delegationsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Délégations de modules",
  desc: "Confiez à un administrateur l'accès à certains modules du centre de contrôle. Seul le Superadmin peut le faire ; sans délégation, un administrateur n'a accès à aucun module.",
  load: async () => { const [rows, accounts] = await Promise.all([api("/staff/owner/delegations"), api("/staff/accounts")]); return { rows, accounts }; },
  build({ rows, accounts }, reload) {
    const admins = accounts.filter((a) => a.staffRole === "ADMIN");
    const byUser = new Map();
    for (const r of rows) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set()); byUser.get(r.user_id).add(r.module); }
    const total = DELEG_GROUPS.reduce((n, [, m]) => n + m.length, 0);
    if (!admins.length) return empty("Aucun administrateur parmi les derniers comptes. Nommez-en un depuis « Utilisateurs & comptes » pour pouvoir lui déléguer des modules.", "users");
    return [
      minis(mini("Administrateurs", nf(admins.length)), mini("Avec au moins un module", nf(admins.filter((a) => byUser.get(a.userId)?.size).length)), mini("Modules délégables", nf(total))),
      ...admins.map((a) => {
        const have = byUser.get(a.userId) ?? new Set();
        const toggle = (module, on, box) => { box.disabled = true; act(() => api(on ? "/staff/owner/delegations" : "/staff/owner/delegations/revoke", { method: "POST", body: { userId: a.userId, module } }), on ? "Module délégué." : "Délégation retirée.", reload); };
        const setAll = async (on) => {
          const todo = DELEG_GROUPS.flatMap(([, m]) => m.map(([k]) => k)).filter((k) => have.has(k) !== on);
          if (!todo.length) return;
          if (!(await confirmDialog(on ? "Tout déléguer ?" : "Tout retirer ?", `${a.fullName} ${on ? "recevra" : "perdra"} ${todo.length} module(s).`, on ? "Tout déléguer" : "Tout retirer"))) return;
          act(async () => { for (const k of todo) await api(on ? "/staff/owner/delegations" : "/staff/owner/delegations/revoke", { method: "POST", body: { userId: a.userId, module: k } }); }, on ? "Modules délégués." : "Délégations retirées.", reload);
        };
        const groups = DELEG_GROUPS.map(([name, mods]) => h("div", { class: "stack", style: "gap:6px;min-width:210px;flex:1" },
          h("b", { class: "small" }, `${name} · ${mods.filter(([k]) => have.has(k)).length}/${mods.length}`),
          ...mods.map(([k, label]) => { const box = h("input", { type: "checkbox", style: "accent-color:#087448;width:17px;height:17px" }); box.checked = have.has(k); box.addEventListener("change", () => toggle(k, box.checked, box));
            return h("label", { class: "row", style: "gap:8px;align-items:center;cursor:pointer" }, box, h("span", null, label)); })));
        return panel(`${a.fullName}`, have.size ? `${have.size} module(s) délégué(s) sur ${total}` : "Aucun module délégué : cet administrateur n'a accès à aucun module du centre de contrôle.",
          h("div", { class: "stack" },
            h("div", { class: "row", style: "flex-wrap:wrap;gap:20px;align-items:flex-start" }, ...groups),
            h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: () => setAll(true) }, "Tout déléguer"), h("button", { class: "btn sm", type: "button", onClick: () => setAll(false) }, "Tout retirer"))));
      }),
      panel("Modules réservés au Superadmin", "Jamais délégables : sauvegardes et restaurations, offres, réglages, logo, mentions légales, SEO, assistance IA, journal de sécurité, pays, délégations.", null),
    ];
  },
});

// Demandes annonceurs (repris de l'ancien centre) : approuver, demander des informations, refuser ; pièces consultables.
const APP_DOC = (l) => (l === "PIECE_IDENTITE" ? "pièce d'identité" : l === "RCCM" ? "RCCM" : "justificatif");
async function openAppDoc(appId, doc) {
  try {
    const { fileData } = await api(`/staff/advertiser-applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(doc.id)}`);
    await previewDocument(fileData, APP_DOC(doc.label));
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
  eyebrow: "PILOTAGE", title: "Agences & annonceurs", desc: "Annonceurs approuvés (agences et particuliers) et agences vérifiées.", load: () => api("/staff/owner/agencies"),
  build: (rows, reload) => [applicationsPanel(reload),
    minis(mini("Annonceurs & agences", nf(rows.length)), mini("Approuvés", nf(rows.filter((r) => r.approvedAt).length)), mini("Agences vérifiées", nf(rows.filter((r) => r.verifiedAt).length)), mini("Annonces publiées", nf(rows.reduce((a, r) => a + r.published, 0)))),
    panel("Annonceurs & agences", `${rows.length} compte${rows.length > 1 ? "s" : ""}`, table([
      { label: "Annonceur", render: (r) => h("div", { class: "item" }, h("b", null, r.agency ?? r.name), h("small", null, [r.agency ? r.name : null, r.displayRole].filter(Boolean).join(" · "))) },
      { label: "Type", render: (r) => (r.kind === "AGENCE" ? pill("info", "Agence") : r.kind === "PARTICULIER" ? pill("neutral", "Particulier") : "—") },
      { label: "Approuvé", render: (r) => (r.approvedAt ? pill("ok", dateOnly(r.approvedAt)) : pill("neutral", "Non")) },
      { label: "Badge agence", render: (r) => (r.verifiedAt ? pill("ok", dateOnly(r.verifiedAt)) : pill("neutral", "Non")) },
      { label: "Statut", render: (r) => statusPill(r.status) },
      { label: "Publiées", key: "published", num: true },
      { label: "", render: (r) => h("div", { class: "row" }, tracer(ctx, "user", r.userId), h("a", { class: "btn sm", href: `/#/annonceur/${encodeURIComponent(r.userId)}`, target: "_blank", rel: "noopener" }, ico("external"), "Profil")) }], rows, { emptyText: "Aucun annonceur approuvé pour le moment." }))],
});

// Pièces justificatives (repris de l'ancien centre) : consultation, acceptation avec contrôle noté, refus motivé.
const openProof = async (id, title) => {
  try {
    const { fileData } = await api(`/staff/proofs/${encodeURIComponent(id)}/file`);
    await previewDocument(fileData, title || "Pièce justificative");
  } catch (error) { fail(error); }
};
const proofsPanel = (proofs, reload) => {
  const decide = (id, body, ok) => act(() => api(`/staff/proofs/${encodeURIComponent(id)}/decision`, { method: "POST", body }), ok, reload);
  const card = (p) => h("article", { class: "card panel row" },
    h("div", { class: "grow stack" }, h("div", { class: "row" }, pill("gold", p.kind === "AGENCE" ? "AGENCE" : "DOCUMENT")), h("b", null, p.listingTitle ?? `Agence de ${p.ownerName}`),
      h("p", { class: "muted small" }, `${p.ownerName}${p.declaredDocument ? ` · document déclaré : ${p.declaredDocument}` : ""} · ${dateOnly(p.createdAt ?? p.created_at)}`),
      h("p", { class: "muted small" }, "Un badge n'est donné qu'après un vrai contrôle (cadastre, greffe, mairie…).")),
    h("div", { class: "row" },
      h("button", { class: "btn sm", type: "button", onClick: () => openProof(p.id, p.listingTitle ?? `Agence de ${p.ownerName}`) }, ico("eye"), "Voir la pièce"),
      h("button", { class: "btn primary sm", type: "button", onClick: async () => {
        const fields = [{ name: "note", label: "Qu'avez-vous contrôlé ?", type: "textarea", required: true, min: 3, max: 300, hint: "Exemple : titre foncier n° 1234, vérifié au cadastre de Bamako le 19/11." }];
        if (p.kind === "AGENCE") fields.push({ name: "agencyName", label: "Nom de l'agence", required: true, min: 2, max: 120 });
        const v = await formDialog("Pièce contrôlée", fields, { submit: "Accepter" });
        if (v) decide(p.id, { action: "ACCEPT", note: v.note, agencyName: v.agencyName ?? "" }, "Pièce acceptée, badge donné.");
      } }, ico("check"), "Contrôlée : accepter"),
      h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Refuser la pièce", [{ name: "note", label: "Motif du refus (transmis au propriétaire)", type: "textarea", required: true, min: 3, max: 300, hint: "Exemple : document illisible, numéro introuvable au cadastre." }], { submit: "Refuser" }); if (v) decide(p.id, { action: "REFUSE", note: v.note }, "Pièce refusée."); } }, "Refuser")));
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
      proofHistoryPanel(t.proofs ?? []),
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
  load: async () => { const [o, s, rec, offers, pr] = await Promise.all([api("/staff/owner/overview").catch(() => null), api("/staff/owner/subscriptions").catch(() => null), api("/staff/payments/reconcile").catch(() => null), api("/staff/offers").catch(() => []), api("/staff/premium-requests").catch(() => null)]); return { o, s, rec, offers, pr }; },
  build({ o, s, rec, offers, pr }, reload) {
    // Les chiffres d'encaissement dépendent des modules « Vue générale » et « Abonnements » ; sans eux, seules les sections « Paiements » s'affichent.
    const f = o?.finance;
    const head = f && s ? [minis(mini("Paiements réussis", nf(f.paymentsPaid)), mini("Montant encaissé", fcfa(Number(f.amountPaid))), mini("En attente", nf(f.paymentsPending)), mini("Comptes Premium actifs", nf(s.premium?.active ?? 0)), mini("Premium à la main · 30 j", nf(s.premium?.manual30d ?? 0)))] : [];
    const grants = s?.grants?.length ? [panel("Premium accordé à la main", "Demandes approuvées et attributions, hors paiement en ligne", table([{ label: "Annonceur", render: (r) => r.name || "—" }, { label: "Jours", render: (r) => nf(r.days), num: true }, { label: "Motif", key: "reason" }, { label: "Date", render: (r) => dateTime(r.createdAt) }], s.grants))] : [];
    const stats = f && s ? [h("div", { class: "cols2" }, panel("Par statut", null, bars(Object.entries(s.byStatus).map(([k, v]) => ({ label: k, value: v.count })))),
        panel("Montants par statut", null, table([{ label: "Statut", render: (r) => statusPill(r[0]) }, { label: "Nombre", render: (r) => nf(r[1].count), num: true }, { label: "Total", render: (r) => fcfa(r[1].total), num: true }], Object.entries(s.byStatus))))] : [];
    const recent = s ? [panel("20 derniers paiements", null, table([{ label: "Formule", key: "label" }, { label: "Montant", render: (r) => fcfa(r.amount), num: true }, { label: "Statut", render: (r) => statusPill(r.status) }, { label: "Date", render: (r) => dateTime(r.createdAt) }], s.recent, { emptyText: "Aucun paiement." }))] : [];
    return [...head, ...(pr ? [premiumRequestsPanel(pr, reload)] : []), ...grants, offersPanel(offers, reload), ...stats, ...reconcilePanels(rec, reload), ...recent];
  },
}); };

// ---------- Demandes Premium à la main (paiement en ligne fermé) ----------
const PREMIUM_STATUS = { PENDING: "En attente", APPROVED: "Approuvée", REJECTED: "Refusée", CANCELLED: "Retirée" };
const PREMIUM_ACCOUNT = { AGENCY: "Agence", INDIVIDUAL: "Particulier", OTHER: "Autre" };
/** Les 3 étapes d'étude : indépendantes, validables en même temps ; chaque validation est tracée à la personne. */
const STEP_HINT = { 1: "Lire le dossier et la demande", 2: "Contrôler l'identité, le numéro, les annonces", 3: "Confirmer la décision avec les éléments réunis" };
function premiumSteps(r, reload) {
  const byStep = new Map((r.steps ?? []).map((x) => [x.step, x]));
  const open = r.status === "PENDING";
  return h("div", { class: "pstep-grid" }, [1, 2, 3].map((n) => {
    const done = byStep.get(n);
    const label = ["Étude", "Vérification", "Confirmation"][n - 1];
    return h("div", { class: `pstep ${done ? "done" : ""}` },
      h("div", { class: "row" }, pill(done ? "ok" : "neutral", done ? "✓ Validée" : `Étape ${n}`), h("b", null, label)),
      h("small", null, done ? `Par ${done.doneByName} · ${dateTime(done.doneAt)}${done.note ? ` · « ${done.note} »` : ""}` : STEP_HINT[n]),
      open && !done ? h("button", { class: "btn sm", type: "button", onClick: async () => {
        const v = await formDialog(`Valider l'étape ${n} : ${label}`, [{ name: "note", label: "Observation (facultatif)", type: "textarea", max: 300 }], { intro: "Votre nom sera enregistré dans l'historique du site avec cette validation.", submit: "Valider l'étape" });
        if (v) act(() => api(`/staff/premium-requests/${encodeURIComponent(r.id)}/steps/${n}`, { method: "POST", body: { note: v.note } }), `Étape ${n} validée.`, reload);
      } }, "Valider cette étape") : null,
      open && done ? h("button", { class: "btn sm", type: "button", onClick: async () => {
        const v = await formDialog(`Retirer la validation de l'étape ${n}`, [{ name: "note", label: "Motif (obligatoire)", type: "textarea", max: 300 }], { submit: "Retirer" });
        if (v) act(() => api(`/staff/premium-requests/${encodeURIComponent(r.id)}/steps/${n}/undo`, { method: "POST", body: { note: v.note } }), "Validation retirée.", reload);
      } }, "Retirer") : null);
  }));
}
/** Suivi de remboursement d'un dossier refusé après paiement : 3 étapes, la 3e validée clôt le suivi et informe l'annonceur. */
const REFUND_HINT = { 1: "Retrouver le paiement et confirmer le montant", 2: "Rembourser chez le fournisseur de paiement", 3: "Clôturer : l'annonceur est averti" };
function refundSteps(f, reload) {
  const byStep = new Map((f.steps ?? []).map((x) => [x.step, x]));
  const open = f.status === "OPEN";
  return h("div", { class: "pstep-grid" }, [1, 2, 3].map((n) => {
    const done = byStep.get(n);
    const label = ["Paiement vérifié", "Remboursement effectué", "Annonceur informé"][n - 1];
    const url = `/staff/premium-refunds/${encodeURIComponent(f.id)}/steps/${n}`;
    return h("div", { class: `pstep ${done ? "done" : ""}` },
      h("div", { class: "row" }, pill(done ? "ok" : "neutral", done ? "✓ Validée" : `Étape ${n}`), h("b", null, label)),
      h("small", null, done ? `Par ${done.doneByName} · ${dateTime(done.doneAt)}${done.note ? ` · « ${done.note} »` : ""}` : REFUND_HINT[n]),
      open && !done ? h("button", { class: "btn sm", type: "button", onClick: async () => {
        const v = await formDialog(`Valider l'étape ${n} : ${label}`, [{ name: "note", label: "Observation ou référence (facultatif)", type: "textarea", max: 300 }], { intro: "Votre nom sera enregistré dans l'historique du site avec cette validation.", submit: "Valider l'étape" });
        if (v) act(() => api(url, { method: "POST", body: { note: v.note } }), `Étape ${n} validée.`, reload);
      } }, "Valider cette étape") : null,
      open && done ? h("button", { class: "btn sm", type: "button", onClick: async () => {
        const v = await formDialog(`Retirer la validation de l'étape ${n}`, [{ name: "note", label: "Motif (obligatoire)", type: "textarea", max: 300 }], { submit: "Retirer" });
        if (v) act(() => api(`${url}/undo`, { method: "POST", body: { note: v.note } }), "Validation retirée.", reload);
      } }, "Retirer") : null);
  }));
}
function premiumDecisionControls(r, max, reload) {
  const complete = (r.steps ?? []).length === 3;
  const sel = h("select", { "aria-label": "Durée accordée" }, ...Array.from({ length: max }, (_, i) => h("option", { value: String(i + 1) }, `${i + 1} mois`)));
  sel.value = String(Math.min(r.months, max));
  const approve = h("button", { class: "btn sm primary", type: "button", disabled: !complete, title: complete ? "" : "Validez d'abord les 3 étapes", onClick: () => act(() => api(`/staff/premium-requests/${encodeURIComponent(r.id)}/decision`, { method: "POST", body: { action: "APPROVE", months: Number(sel.value) } }), r.paid ? "Compte certifié." : "Premium approuvé.", reload) }, r.paid ? "Finaliser (certifier)" : "Approuver et activer");
  return h("div", { class: "stack" },
    r.paid ? h("small", null, "Dossier payé : le Premium payé est déjà actif.") : h("div", { class: "row" }, h("small", null, "Durée accordée"), sel),
    h("div", { class: "row" }, approve,
      h("button", { class: "btn sm", type: "button", onClick: () => { const note = window.prompt(r.paid ? "Motif du refus (transmis à l'annonceur ; un suivi de remboursement en 3 étapes sera ouvert) :" : "Motif du refus (transmis à l'annonceur) :"); if (note === null) return; if (note.trim().length < 3) { toast("Le motif est obligatoire (3 caractères au moins)."); return; } act(() => api(`/staff/premium-requests/${encodeURIComponent(r.id)}/decision`, { method: "POST", body: { action: "REJECT", note: note.trim() } }), "Demande refusée.", reload); } }, "Refuser")));
}
export function premiumRequestsPanel(data, reload) {
  const max = data.policy?.manualPremiumMaxMonths ?? 3;
  const list = panel("Demandes Premium", `${(data.requests ?? []).filter((r) => r.status === "PENDING").length} en attente · 3 étapes à valider avant approbation · délai annoncé : ${data.policy?.reviewDelayDays ?? 3} jours`, table([
    { label: "Annonceur", render: (r) => h("div", { class: "item" }, h("b", null, r.name || "—"), h("small", null, r.email || ""), r.certified === undefined ? null : h("div", null, r.certified ? pill("ok", "Badge agence / titre") : pill("neutral", "Sans badge agence / titre")), h("small", null, `${PREMIUM_ACCOUNT[r.accountType] ?? "—"}${r.phone ? ` · ${r.phone}` : ""}`), r.message ? h("small", null, `« ${r.message} »`) : null) },
    { label: "Demandé", render: (r) => `${r.paid ? "Payé" : `${r.months} mois`} · ${dateTime(r.createdAt)}${r.reviewDueAt && r.status === "PENDING" ? ` · réponse avant le ${dateOnly(r.reviewDueAt)}` : ""}`, num: true },
    { label: "Étapes", render: (r) => ((r.steps ?? []).length || r.status === "PENDING" ? pill((r.steps ?? []).length === 3 ? "ok" : "neutral", `${(r.steps ?? []).length}/3`) : h("small", { class: "muted" }, "—")) },
    { label: "Statut", render: (r) => pill(r.status === "APPROVED" ? "ok" : "neutral", PREMIUM_STATUS[r.status] ?? r.status) },
    { label: "", render: (r) => (r.status === "PENDING" ? h("small", { class: "muted" }, "Dossier ci-dessous") : h("div", { class: "item" }, h("small", { class: "muted" }, r.decidedAt ? `${dateTime(r.decidedAt)}${r.status === "APPROVED" ? ` · ${r.grantedMonths} mois` : ""}` : (r.cancelledAt ? dateTime(r.cancelledAt) : "")), r.decidedNote ? h("small", null, r.decidedNote) : null)) },
  ], data.requests ?? [], { emptyText: "Aucune demande Premium." }));
  const cards = (data.requests ?? []).filter((r) => r.status === "PENDING").map((r) => panel(`Dossier de ${r.name || "l'annonceur"}`,
    `${r.paid ? "Payé : dossier à étudier" : `${r.months} mois demandés`} · reçu le ${dateTime(r.createdAt)}${r.reviewDueAt ? ` · réponse avant le ${dateOnly(r.reviewDueAt)}` : ""}${r.message ? ` · « ${r.message} »` : ""}`,
    h("div", { class: "stack" }, premiumSteps(r, reload), premiumDecisionControls(r, max, reload))));
  const refunds = (data.refunds ?? []).filter((f) => f.status === "OPEN").map((f) => panel(`Remboursement à suivre : ${f.name || "annonceur"}`,
    `Dossier refusé après paiement : le Premium payé reste actif · suivi ouvert le ${dateTime(f.openedAt)} · aucun remboursement automatique`,
    refundSteps(f, reload)));
  return h("div", { class: "stack" }, list, ...cards, ...refunds);
}

// ---------- Demandes & validations : toutes les demandes en attente, au même endroit ----------
const REQ_ICON = { advertisers: "building", listings: "list", featured: "sparkles", premium: "wallet" };
const REQ_ACTION = { advertisers: "Examiner", listings: "Modérer", featured: "Décider", premium: "Traiter" };
export const requestsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Demandes & validations",
  desc: "Les demandes annonceur, les annonces à valider, les mises à la une et les demandes Premium, de la plus ancienne à la plus récente.",
  load: () => api("/staff/requests-hub"),
  actions: (d, reload) => h("button", { class: "btn", type: "button", onClick: () => { reload(); toast("Données actualisées."); } }, ico("refresh"), "Actualiser"),
  build(d) {
    const sections = d.sections ?? [];
    if (!sections.length) return [empty("Aucun module de demandes ne vous est attribué.", "shield")];
    const late = sections.reduce((n, x) => n + x.items.filter((i) => i.late).length, 0);
    const stats = h("section", { class: "grid stats" }, sections.map((x) => h("div", { class: "card stat" },
      h("div", { class: "stathead" }, x.title, h("span", { class: "staticon" }, ico(REQ_ICON[x.key] ?? "list"))),
      h("strong", null, x.total == null ? "—" : String(x.total).padStart(2, "0")),
      h("span", { class: `delta ${x.items.some((i) => i.late) ? "bad" : "flat"}` }, x.total ? (x.items.some((i) => i.late) ? `En attente depuis plus de ${d.lateAfterHours} h` : "À traiter") : "Rien en attente"))));
    const blocks = sections.map((x) => panel(x.title, x.total ? `${x.total} en attente` : "Aucune demande en attente", table([
      { label: "Demande", render: (r) => h("div", { class: "item" }, h("b", null, r.title || "—"), r.detail ? h("small", null, r.detail) : null) },
      { label: "Reçue", render: (r) => h("span", { title: dateTime(r.createdAt) }, ago(r.createdAt)) },
      { label: "Délai", render: (r) => (r.late ? pill("warn", "En retard") : pill("ok", "Dans les temps")) },
      { label: "", render: () => h("button", { class: "btn sm primary", type: "button", onClick: () => ctx.go(`#/${x.module}`) }, REQ_ACTION[x.key] ?? "Ouvrir") },
    ], x.items, { emptyText: "Rien à traiter pour le moment." })));
    return [h("p", { class: `note ${late ? "bad" : ""}` }, late ? `${late} demande${late > 1 ? "s" : ""} attend${late > 1 ? "ent" : ""} depuis plus de ${d.lateAfterHours} h.` : "Aucune demande en retard."), stats, ...blocks];
  },
});

// ---------- Réglages paiement (superadmin) ----------
export const paymentSettingsView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Réglages paiement",
  desc: "Décidez si les annonceurs peuvent payer en ligne, et jusqu'à quelle durée l'équipe peut accorder le Premium à la main.",
  load: () => api("/staff/superadmin-settings/payments_policy").then((r) => r.value ?? null).catch(() => null),
  build(saved, reload) {
    const online = saved?.onlineEnabled === true;
    const max = [1, 2, 3].includes(saved?.manualPremiumMaxMonths) ? saved.manualPremiumMaxMonths : 3;
    const box = h("input", { type: "checkbox", id: "pp-online" });
    box.checked = online;
    const sel = h("select", { id: "pp-months" }, ...[1, 2, 3].map((m) => h("option", { value: String(m) }, `${m} mois`)));
    sel.value = String(max);
    const maxFeatured = [1, 2, 3].includes(saved?.manualFeaturedMaxMonths) ? saved.manualFeaturedMaxMonths : 1;
    const selFeatured = h("select", { id: "pp-featured" }, ...[1, 2, 3].map((m) => h("option", { value: String(m) }, `${m} mois`)));
    selFeatured.value = String(maxFeatured);
    const payLabel = h("input", { class: "input", type: "text", maxlength: "40", value: saved?.payButtonLabel ?? "Activer mon Premium", "aria-label": "Texte du bouton" });
    const payNote = h("input", { class: "input", type: "text", maxlength: "200", value: saved?.payButtonNote ?? "", placeholder: "Ex. Paiement par mobile money, dossier étudié sous 72 h", "aria-label": "Note" });
    const delay = h("input", { class: "input", type: "number", min: "1", max: "30", value: String(saved?.reviewDelayDays ?? 3), "aria-label": "Délai en jours" });
    const hint = h("p", { class: "small muted" }, online
      ? "Ouvert : les annonceurs payent par mobile money, pour les formules actives uniquement."
      : "Fermé : aucun paiement en ligne. Les demandes Premium sont approuvées à la main par l'équipe.");
    box.addEventListener("change", () => { hint.textContent = box.checked
      ? "Ouvert : les annonceurs payent par mobile money, pour les formules actives uniquement."
      : "Fermé : aucun paiement en ligne. Les demandes Premium sont approuvées à la main par l'équipe."; });
    return [
      panel("Paiement en ligne", null, h("div", { class: "stack" },
        h("label", { class: "row", for: "pp-online" }, box, h("strong", null, "Paiement en ligne ouvert aux annonceurs (bouton « Activer le paiement Premium »)")),
        hint)),
      panel("Bouton de paiement Premium", "Texte affiché aux annonceurs", h("div", { class: "stack" },
        h("label", { class: "field" }, "Texte du bouton", payLabel),
        h("label", { class: "field" }, "Note sous le bouton (facultatif)", payNote),
        h("p", { class: "small muted" }, "Paiement ouvert : l'annonceur paie d'abord, puis son dossier est étudié en 3 étapes (étude, vérification, confirmation). Paiement fermé : le dossier est étudié d'abord ; l'activation se fait à la main après les 3 étapes."))),
      panel("Délai d'étude du dossier", null, h("div", { class: "stack" },
        h("label", { class: "field" }, "Délai de réponse annoncé à l'annonceur (jours)", delay),
        h("p", { class: "small muted" }, "Affiché à l'annonceur après l'envoi de son dossier. Un dossier non traité dans ce délai est signalé « en retard » dans Demandes & validations."))),
      panel("Approbation manuelle", null, h("div", { class: "stack" },
        h("label", { class: "row", for: "pp-months" }, h("span", null, "Durée maximale accordée par l'équipe")), sel,
        h("p", { class: "small muted" }, "Pendant cette durée, l'annonceur bénéficie de tous les avantages Premium (aucun paiement demandé)."),
        )),
      panel("Mise à la une à la main", null, h("div", { class: "stack" },
        h("label", { class: "row", for: "pp-featured" }, h("span", null, "Durée maximale de mise à la une accordée par l'équipe")), selFeatured,
        h("p", { class: "small muted" }, "L'équipe choisit la durée à l'acceptation d'une demande de mise à la une (1 à cette limite). Les formules payantes gardent leur durée propre."))),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/superadmin-settings/payments_policy", { method: "PUT", body: { value: { onlineEnabled: box.checked, manualPremiumMaxMonths: Number(sel.value), manualFeaturedMaxMonths: Number(selFeatured.value), reviewDelayDays: Number(delay.value), payButtonLabel: payLabel.value, payButtonNote: payNote.value } } }), "Réglages enregistrés.", reload) }, "Enregistrer")),
      h("p", { class: "small muted" }, "Les formules se gèrent dans « Abonnements & formules ». Elles ne s'affichent au public que si le paiement en ligne est ouvert."),
    ];
  },
});

// ---------- Découvrir : publications signalées ou masquées ----------
export const discoverView = (ctx) => page(ctx, {
  eyebrow: "MODÉRATION", title: "Publications Découvrir",
  desc: "Publications de la communauté signalées par les membres ou masquées. Masquer retire la publication du fil sans la supprimer ; le motif et votre nom sont conservés dans l'historique.",
  load: () => api("/staff/discover/reports"),
  build({ items }, reload) {
    if (!items.length) return [empty("Aucune publication signalée ni masquée.")];
    return items.map((p) => panel(`${p.kindLabel} · ${p.author.name}`, `${dateTime(p.createdAt)}${p.category ? ` · ${p.category}` : ""}${p.zone ? ` · ${p.zone}` : ""}`, h("div", { class: "stack" },
      h("p", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 } }, p.content),
      p.photos.length ? h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } }, p.photos.map((u) => h("a", { href: u, target: "_blank", rel: "noopener" }, h("img", { src: u, alt: "Photo de la publication", style: { width: "88px", height: "88px", objectFit: "cover", borderRadius: "10px" } })))) : null,
      h("div", { class: "row" }, pill(p.hidden ? "bad" : "warn", p.hidden ? "Masquée" : `${p.reports} signalement${p.reports > 1 ? "s" : ""}`), p.reports && p.hidden ? pill("neutral", `${p.reports} signalement${p.reports > 1 ? "s" : ""}`) : null),
      ...(p.reportList ?? []).slice(0, 5).map((r) => h("small", { class: "muted" }, `${dateTime(r.at)} : ${r.reason}`)),
      p.authorStatus && p.authorStatus !== "ACTIVE" ? h("div", { class: "row" }, pill("bad", p.authorStatus === "BANNED" ? "Compte banni" : "Compte bloqué"), p.authorStatusReason ? h("small", { class: "muted" }, p.authorStatusReason) : null) : null,
      p.hidden ? h("small", null, `Masquée par ${p.hiddenByName ?? "—"} · ${dateTime(p.hiddenAt)}${p.hiddenReason ? ` · « ${p.hiddenReason} »` : ""}`) : null,
      h("div", { class: "row" },
        p.hidden
          ? h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/discover/${encodeURIComponent(p.id)}/restore`, { method: "POST", body: {} }), "Publication rétablie.", reload) }, "Rétablir")
          : h("button", { class: "btn sm", type: "button", onClick: async () => {
            const v = await formDialog("Masquer cette publication", [{ name: "reason", label: "Motif (obligatoire)", type: "textarea", required: true, max: 300 }], { intro: "Elle disparaît du fil. Votre nom et le motif sont enregistrés.", submit: "Masquer" });
            if (v) act(() => api(`/staff/discover/${encodeURIComponent(p.id)}/hide`, { method: "POST", body: { reason: v.reason } }), "Publication masquée.", reload);
          } }, "Masquer"),
        p.reports ? h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/discover/${encodeURIComponent(p.id)}/dismiss`, { method: "POST", body: {} }), "Signalements classés sans suite.", reload) }, "Classer sans suite") : null,
        p.authorStatus === "ACTIVE"
          ? [["RESTRICTED", "Bloquer le compte", "Le compte ne peut plus publier ni commenter ; il peut contester."], ["BANNED", "Bannir le compte", "Le compte est banni : annonces masquées, sessions fermées."]].map(([status, label, intro]) => h("button", { class: "btn sm", type: "button", onClick: async () => {
            const v = await formDialog(label, [{ name: "reason", label: "Motif (obligatoire)", type: "textarea", required: true, max: 500 }], { intro: `${p.author.name} — ${intro}`, submit: label });
            if (v) act(() => api(`/staff/accounts/${encodeURIComponent(p.author.id)}/status`, { method: "POST", body: { status, reason: v.reason } }), "Compte mis à jour.", reload);
          } }, label))
          : h("button", { class: "btn sm", type: "button", onClick: () => act(() => api(`/staff/accounts/${encodeURIComponent(p.author.id)}/status`, { method: "POST", body: { status: "ACTIVE", reason: "" } }), "Compte débloqué ; ses signalements sont remis à zéro.", reload) }, "Débloquer le compte")))));
  },
});

// ---------- Conditions officielles (superadmin) ----------
// Le code applique ce qui est décidé ici ; un cas particulier se règle par une EXCEPTION tracée sur la fiche du compte, jamais en modifiant le code.
const STEP_LABELS = { 1: "Étude", 2: "Vérification", 3: "Confirmation" };
export const rulesView = (ctx) => page(ctx, {
  eyebrow: "PILOTAGE", title: "Conditions & exceptions",
  desc: "Les conditions officielles du site, et qui peut y déroger. Chaque exception est accordée sur la fiche d'un compte, avec un motif, et reste tracée.",
  load: () => api("/staff/rules"),
  build({ rules, criteria = [], whatsapp = {} }, reload) {
    const canEdit = ctx.isSuperadmin();
    // Critères de certification du centre de contrôle : ET entre les conditions, OU entre les critères d'une même condition.
    const certGroups = Array.from({ length: 3 }, (_, i) => (rules.certificationGroups ?? [])[i] ?? []).map((g) => criteria.map((c) => { const b = h("input", { type: "checkbox", disabled: !canEdit }); b.checked = g.includes(c.code); return [c, b]; }));
    const certValue = () => certGroups.map((g) => g.filter(([, b]) => b.checked).map(([c]) => c.code)).filter((g) => g.length);
    const phone = h("input", { type: "checkbox", id: "rl-phone", disabled: !canEdit });
    phone.checked = rules.phoneConfirmedForPremium !== false;
    const stepBoxes = [1, 2, 3].map((n) => { const b = h("input", { type: "checkbox", id: `rl-step${n}`, disabled: !canEdit }); b.checked = rules.requiredSteps.includes(n); return [n, b]; });
    const granter = h("select", { id: "rl-granter", disabled: !canEdit }, h("option", { value: "SUPERADMIN" }, "Le superadmin seul"), h("option", { value: "ADMIN" }, "Les administrateurs aussi"));
    granter.value = rules.exceptionGrantedBy;
    const dOpen = h("input", { type: "checkbox", id: "rl-d-open", disabled: !canEdit }); dOpen.checked = rules.discoverEnabled !== false;
    const dPhone = h("input", { type: "checkbox", id: "rl-d-phone", disabled: !canEdit }); dPhone.checked = rules.discoverRequirePhone === true;
    const dAuto = h("input", { class: "input", type: "number", min: "0", max: "100", id: "rl-d-auto", disabled: !canEdit, value: String(rules.discoverAutoBlockReports ?? 10) });
    const wa = h("input", { type: "checkbox", id: "rl-wa", disabled: !canEdit || !whatsapp.ready }); wa.checked = rules.whatsappDecisionEnabled === true;
    const dVideo = h("input", { type: "checkbox", id: "rl-d-video", disabled: !canEdit }); dVideo.checked = rules.discoverVideoLinks === true;
    const dPhotos = h("input", { class: "input", type: "number", min: "0", max: "6", id: "rl-d-photos", disabled: !canEdit, value: String(rules.discoverMaxPhotos ?? 4) });
    const dDay = h("input", { class: "input", type: "number", min: "1", max: "50", id: "rl-d-day", disabled: !canEdit, value: String(rules.discoverPostsPerDay ?? 5) });
    const save = h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/rules", { method: "PUT", body: { value: { phoneConfirmedForPremium: phone.checked, certificationGroups: certValue(), requiredSteps: stepBoxes.filter(([, b]) => b.checked).map(([n]) => n), exceptionGrantedBy: granter.value,
      discoverEnabled: dOpen.checked, discoverRequirePhone: dPhone.checked, whatsappDecisionEnabled: wa.checked, discoverVideoLinks: dVideo.checked, discoverAutoBlockReports: Number(dAuto.value), discoverMaxPhotos: Number(dPhotos.value), discoverPostsPerDay: Number(dDay.value) } } }), "Conditions enregistrées.", reload) }, "Enregistrer les conditions");
    return [
      canEdit ? null : h("p", { class: "note" }, "Lecture seule : seul le superadmin modifie les conditions officielles."),
      panel("Dossier Premium : numéro de téléphone", null, h("div", { class: "stack" },
        h("label", { class: "row", for: "rl-phone" }, phone, h("strong", null, "Exiger un numéro confirmé (code reçu) pour demander ou payer le Premium")),
        h("p", { class: "small muted" }, "Décoché : plus personne n'a besoin de confirmer son numéro pour passer Premium. Pour un seul compte, accordez plutôt une exception sur sa fiche."))),
      panel("Centre de contrôle : critères de certification", null, h("div", { class: "stack" },
        ...certGroups.map((g, i) => h("fieldset", { class: "stack" }, h("legend", null, `Condition ${i + 1} (au moins un critère coché)`),
          ...g.map(([c, b]) => h("label", { class: "row" }, b, h("span", null, c.label))))),
        h("p", { class: "small muted" }, "Toutes les conditions utilisées doivent être remplies ; dans une condition, un seul critère suffit. Exemple : condition 1 = « Agence vérifiée » ou « Titre foncier contrôlé ». Laissez une condition vide pour ne pas l'utiliser ; au moins une est obligatoire. Un cas particulier se règle par une exception tracée sur la fiche du compte, jamais en modifiant le code."))),
      panel("Dossier Premium : étapes à valider avant d'approuver", null, h("div", { class: "stack" },
        ...stepBoxes.map(([n, b]) => h("label", { class: "row", for: `rl-step${n}` }, b, h("span", null, `Étape ${n} : ${STEP_LABELS[n]}`))),
        h("p", { class: "small muted" }, "Seules les étapes cochées sont exigées pour approuver. Les autres restent possibles et tracées si l'équipe les valide."))),
      panel("Découvrir : publications de la communauté", null, h("div", { class: "stack" },
        h("label", { class: "row", for: "rl-d-open" }, dOpen, h("strong", null, "Découvrir ouvert (lecture et publication)")),
        h("label", { class: "row", for: "rl-d-phone" }, dPhone, h("span", null, "Exiger un numéro confirmé pour publier")),
        h("label", { class: "field", for: "rl-d-auto" }, "Blocage automatique d'un compte après ce nombre de membres différents l'ayant signalé (0 = jamais)", dAuto),
        h("label", { class: "row", for: "rl-wa" }, wa, h("span", null, "Envoyer un message WhatsApp à la décision finale d'un dossier Premium (aux personnes qui l'ont accepté)")),
        h("small", { class: "muted" }, whatsapp.ready ? "WhatsApp est installé sur le serveur : vous pouvez l'activer." : `WhatsApp n'est pas encore installé sur le serveur (manquant : ${[!whatsapp.token && "jeton", !whatsapp.phoneNumberId && "identifiant du numéro", !whatsapp.template && "modèle de message"].filter(Boolean).join(", ")}). L'interrupteur se débloquera dès que les variables seront en place.`),
        h("label", { class: "row", for: "rl-d-video" }, dVideo, h("span", null, "Autoriser les liens vidéo YouTube / Facebook (l'envoi de fichiers vidéo reste fermé)")),
        h("label", { class: "field", for: "rl-d-photos" }, "Photos par publication (0 = aucune, 6 au maximum)", dPhotos),
        h("label", { class: "field", for: "rl-d-day" }, "Publications par compte et par 24 heures (1 à 50)", dDay),
        h("p", { class: "small muted" }, "Fermé : le fil et la publication sont suspendus pour tout le monde, rien n'est supprimé. Les vidéos ne sont pas encore prises en charge."))),
      panel("Exceptions (jurisprudence)", null, h("div", { class: "stack" },
        h("label", { class: "field" }, "Qui peut accorder ou révoquer une exception", granter),
        h("p", { class: "small muted" }, "Une exception lève UNE condition pour UN compte : motif obligatoire, durée facultative, auteur et date conservés dans la fiche du compte et le journal d'audit. Elle se révoque sans rien effacer."))),
      canEdit ? h("div", { class: "row" }, save) : null,
    ];
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
      { label: "", render: (r) => { const sel = h("select", { class: "select", "aria-label": "Statut" }, ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"].map((v) => h("option", { value: v, selected: v === r.status }, ({ PENDING: "En attente", ACCEPTED: "Acceptée", DECLINED: "Refusée", CANCELLED: "Annulée" })[v]))); sel.addEventListener("change", () => act(() => api(`/staff/owner/visits/${encodeURIComponent(r.id)}/status`, { method: "POST", body: { status: sel.value } }), "Statut mis à jour.", reload)); return sel; } }], d.visits, { emptyText: "Aucune demande." }))),
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
// Statistiques (repris de l'ancien centre) : agrégats quotidiens, classements, fiche annonceur, comparaison, pondérations.
// Jamais de calcul en direct : les chiffres viennent des agrégats. Chaque fiche consultée est journalisée côté serveur.
export const statsView = (ctx) => {
  let days = 7;
  const compareSel = [];
  const pct = (cur, prev) => (!prev ? "" : ` (${cur - prev >= 0 ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)} % sur la période précédente)`);
  const perf = (p) => [`Indice ${nf(p.current.score)}${pct(p.current.score, p.previous.score)}`, `${nf(p.current.views)} vues · ${nf(p.current.favorites)} favoris · ${nf(p.current.contactClicks)} clics de contact`];
  const openSheetFor = async (id) => {
    try { const v = await api(`/staff/stats/advertisers/${encodeURIComponent(id)}?days=${days}`); const a = v.advertiser;
      openDrawer(a.name, h("p", { class: "muted small" }, `${a.role}${a.agencyVerified ? " · agence vérifiée" : ""} · compte ${a.accountStatus}${a.statusReason ? ` (${a.statusReason})` : ""}`),
        h("p", { class: "small" }, `Inscrit le ${a.memberSince ? dateOnly(a.memberSince) : "—"} · dernière session : ${v.lastSessionAt ? dateTime(v.lastSessionAt) : "aucune"}`),
        h("p", { class: "small" }, `Annonces : ${v.listingsTotal} (${Object.entries(v.listingsByStatus).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(" · ") || "aucune"})`),
        h("h3", null, `Performance du ${v.period.from} au ${v.period.to}`), ...perf(v.performance).map((t) => h("p", { class: "small" }, t)),
        h("p", { class: "muted small" }, `Pondérations : vue ${v.weights.view}, favori ${v.weights.favorite}, contact ${v.weights.contactClick}.`),
        h("h3", null, "Meilleures annonces"), ...(v.bestListings.length ? v.bestListings.map((l) => h("p", { class: "small" }, `${l.title} (${l.status.toLowerCase()}) — indice ${nf(l.score)}`)) : [h("p", { class: "muted small" }, "Aucune annonce.")]),
        h("p", { class: "muted small" }, `Avis : ${v.reviews.count ? `${v.reviews.count} avis, moyenne ${String(v.reviews.average).replace(".", ",")} / 5` : "aucun avis"} · signalements : ${v.reports.listingOpen} d'annonce, ${v.reports.userOpen} de compte (ouverts)`),
        h("p", { class: "muted small" }, v.notice));
    } catch (error) { fail(error); }
  };
  const compare = async (reload) => {
    if (compareSel.length !== 2) return;
    try { const v = await api(`/staff/stats/compare?a=${encodeURIComponent(compareSel[0].id)}&b=${encodeURIComponent(compareSel[1].id)}&days=${days}`);
      const col = (x) => h("section", { class: "card panel stack" }, h("h3", null, x.name), h("p", { class: "muted small" }, `${x.role}${x.agencyVerified ? " · agence vérifiée" : ""} · ${x.listingsTotal} annonce(s)`), ...perf({ current: x.current, previous: x.previous }).map((t) => h("p", { class: "small" }, t)), ...x.bestListings.map((l) => h("p", { class: "muted small" }, `${l.title} — indice ${nf(l.score)}`)));
      compareSel.length = 0; reload?.();
      openDrawer(`Comparaison du ${v.period.from} au ${v.period.to}`, h("div", { class: "stack" }, col(v.a), col(v.b)), h("p", { class: "muted small" }, `Pondérations : vue ${v.weights.view}, favori ${v.weights.favorite}, contact ${v.weights.contactClick}. ${v.notice}`));
    } catch (error) { fail(error); }
  };
  const rankRows = (r, reload) => {
    const rate = (x) => (x.interactionRate == null ? `taux non affiché (moins de ${r.minViewsForRate} vues)` : `taux d'interaction ${String(x.interactionRate).replace(".", ",")} %`);
    const line = (x, label) => {
      const selected = x.ownerId && compareSel.some((c) => c.id === x.ownerId);
      return h("article", { class: "card panel row" }, h("div", { class: "grow" }, h("b", null, label), h("p", { class: "muted small" }, `indice ${nf(x.score)} · ${nf(x.views)} vues · ${nf(x.favorites)} favoris · ${nf(x.contactClicks)} clics de contact · ${rate(x)}`)),
        x.ownerId ? h("div", { class: "row" },
          h("button", { class: "btn sm", type: "button", onClick: () => openSheetFor(x.ownerId) }, "Fiche"),
          h("button", { class: `btn sm${selected ? " primary" : ""}`, type: "button", "aria-pressed": String(!!selected), onClick: () => {
            const i = compareSel.findIndex((c) => c.id === x.ownerId);
            if (i >= 0) compareSel.splice(i, 1); else compareSel.push({ id: x.ownerId, name: x.name ?? x.title }); compareSel.splice(0, compareSel.length - 2);
            reload?.(); if (compareSel.length === 2) compare(reload);
          } }, selected ? "Retirer de la comparaison" : "Comparer")) : null);
    };
    const block = (title, rows, render, emptyText) => panel(title, null, rows.length ? h("div", { class: "stack" }, rows.map(render)) : empty(emptyText, "search"));
    return [
      compareSel.length === 1 ? h("p", { class: "notice" }, `Comparaison : ${compareSel[0].name} sélectionné. Choisissez un deuxième annonceur.`) : null,
      block("Classement des annonces", r.listings, (x, i) => line(x, `${i + 1}. ${x.title} (${x.ownerName})`), "Aucune activité comptée sur la période."),
      block("Classement des agences", r.agencies, (x, i) => line(x, `${i + 1}. ${x.name}${x.agencyVerified ? " · vérifiée" : " · en cours de vérification"} · ${x.listingsCounted} annonce(s)`), "Aucune agence avec activité comptée."),
      block("Classement des autres annonceurs (particuliers, démarcheurs)", r.others, (x, i) => line(x, `${i + 1}. ${x.name} · ${x.role} · ${x.listingsCounted} annonce(s)`), "Aucun annonceur avec activité comptée."),
    ];
  };
  return page(ctx, {
    eyebrow: "RAPPORTS", title: "Statistiques", desc: "Agrégats quotidiens uniquement. Chaque consultation de fiche annonceur est journalisée.",
    load: async () => { const [o, r] = await Promise.all([api(`/staff/stats/overview?days=${days}`), api(`/staff/stats/rankings?days=${days}`)]); return { o, r }; },
    build({ o, r }, reload) {
      const c = o.collection;
      const notes = [];
      if (!c.environmentOn || !c.settingOn) notes.push("Collecte des visites non démarrée : seuls les chiffres d'historique (inscriptions, annonces publiées) sont disponibles.");
      else if (!c.lastAggregatedDay) notes.push("Aucune agrégation n'a encore été faite : lancez « node scripts/aggregate.mjs --apply » sur le serveur.");
      if (c.lastAggregatedDay && c.lastAggregatedDay < o.period.to) notes.push(`Chiffres arrêtés au ${c.lastAggregatedDay} : les jours suivants n'ont pas été agrégés.`);
      if (c.checksFailed7d > 0) notes.push(`${c.checksFailed7d} contrôle(s) de cohérence en écart ces 7 derniers jours : recalculer les jours concernés.`);
      const delta = (key) => { const now = o.totals[key]; const before = o.previousTotals[key]; if (!before) return now ? "pas de période précédente comparable" : ""; const d = now - before; return `${d >= 0 ? "+" : ""}${nf(d)} (${d >= 0 ? "+" : ""}${Math.round((d / before) * 100)} %) par rapport à la période précédente`; };
      const shown = o.daily.slice(-31); const max = Math.max(1, ...shown.map((d) => d.views));
      const setDays = (n) => { days = n; reload(); };
      const w = r.weights;
      const weightsForm = async () => {
        const v = await formDialog("Pondérations de l'indice", [
          { name: "view", label: `Poids d'une vue (0 à ${r.weightMax})`, type: "number", required: true, value: w.view },
          { name: "favorite", label: "Poids d'un favori ajouté", type: "number", required: true, value: w.favorite },
          { name: "contactClick", label: "Poids d'un clic de contact (supérieur à celui d'une vue)", type: "number", required: true, value: w.contactClick },
          { name: "reason", label: "Motif du changement (obligatoire)", type: "textarea", required: true, max: 300 }], { submit: "Enregistrer" });
        if (v) act(() => api("/staff/stats/weights", { method: "POST", body: { view: Number(v.view), favorite: Number(v.favorite), contactClick: Number(v.contactClick), reason: v.reason } }), "Pondérations enregistrées.", reload);
      };
      return [
        h("div", { class: "row", role: "group", "aria-label": "Période" }, [7, 30, 90].map((n) => h("button", { class: `btn sm${days === n ? " primary" : ""}`, type: "button", "aria-pressed": String(days === n), onClick: () => setDays(n) }, `${n} jours`)),
          h("span", { class: "muted small" }, `Du ${o.period.from} au ${o.period.to} (jours complets, fuseau UTC = Mali)`)),
        ...notes.map((n) => h("p", { class: "notice" }, n)),
        minis(...o.definitions.map((d) => h("div", { class: "card mini" }, h("small", null, d.label), h("strong", null, nf(o.totals[d.key])), h("small", null, delta(d.key))))),
        panel("Jour par jour", o.daily.length > shown.length ? `Les ${shown.length} derniers jours sur ${o.daily.length}.` : null,
          h("div", { class: "stack" }, shown.map((d) => h("div", { class: "row" }, h("small", null, d.day.slice(5)), h("progress", { max: String(max), value: String(d.views), "aria-label": `${d.day} : ${d.views} vues` }), h("small", null, nf(d.views)))))),
        panel("Annonces les plus vues", null, o.topListings.length ? h("div", { class: "stack" }, o.topListings.map((t) => h("p", { class: "small" }, `${t.title ?? t.listingId} — ${nf(t.views)} vues, ${nf(t.contactClicks)} clics de contact`))) : empty("Aucune annonce vue sur la période.", "search")),
        panel("Indice de confiance des classements", `Pondérations : vue ${w.view}, favori ${w.favorite}, clic de contact ${w.contactClick} (${r.weightsCustomised ? "réglées par le propriétaire" : "valeurs par défaut"}).`,
          h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: weightsForm }, "Modifier les pondérations"))),
        ...rankRows(r, reload),
        h("details", { class: "panel" }, h("summary", null, "Définitions des indicateurs"), h("ul", { class: "stack" }, o.definitions.map((d) => h("li", null, h("b", null, d.label), ` : ${d.note}`)))),
      ];
    },
  });
};

export const reportsView = (ctx) => page(ctx, {
  eyebrow: "SYSTÈME", title: "Rapports & exports", desc: "Chaque export du journal des mouvements est inscrit au journal d'audit.", load: async () => api("/staff/owner/report"),
  build(r) {
    const link = (href, icon, t, sub, dl) => h("a", { class: "module", href, download: dl ?? null }, h("span", { class: "moduleico" }, ico(icon)), h("span", null, h("b", null, t), h("small", null, sub)));
    return [h("section", { class: "grid modules" }, link("/api/staff/owner/report.pdf", "file", "Rapport complet PDF", "Synthèse Owner", "owner-report.pdf"), link("/api/staff/owner/export.csv", "download", "Indicateurs CSV", "Vue d'ensemble", "owner-overview.csv"), link("/api/staff/owner/listings.csv", "list", "Annonces CSV", "500 dernières", "listings-report.csv"),
      link("/api/staff/owner/listings.pdf", "file", "Annonces PDF", "500 dernières", "listings-report.pdf"),
      link("/api/staff/owner/activity/export.csv?categories=admin,account,security,listing,engagement,safety,finance,growth,system", "pulse", "Mouvements CSV", "Toutes catégories (5 000 lignes)", "mouvements-ika-so.csv"),
      link("/api/staff/owner/activity/export.pdf?categories=admin,account,security,listing,engagement,safety,finance,growth,system", "file", "Mouvements PDF", "Toutes catégories (500 dernières lignes)", "mouvements-ika-so.pdf")),
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
  ["accentColor", "Couleur du titre et du badge (accueil seulement)", "#C9EF75"],
  ["textColor", "Couleur du texte principal", "#ffffff"],
];
export function homepageSection(s, reload) {
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
}

export function settingsSection({ s, sec }, reload) {
  const f = { platformName: s.platformName, contactEmail: s.contactEmail, contactPhone: s.contactPhone, currency: s.currency };
  const inp = (k, l) => { const i = h("input", { class: "input", value: f[k] ?? "" }); i.addEventListener("input", () => { f[k] = i.value; }); return h("label", { class: "field" }, l, i); };
  return [panel("Identité & contact", null, h("div", { class: "form two" }, inp("platformName", "Nom de la plateforme"), inp("contactEmail", "E-mail de contact"), inp("contactPhone", "Téléphone de contact"), inp("currency", "Devise"),
    h("div", { class: "wide" }, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/settings", { method: "PUT", body: f }), "Paramètres enregistrés.", reload) }, "Enregistrer")))),
    panel("Journal de connexions", "Connexions, déconnexions, inscriptions et échecs de connexion : sans adresse IP, sans e-mail saisi, sans agent utilisateur brut (famille d'appareil seulement).",
      h("div", { class: "stack" }, h("div", { class: "row" }, sec.enabled ? pill("ok", "Activé") : pill("neutral", "Désactivé"), sec.available ? h("span", { class: "muted small" }, `${nf(sec.total)} ligne(s) · ${nf(sec.last24h)} sur 24 h${sec.since ? ` · depuis ${dateOnly(sec.since)}` : ""}`) : pill("gold", "Migration 042 à appliquer")),
        h("p", { class: "note warn" }, "À faire valider avec le juriste / l'APDP avant mise en production, comme la collecte analytique. Conservation proposée : 12 mois (purge à brancher)."),
        h("div", null, h("button", { class: "btn", type: "button", onClick: () => act(() => api("/staff/owner/security-log", { method: "PUT", body: { enabled: !sec.enabled } }), sec.enabled ? "Journal désactivé." : "Journal activé.", reload) }, sec.enabled ? "Désactiver" : "Activer"))))];
}

export function seoSection({ seo, logo, legal }, reload) {
  const S = { ...seo }; const L = { ...legal }; const G = { logoUrl: logo.logoUrl };
  const fld = (o, k, l, area, max) => { const i = h(area ? "textarea" : "input", { class: "input", maxlength: max ?? 300 }); i.value = o[k] ?? ""; i.addEventListener("input", () => { o[k] = i.value; }); return h("label", { class: "field wide" }, l, i); };
  return [panel("Référencement", null, h("div", { class: "form" }, fld(S, "title", "Titre (120 max)", false, 120), fld(S, "description", "Description (300 max)", true, 300), fld(S, "keywords", "Mots-clés", false, 200), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/seo", { method: "PUT", body: S }), "SEO enregistré.", reload) }, "Enregistrer")))),
    panel("Logo", "Chemin du site (/media/…) ou adresse https", h("div", { class: "form" }, fld(G, "logoUrl", "Adresse du logo", false, 500), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/logo", { method: "PUT", body: G }), "Logo enregistré.", reload) }, "Enregistrer")))),
    panel("Pages légales", "CGU, confidentialité, mentions légales", h("div", { class: "form" }, fld(L, "cgu", "Conditions générales", true, 10000), fld(L, "privacy", "Politique de confidentialité", true, 10000), fld(L, "mentions", "Mentions légales", true, 5000), h("div", null, h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/owner/legal", { method: "PUT", body: L }), "Pages légales publiées.", reload) }, "Enregistrer et publier"))))];
}

// Apparence & modules : réglage superadmin « main » (lu par bootstrap-settings.js sur le site public).
// Enregistrement complet de l'objet « main » pour ne pas écraser les autres clés stockées.
export function appearanceSection({ main }, reload) {
  const base = main && typeof main === "object" ? main : {};
  const C = { ...(base.colors || {}) };
  const M = { crm: true, premium: true, ...(base.modules || {}) };
  const color = (k, l) => {
    const i = h("input", { type: "color", value: C[k] || (k === "primary" ? "#12734b" : "#e8b23a") });
    i.addEventListener("input", () => { C[k] = i.value; });
    return h("label", { class: "field" }, l, i);
  };
  const check = (k, l) => {
    const i = h("input", { type: "checkbox" }); i.checked = M[k] !== false;
    i.addEventListener("change", () => { M[k] = i.checked; });
    return h("label", { class: "field" }, i, " ", l);
  };
  const save = () => act(() => api("/staff/superadmin-settings/main", { method: "PUT", body: { value: { ...base, colors: { ...C }, modules: { ...M } } } }), "Apparence enregistrée.", reload);
  return [panel("Apparence & modules", "Couleurs appliquées au site public (uniquement si vous les modifiez). Les modules masquent les liens correspondants.",
    h("div", { class: "stack" },
      h("div", { class: "form two" }, color("primary", "Couleur principale"), color("accent", "Couleur d’accent")),
      h("div", { class: "stack" }, check("crm", "Module CRM (espace agence)"), check("premium", "Module Premium")),
      h("p", { class: "note" }, "Carte et WhatsApp Business ne sont pas encore reliés au site : ils n’ont pas d’effet pour l’instant. Les textes d’accueil se règlent dans « Page d’accueil »."),
      h("div", null, h("button", { class: "btn primary", type: "button", onClick: save }, "Enregistrer"))))];
}

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

// ---------- Personnalisation du site : une seule interface (identité, accueil, référencement, logo, pages légales, sécurité) ----------
const CUSTOMIZE_TABS = [["identity", "Identité & contact"], ["appearance", "Apparence & modules"], ["homepage", "Page d’accueil"], ["seo", "Référencement"], ["logo", "Logo"], ["legal", "Pages légales"], ["security", "Sécurité"]];
export const customizeView = (ctx, initial = "identity") => page(ctx, {
  eyebrow: "SYSTÈME", title: "Personnalisation du site", desc: "Tout ce qui décrit le site public, au même endroit. Chaque section s’enregistre séparément.",
  load: async () => {
    const [settings, sec, home, seo, logo, legal, main] = await Promise.all([
      api("/staff/owner/settings"), api("/staff/owner/security-log"), api("/homepage-settings"),
      api("/staff/owner/seo"), api("/staff/owner/logo"), api("/staff/owner/legal"),
      api("/staff/superadmin-settings/main").then((r) => r.value ?? null).catch(() => null)]);
    return { settings, sec, home, seo, logo, legal, main };
  },
  actions: () => h("a", { class: "btn", href: "/", target: "_blank", rel: "noopener" }, ico("external"), "Voir le site"),
  build({ settings, sec, home, seo, logo, legal, main }, reload) {
    const parts = {
      identity: settingsSection({ s: settings, sec }, reload)[0],
      appearance: appearanceSection({ main }, reload),
      security: settingsSection({ s: settings, sec }, reload)[1],
      homepage: homepageSection(home, reload),
      seo: seoSection({ seo, logo, legal }, reload).slice(0, 1),
      logo: seoSection({ seo, logo, legal }, reload).slice(1, 2),
      legal: seoSection({ seo, logo, legal }, reload).slice(2),
    };
    const panes = CUSTOMIZE_TABS.map(([id]) => h("section", { class: "ps-pane", "data-pane": id, role: "tabpanel" }, ...[].concat(parts[id])));
    const select = (id, btn) => {
      panes.forEach((pane) => { pane.hidden = pane.dataset.pane !== id; });
      btns.forEach((b) => { const on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    };
    const btns = CUSTOMIZE_TABS.map(([id, label]) => h("button", { class: "ps-tab", type: "button", role: "tab", "aria-selected": "false", onClick: (e) => select(id, e.currentTarget) }, label));
    const start = CUSTOMIZE_TABS.some(([id]) => id === initial) ? initial : "identity";
    panes.forEach((pane) => { pane.hidden = pane.dataset.pane !== start; });
    btns.forEach((b, i) => { const on = CUSTOMIZE_TABS[i][0] === start; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    return [h("nav", { class: "ps-tabs", role: "tablist", "aria-label": "Sections de personnalisation" }, ...btns), ...panes];
  },
});
