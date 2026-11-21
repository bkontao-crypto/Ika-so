// Centre « Utilisateurs » : annuaire filtrable (agrégats, segments, dates, export) et centre d'analyse d'un compte.
// Toutes les valeurs viennent de /staff/owner/users* ; ce qui n'est pas collecté est affiché comme tel.
import { api, h, ico, panel, empty, skeletons, errorBox, table, bars, pill, nf, fcfa, dateTime, dateOnly, ago, initials, formDialog, act, fail, toast, areaChart, shortDay } from "./ui.js";

const SEG = { active: ["ok", "Actif"], standby: ["warn", "En veille"], inactive: ["bad", "Inactif"], never: ["neutral", "Jamais connecté"] };
const ADV = { confirmed: ["ok", "Confirmé"], unconfirmed: ["warn", "Non confirmé"], none: ["neutral", "—"] };
const ST = { ACTIVE: ["ok", "Actif"], RESTRICTED: ["warn", "Restreint"], BANNED: ["bad", "Bloqué"] };
const METHOD = { PASSWORD: "Mot de passe", GOOGLE: "Google", REGISTER: "Inscription", TICKET: "Application" };
const SIG = { high: "bad", medium: "warn", low: "info" };
const dur = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`);
const mini = (l, v, sub) => h("div", { class: "card mini" }, h("small", null, l), h("strong", null, v), sub ? h("small", null, sub) : null);
const grid = (n, ...m) => { const e = h("div", { class: "mini-stats" }, m); e.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; return e; };
const seg = (v) => pill(...SEG[v] ?? ["neutral", v]);
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v != null)).toString();

const state = { q: "", segment: "", status: "", role: "", advertiser: "", listings: "", premium: "", verified: "", dateField: "created", from: "", to: "", sort: "created", dir: "desc", page: 1 };

function select(name, label, options, onChange) {
  const el = h("select", { class: "input", "aria-label": label }, options.map(([v, t]) => h("option", { value: v }, t)));
  el.value = state[name];
  el.addEventListener("change", () => { state[name] = el.value; state.page = 1; onChange(); });
  return h("label", { class: "field" }, label, el);
}

export function usersView(ctx) {
  const root = h("div", { class: "view" });
  const aggBox = h("div");
  const listBox = h("div");
  const head = h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, "PILOTAGE"), h("h1", null, "Utilisateurs & comptes"),
    h("p", null, "Tous les comptes, leur dernière connexion et leur activité réelle. Cliquez sur un compte pour ouvrir son centre d'analyse.")));

  async function loadAgg() {
    aggBox.replaceChildren(skeletons(1, 90));
    try {
      const a = await api("/staff/owner/users/aggregates");
      const s = a.segments;
      aggBox.replaceChildren(
        grid(6, mini("Comptes", nf(a.total), `${nf(a.newUsers.d7)} nouveaux · 7 j`), mini("Actifs", nf(s.active), a.definitions.active), mini("En veille", nf(s.standby), a.definitions.standby),
          mini("Inactifs", nf(s.inactive), a.definitions.inactive), mini("Jamais connectés", nf(s.never), "aucune connexion enregistrée"), mini("Bloqués / restreints", `${nf(a.sanctions.banned)} / ${nf(a.sanctions.restricted)}`)),
        grid(6, mini("Annonceurs confirmés", nf(a.advertisers.confirmed)), mini("Annonceurs non confirmés", nf(a.advertisers.unconfirmed), "demande en cours ou refusée"), mini("Avec ≥ 1 annonce", nf(a.advertisers.withListing)),
          mini("Premium actifs", nf(a.premium)), mini("Connexions / actif · 30 j", String(a.frequency.avgLogins30d).replace(".", ","), `${nf(a.frequency.high)} assidus (12+) · ${nf(a.frequency.mid)} réguliers (4–11) · ${nf(a.frequency.low)} rares (1–3)`),
          mini("Visiteurs connectés 24 h / 7 j / 30 j", `${nf(a.usage.dau)} / ${nf(a.usage.wau)} / ${nf(a.usage.mau)}`, a.usage.stickiness == null ? "—" : `Rapport 24 h / 30 j : ${String(a.usage.stickiness).replace(".", ",")} %`)),
        a.usage.historySince ? h("p", { class: "note" }, `Historique de connexion détaillé disponible depuis le ${dateOnly(a.usage.historySince)} ; avant cette date, seule la dernière connexion connue est utilisée.`) : h("p", { class: "note" }, "Historique de connexion détaillé : en cours de constitution (premières connexions à venir)."));
    } catch (e) { aggBox.replaceChildren(errorBox(e.message, loadAgg)); }
  }

  async function loadList() {
    listBox.replaceChildren(skeletons(2, 100));
    try {
      const r = await api(`/staff/owner/users?${qs(state)}`);
      const sortBtn = (key, label) => h("button", { class: "btn sm", type: "button", onClick: () => { state.dir = state.sort === key && state.dir === "desc" ? "asc" : "desc"; state.sort = key; loadList(); } }, label, state.sort === key ? (state.dir === "desc" ? " ↓" : " ↑") : "");
      const t = table([
        { label: "Compte", render: (u) => h("button", { class: "linkbtn", type: "button", onClick: () => ctx.go(`#/users/${encodeURIComponent(u.userId)}`) },
          h("div", { class: "row" }, h("span", { class: "avatar" }, initials(u.fullName)), h("div", { class: "item" }, h("b", null, u.fullName), h("small", null, `${u.userId} · ${u.email}`)))) },
        { label: "Rôle", render: (u) => pill(u.staffRole === "USER" ? "neutral" : "info", u.staffRole) },
        { label: "Activité", render: (u) => seg(u.segment) },
        { label: "Dernière connexion", render: (u) => u.lastLoginAt ? h("span", { title: dateTime(u.lastLoginAt) }, ago(u.lastLoginAt)) : "—" },
        { label: "Conn. 30 j", num: true, render: (u) => nf(u.logins30d) },
        { label: "Annonces", num: true, render: (u) => nf(u.listings) },
        { label: "Annonceur", render: (u) => pill(...ADV[u.advertiser]) },
        { label: "Statut", render: (u) => h("span", null, pill(...ST[u.accountStatus]), u.statusUntil ? h("small", null, ` jusqu'au ${dateOnly(u.statusUntil)}`) : null) },
        { label: "Inscrit le", render: (u) => dateOnly(u.createdAt) },
      ], r.items, { emptyText: "Aucun compte ne correspond à ces filtres." });
      listBox.replaceChildren(panel(`Comptes (${nf(r.total)})`, "Trier par", h("div", null, t,
        h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", disabled: r.page <= 1, onClick: () => { state.page--; loadList(); } }, "Précédent"), h("span", { class: "muted" }, ` Page ${r.page} / ${r.pages} `),
          h("button", { class: "btn sm", type: "button", disabled: r.page >= r.pages, onClick: () => { state.page++; loadList(); } }, "Suivant"))),
        h("div", { class: "row" }, sortBtn("login", "Dernière connexion"), sortBtn("created", "Inscription"), sortBtn("logins", "Fréquence"), sortBtn("listings", "Annonces"), sortBtn("name", "Nom"))));
    } catch (e) { listBox.replaceChildren(errorBox(e.message, loadList)); }
  }

  const search = h("input", { class: "input", type: "search", placeholder: "Identifiant, nom, e-mail ou téléphone…", "aria-label": "Rechercher un compte", value: state.q });
  let timer;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.q = search.value.trim(); state.page = 1; loadList(); }, 300); });
  const date = (name, label) => { const el = h("input", { class: "input", type: "date", "aria-label": label, value: state[name] }); el.addEventListener("change", () => { state[name] = el.value; state.page = 1; loadList(); }); return h("label", { class: "field" }, label, el); };
  const L = () => loadList();
  const filters = h("div", { class: "card panel stack" }, h("div", { class: "filtergrid" }, h("label", { class: "field" }, "Recherche", search),
    select("segment", "Activité", [["", "Tous"], ["active", "Actifs"], ["standby", "En veille"], ["inactive", "Inactifs"], ["never", "Jamais connectés"]], L),
    select("advertiser", "Annonceur", [["", "Tous"], ["confirmed", "Confirmés"], ["unconfirmed", "Non confirmés"], ["none", "Pas annonceur"]], L),
    select("listings", "Annonces", [["", "Toutes"], ["with", "Au moins une"], ["without", "Aucune"]], L),
    select("status", "Statut", [["", "Tous"], ["ACTIVE", "Actifs"], ["RESTRICTED", "Restreints"], ["BANNED", "Bloqués"]], L),
    select("role", "Rôle", [["", "Tous"], ["USER", "Utilisateurs"], ["STAFF", "Équipe"], ["MODERATOR", "Modérateurs"], ["ADMIN", "Admins"], ["SUPERADMIN", "Superadmins"]], L),
    select("premium", "Premium", [["", "Tous"], ["yes", "Premium"], ["no", "Non premium"]], L),
    select("verified", "Téléphone", [["", "Tous"], ["yes", "Vérifié"], ["no", "Non vérifié"]], L),
    select("dateField", "Dates portent sur", [["created", "Inscription"], ["login", "Dernière connexion"]], L), date("from", "Du"), date("to", "Au")),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onClick: () => { Object.assign(state, { q: "", segment: "", status: "", role: "", advertiser: "", listings: "", premium: "", verified: "", dateField: "created", from: "", to: "", page: 1 }); ctx.refresh(); } }, "Réinitialiser"),
      h("a", { class: "btn", href: "#", download: "utilisateurs.csv", onClick: (e) => { e.currentTarget.href = `/api/staff/owner/users/export.csv?${qs(state)}`; } }, ico("download"), "Exporter (CSV)")));
  root.append(head, aggBox, filters, listBox);
  loadAgg(); loadList();
  return root;
}

// ---------- Centre d'analyse d'un compte ----------
export function userCenterView(ctx, userId) {
  const root = h("div", { class: "view" });
  async function reload() {
    root.replaceChildren(skeletons(3, 110));
    try { root.replaceChildren(...build(await api(`/staff/owner/users/${encodeURIComponent(userId)}/analysis`))); } catch (e) { if (!e.stale) root.replaceChildren(h("button", { class: "btn", type: "button", onClick: () => ctx.go("#/users") }, "← Tous les comptes"), errorBox(e.message, reload)); }
  }

  async function sanction(u) {
    const v = await formDialog("Sanction du compte", [
      { name: "status", label: "Décision", type: "select", options: [{ value: "ACTIVE", label: "Lever la sanction (réactiver)" }, { value: "RESTRICTED", label: "Restreindre (ni publication, ni commentaire)" }, { value: "BANNED", label: "Bloquer (accès refusé, annonces masquées)" }], value: u.accountStatus },
      { name: "duration", label: "Durée", type: "select", options: [{ value: "", label: "Sans date de fin (à vie pour un blocage)" }, { value: "1", label: "24 heures" }, { value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "365", label: "1 an" }, { value: "custom", label: "Jusqu'à une date précise…" }] },
      { name: "until", label: "Date de fin (si « date précise »)", type: "date" },
      { name: "reason", label: "Motif (obligatoire sauf réactivation)", type: "textarea", max: 500 }], { intro: `${u.fullName} · ${u.userId}. La décision est enregistrée dans le journal d'audit.` });
    if (!v) return;
    let until = null;
    if (v.status !== "ACTIVE") {
      if (v.duration === "custom") { if (!v.until) { toast("Choisissez une date de fin.", true); return; } until = new Date(`${v.until}T23:59:59`).toISOString(); }
      else if (v.duration) until = new Date(Date.now() + Number(v.duration) * 86_400_000).toISOString();
    }
    act(() => api(`/staff/accounts/${encodeURIComponent(u.userId)}/status`, { method: "POST", body: { status: v.status, reason: v.reason, until } }), "Décision enregistrée.", reload);
  }

  function build(a) {
    const u = a.user; const c = a.contactsReceived; const e = a.engagement;
    const [stTone, stLabel] = ST[u.accountStatus];
    const hero = h("div", { class: "card panel" }, h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: () => ctx.go("#/users") }, "← Tous les comptes")),
      h("div", { class: "row" }, h("span", { class: "avatar" }, initials(u.fullName)), h("div", { class: "item" }, h("h1", null, u.fullName), h("small", null, `${u.userId} · ${u.email}${u.phone ? ` · ${u.phone}` : ""}`))),
      h("div", { class: "row" }, seg(u.segment), pill(stTone, "Compte " + stLabel.toLowerCase() + (u.statusUntil ? ` jusqu'au ${dateOnly(u.statusUntil)}` : u.accountStatus === "ACTIVE" ? "" : " · sans date de fin")), pill("info", u.staffRole), pill(...ADV[u.advertiser].map((x, i) => (i ? `Annonceur ${x.toLowerCase()}` : x))), u.premium ? pill("ok", "Premium") : null, u.phoneVerified ? pill("ok", "Téléphone vérifié") : pill("neutral", "Téléphone non vérifié"),
        a.auth.google ? pill("neutral", "Google lié") : null),
      u.statusReason ? h("p", { class: "note bad" }, `Motif de la sanction : ${u.statusReason}`) : null,
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => sanction(u) }, ico("shield"), "Sanction / réactivation"),
        h("button", { class: "btn", type: "button", onClick: () => ctx.go(`#/trace/user/${encodeURIComponent(u.userId)}`) }, ico("route"), "Dossier de traçage complet"),
        h("button", { class: "btn", type: "button", title: "Lien valable 30 minutes, usage unique, à transmettre à la personne", onClick: async () => {
          try { const l = await api(`/staff/accounts/${encodeURIComponent(u.userId)}/reset-link`, { method: "POST", body: {} }); await formDialog("Lien de réinitialisation", [{ name: "link", label: `À transmettre uniquement à ${u.fullName} (${l.validMinutes} min, usage unique)`, value: l.link, max: 500 }], { submit: "Fermer" }); } catch (err) { fail(err); }
        } }, "Lien mot de passe"),
        ctx.isSuperadmin() ? h("button", { class: "btn", type: "button", onClick: async () => { const v = await formDialog("Rôle équipe", [{ name: "role", label: "Rôle", type: "select", options: ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"], value: u.staffRole }], { intro: "Le dernier SUPERADMIN actif ne peut pas être rétrogradé." }); if (v) act(() => api(`/staff/accounts/${encodeURIComponent(u.userId)}/role`, { method: "POST", body: v }), "Rôle mis à jour.", reload); } }, "Rôle") : null));

    const signals = a.signals.length ? h("div", { class: "stack" }, a.signals.map((s) => h("div", { class: "row" }, pill(SIG[s.level], s.level === "high" ? "Élevé" : s.level === "medium" ? "Moyen" : "Faible"), h("span", null, s.label))))
      : h("p", { class: "muted" }, "Aucun signal particulier détecté.");

    const kpis = [grid(6, mini("Inscrit", dateOnly(u.createdAt), ago(u.createdAt)), mini("Dernière connexion", u.lastLoginAt ? ago(u.lastLoginAt) : "—", u.lastLoginAt ? dateTime(u.lastLoginAt) : "aucune enregistrée"),
      mini("Connexions", nf(a.logins.total), `${nf(a.logins.last30)} sur 30 jours`), mini("Annonces", nf(u.listings), `${nf(u.published)} publiées`), mini("Appels reçus", nf(c.calls), `${nf(c.calls30)} · 30 j`), mini("WhatsApp reçus", nf(c.whatsapp), `${nf(c.whatsapp30)} · 30 j`)),
      grid(6, mini("Appels passés", nf(a.contactsMade.calls)), mini("WhatsApp lancés", nf(a.contactsMade.whatsapp)), mini("Clics profil (appel / WhatsApp)", `${nf(c.profileCalls)} / ${nf(c.profileWhatsapp)}`), mini("Favoris", nf(e.favorites)), mini("Conversations", nf(e.threads)), mini("Paiements", nf(e.payments), fcfa(e.paidXof)))];

    const labels = a.logins.days.map((d) => shortDay(d.day));
    const loginChart = panel("Connexions · 30 jours", `${nf(a.logins.last30)} connexion(s)`, areaChart({ labels, series: [{ key: "n", name: "Connexions", color: "#087448", values: a.logins.days.map((d) => d.n) }], height: 170 }));
    const contactChart = panel("Appels et WhatsApp reçus · 30 jours", "Clics sur ses annonces", areaChart({ labels, series: [{ key: "c", name: "Appels", color: "#477eaa", values: c.days.map((d) => d.calls) }, { key: "w", name: "WhatsApp", color: "#087448", values: c.days.map((d) => d.whatsapp) }], height: 170 }));

    const recent = panel("Dernières connexions", a.logins.methods.map((m) => `${METHOD[m.method] ?? m.method} : ${m.n}`).join(" · ") || "Aucune connexion dans l'historique détaillé",
      table([{ label: "Quand", render: (r) => dateTime(r.at) }, { label: "Méthode", render: (r) => METHOD[r.method] ?? r.method }], a.logins.recent, { emptyText: "Aucune connexion enregistrée." }));

    const listings = panel("Annonces et performance", "Appels et WhatsApp reçus par annonce", table([
      { label: "Annonce", render: (l) => h("div", { class: "item" }, h("b", null, l.title), h("small", null, `${l.id} · ${dateOnly(l.createdAt)}`)) },
      { label: "Statut", render: (l) => pill(l.status === "PUBLISHED" ? "ok" : l.status === "REJECTED" ? "bad" : "neutral", l.status) },
      { label: "Vues", num: true, render: (l) => nf(l.views) }, { label: "Durée moy.", num: true, render: (l) => (l.avgSeconds == null ? "—" : dur(l.avgSeconds)) }, { label: "Appels", num: true, render: (l) => nf(l.calls) }, { label: "WhatsApp", num: true, render: (l) => nf(l.whatsapp) },
      { label: "Favoris", num: true, render: (l) => nf(l.favorites) }, { label: "Signal.", num: true, render: (l) => nf(l.reports) },
      { label: "", render: (l) => h("button", { class: "btn sm", type: "button", onClick: () => ctx.go(`#/trace/listing/${encodeURIComponent(l.id)}`) }, "Retracer") }], a.listings, { emptyText: "Aucune annonce déposée." }));

    const an = a.analytics;
    const usage = panel("Comportement sur le site", (an.collecting ? `${nf(an.eventsLast30d)} événement(s) · 30 jours` : "Collecte d'usage désactivée") + (an.consent ? ` · accord ${an.consent.accepted ? "donné" : "refusé"} le ${dateOnly(an.consent.decidedAt)}` : " · aucun choix enregistré"),
      h("div", { class: "stack" }, an.byType.length ? bars(an.byType.map((t) => ({ label: t.type, value: t.n }))) : h("p", { class: "muted" }, "Aucun événement d'usage rattaché à ce compte."),
        an.watching.visits ? h("p", null, `Fiches consultées par ce compte : ${nf(an.watching.listings)} · ${nf(an.watching.visits)} visite(s) mesurée(s) · durée moyenne ${dur(an.watching.avgSeconds)} · temps total ${dur(an.watching.totalSeconds)}.`) : h("p", { class: "muted" }, "Aucune durée de visionnage mesurée pour ce compte."),
        an.notCollected.length ? h("p", { class: "note" }, `Non collecté : ${an.notCollected.join(" ; ")}.`) : null));

    const sanc = panel("Sanctions et décisions", "Historique des mesures prises sur ce compte", a.sanctions.history.length ? table([{ label: "Date", render: (s) => dateTime(s.at) }, { label: "Type", render: (s) => (s.action === "SANCTION" ? "Décision" : "Fin automatique") }, { label: "Détail", render: (s) => s.note }, { label: "Par", render: (s) => s.actorId?.slice(0, 12) }], a.sanctions.history)
      : h("p", { class: "muted" }, "Aucune sanction enregistrée."));

    const audits = panel("Journal d'audit lié au compte", "Actions faites par ce compte ou sur ce compte (40 dernières)", table([{ label: "Date", render: (r) => dateTime(r.at) }, { label: "Source", render: (r) => r.source }, { label: "Action", render: (r) => r.action },
      { label: "Détail", render: (r) => h("small", null, r.detail) }], a.audits, { emptyText: "Aucune trace d'audit." }));

    const trust = panel("Confiance et signalements", null, h("div", { class: "stack" }, grid(4, mini("Signalements sur ses annonces", nf(e.reportsOnListings)), mini("Signalements faits", nf(e.reportsMade)), mini("Conversations signalées", nf(e.userReportsAgainst)), mini("Avis reçus", nf(e.reviewsReceived))), signals));

    // Validations Premium (qui, quand) et exceptions aux conditions : traçabilité visible côté équipe seulement.
    const who = (s) => `${s.doneByName} · ${dateTime(s.doneAt)}${s.note ? ` · « ${s.note} »` : ""}`;
    const files = panel("Dossiers Premium et validations", "Qui a validé chaque étape, et quand (noms visibles de l'équipe seulement)", (a.premiumFiles ?? []).length
      ? h("div", { class: "stack" }, a.premiumFiles.map((f) => h("div", { class: "item" },
        h("div", { class: "row" }, pill(f.status === "APPROVED" ? "ok" : f.status === "PENDING" ? "warn" : "neutral", { PENDING: "En attente", APPROVED: "Approuvé", REJECTED: "Refusé", CANCELLED: "Retiré" }[f.status] ?? f.status), h("b", null, `${f.paid ? "Payé" : `${f.months} mois demandés`} · ${dateTime(f.createdAt)}`)),
        ...[1, 2, 3].map((n) => { const s = f.steps.find((x) => x.step === n); return h("small", null, `Étape ${n} ${STEP_LABELS[n]} : ${s ? who(s) : "non validée"}`); }),
        f.decidedAt ? h("small", null, `Décision : ${f.decidedByName ?? "—"} · ${dateTime(f.decidedAt)}${f.decidedNote ? ` · « ${f.decidedNote} »` : ""}`) : null,
        f.refund ? h("div", { class: "stack" }, h("b", null, `Remboursement ${f.refund.status === "DONE" ? "clôturé" : "à suivre"}`), ...[1, 2, 3].map((n) => { const s = f.refund.steps.find((x) => x.step === n); return h("small", null, `Étape ${n} ${["Paiement vérifié", "Remboursement effectué", "Annonceur informé"][n - 1]} : ${s ? who(s) : "non validée"}`); })) : null)))
      : h("p", { class: "muted" }, "Aucun dossier Premium."));
    const catalogue = a.exceptionCatalogue ?? {};
    const canGrant = ctx.isSuperadmin() || a.rules?.exceptionGrantedBy === "ADMIN";
    const exc = panel("Exceptions aux conditions (jurisprudence)", `Conditions officielles levées pour ce compte seulement · accordées par ${a.rules?.exceptionGrantedBy === "ADMIN" ? "un administrateur ou le superadmin" : "le superadmin"}`, h("div", { class: "stack" },
      (a.ruleExceptions ?? []).length ? table([
        { label: "Condition levée", render: (x) => x.label },
        { label: "Accordée par", render: (x) => h("div", { class: "item" }, h("b", null, x.grantedByName), h("small", null, dateTime(x.createdAt)), x.expiresAt ? h("small", null, `jusqu'au ${dateOnly(x.expiresAt)}`) : h("small", null, "sans limite")) },
        { label: "Motif", render: (x) => h("small", null, x.reason) },
        { label: "État", render: (x) => (x.active ? pill("warn", "Active") : h("div", { class: "item" }, pill("neutral", x.revokedAt ? "Révoquée" : "Expirée"), x.revokedAt ? h("small", null, `${x.revokedByName ?? "—"} · ${dateTime(x.revokedAt)}${x.revokedReason ? ` · « ${x.revokedReason} »` : ""}`) : null)) },
        { label: "", render: (x) => (x.active && canGrant ? h("button", { class: "btn sm", type: "button", onClick: async () => { const v = await formDialog("Révoquer l'exception", [{ name: "reason", label: "Motif (obligatoire)", type: "textarea", required: true, max: 300 }], { submit: "Révoquer" }); if (v) act(() => api(`/staff/rule-exceptions/${encodeURIComponent(x.id)}/revoke`, { method: "POST", body: { reason: v.reason } }), "Exception révoquée.", reload); } }, "Révoquer") : null) },
      ], a.ruleExceptions, { emptyText: "" }) : h("p", { class: "muted" }, "Aucune exception : les conditions officielles s'appliquent à ce compte."),
      canGrant ? h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onClick: async () => {
        const v = await formDialog("Accorder une exception", [
          { name: "rule", label: "Condition à lever", type: "select", options: Object.entries(catalogue).map(([value, label]) => ({ value, label })) },
          { name: "reason", label: "Motif (obligatoire, conservé dans l'historique)", type: "textarea", required: true, max: 500 },
          { name: "days", label: "Durée en jours (vide = jusqu'à révocation)", type: "number", min: 1, max: 365 }],
        { intro: "Votre nom, la date et le motif seront enregistrés sur la fiche de ce compte.", submit: "Accorder" });
        if (v) act(() => api(`/staff/owner/users/${encodeURIComponent(userId)}/rule-exceptions`, { method: "POST", body: { rule: v.rule, reason: v.reason, days: v.days || null } }), "Exception accordée.", reload);
      } }, "Accorder une exception")) : h("p", { class: "small muted" }, "Seul le superadmin peut accorder une exception (réglage « Conditions & exceptions »).")));
    return [hero, ...kpis, h("div", { class: "cols2" }, loginChart, contactChart), h("div", { class: "cols2" }, trust, usage), files, exc, listings, h("div", { class: "cols2" }, recent, sanc), audits];
  }
  reload();
  return root;
}
