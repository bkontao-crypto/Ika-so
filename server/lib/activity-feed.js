// Journal unifié des mouvements du site (Owner Control Center).
// Principe : AUCUNE copie. Chaque « source » lit une table existante (annonces, contacts, paiements, messages, audit…) et le serveur
// fusionne les résultats par date. L'historique réel est donc disponible dès le premier jour, sans attendre une collecte.
// Vie privée : le contenu des messages privés n'est jamais lu ; aucune adresse IP ; les téléphones et e-mails ne sont pas projetés.
// Module pur (aucune dépendance à la base) : testé avec une fausse base dans test/owner-center.test.js.

export const CATEGORIES = Object.freeze([
  { key: "admin", label: "Équipe & administration" },
  { key: "account", label: "Comptes" },
  { key: "security", label: "Connexions" },
  { key: "listing", label: "Annonces" },
  { key: "engagement", label: "Interactions" },
  { key: "safety", label: "Signalements & confiance" },
  { key: "finance", label: "Paiements" },
  { key: "growth", label: "Marketing & CRM" },
  { key: "system", label: "Système" },
  { key: "traffic", label: "Fréquentation" },
]);
export const CATEGORY_KEYS = Object.freeze(CATEGORIES.map((c) => c.key));
/** La fréquentation (pages vues) est volumineuse : masquée par défaut, activable d'un clic. */
export const DEFAULT_CATEGORIES = Object.freeze(CATEGORY_KEYS.filter((k) => k !== "traffic"));

const NULL = "null::text";
const US = (col) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const profile = (alias, on) => `left join ika_profiles ${alias} on ${alias}.user_id = ${on}`;
const listing = (alias, on) => `left join ika_listings ${alias} on ${alias}.id = ${on}`;

/**
 * Définition d'une source. Les fragments SQL sont des constantes écrites ici (jamais de texte venant de l'utilisateur) ;
 * toutes les valeurs saisies passent en paramètres ($1, $2…).
 *  time : colonne date · id : identifiant · actor / actorName : auteur · object* : objet concerné · code : type d'événement
 *  listingCol : colonne « annonce » (trace d'annonce) · users : colonnes « personne » (trace de compte) · note : texte où figure un identifiant
 */
const S = (key, cat, label, o) => Object.freeze({ key, cat, label, base: "true", ...o });

export const SOURCES = Object.freeze([
  S("audit", "admin", "Actions de l'équipe", {
    from: `ika_audit a ${profile("ap", "a.actor_id")} ${listing("al", "a.listing_id")}`, base: "a.action <> 'LISTING_SUBMIT'", time: "a.created_at", id: "a.id",
    actor: "a.actor_id", actorName: "ap.full_name", objectType: "case when a.listing_id is not null then 'listing' end", objectId: "a.listing_id", objectLabel: "al.title",
    code: "a.action", detail: "a.note", listingCol: "a.listing_id", users: ["a.actor_id"], note: "a.note",
  }),
  S("account", "account", "Inscriptions", {
    from: "ika_profiles p", time: "p.created_at", id: "p.user_id", actor: "p.user_id", actorName: "p.full_name",
    objectType: "'user'", objectId: "p.user_id", objectLabel: "p.full_name", code: "'USER_REGISTERED'", detail: "p.display_role", users: ["p.user_id"],
  }),
  S("security", "security", "Connexions", {
    from: `ika_security_log s ${profile("sp", "s.user_id")}`, time: "s.occurred_at", id: "s.id", actor: "s.user_id", actorName: "sp.full_name",
    code: "'SEC_' || s.event", detail: "concat_ws(' · ', s.device_type, s.detail)", sev: "case when s.outcome = 'FAILED' then 'warn' end", users: ["s.user_id"],
  }),
  S("listing_created", "listing", "Annonces déposées", {
    from: `ika_listings l ${profile("lp", "l.owner_id")}`, time: "l.created_at", id: "l.id", actor: "l.owner_id", actorName: "coalesce(lp.full_name, l.owner_name)",
    objectType: "'listing'", objectId: "l.id", objectLabel: "l.title", code: "'LISTING_CREATED'",
    detail: "concat_ws(' · ', l.category, l.transaction_type, l.neighborhood, l.price::text || ' FCFA', l.status)", listingCol: "l.id", users: ["l.owner_id"],
  }),
  S("favorite", "engagement", "Favoris", {
    from: `ika_favorites f ${profile("fp", "f.user_id")} ${listing("fl", "f.listing_id")}`, time: "f.created_at", id: "f.user_id || ':' || f.listing_id", actor: "f.user_id", actorName: "fp.full_name",
    objectType: "'listing'", objectId: "f.listing_id", objectLabel: "fl.title", code: "'FAVORITE_ADDED'", listingCol: "f.listing_id", users: ["f.user_id"],
  }),
  S("comment", "engagement", "Commentaires", {
    from: `ika_comments c ${profile("cp", "c.user_id")} ${listing("cl", "c.listing_id")}`, time: "c.created_at", id: "c.id", actor: "c.user_id", actorName: "coalesce(cp.full_name, c.author_name)",
    objectType: "'listing'", objectId: "c.listing_id", objectLabel: "cl.title", code: "case when c.status = 'VISIBLE' then 'COMMENT_POSTED' else 'COMMENT_HIDDEN' end",
    detail: "case when c.status = 'VISIBLE' then left(c.body, 80) else 'Commentaire masqué par la modération' end", listingCol: "c.listing_id", users: ["c.user_id"],
  }),
  S("contact", "engagement", "Contacts (appel, WhatsApp)", {
    from: `ika_contact_events ce ${profile("cep", "ce.user_id")} ${listing("cel", "ce.listing_id")}`, time: "ce.created_at", id: "ce.id", actor: "ce.user_id", actorName: "cep.full_name",
    objectType: "'listing'", objectId: "ce.listing_id", objectLabel: "cel.title", code: "case ce.kind when 'CALL' then 'CONTACT_CALL' else 'CONTACT_WHATSAPP' end",
    detail: "case when ce.user_id is null then 'Visiteur non connecté' end", listingCol: "ce.listing_id", users: ["ce.user_id"],
  }),
  S("message", "engagement", "Messages (sans contenu)", {
    from: `ika_messages m join ika_threads t on t.id = m.thread_id ${profile("mp", "m.sender_id")} ${listing("ml", "t.listing_id")}`, time: "m.created_at", id: "m.id",
    actor: "m.sender_id", actorName: "mp.full_name", objectType: "'listing'", objectId: "t.listing_id", objectLabel: "ml.title", code: "'MESSAGE_SENT'",
    detail: "'Contenu privé non affiché'", listingCol: "t.listing_id", users: ["m.sender_id", "t.owner_id", "t.visitor_id"],
  }),
  S("visit", "engagement", "Demandes de visite", {
    from: `ika_visit_requests v ${profile("vp", "v.requester_id")} ${listing("vl", "v.listing_id")}`, time: "v.created_at", id: "v.id", actor: "v.requester_id", actorName: "vp.full_name",
    objectType: "'listing'", objectId: "v.listing_id", objectLabel: "vl.title", code: "'VISIT_REQUESTED'",
    detail: "concat_ws(' · ', v.status, 'visite proposée le ' || to_char(v.proposed_at at time zone 'UTC', 'DD/MM/YYYY HH24:MI'))", listingCol: "v.listing_id", users: ["v.requester_id", "v.owner_id"],
  }),
  S("review", "engagement", "Avis", {
    from: `ika_reviews rv ${profile("rvp", "rv.reviewer_id")} ${profile("rva", "rv.advertiser_id")}`, time: "rv.created_at", id: "rv.id", actor: "rv.reviewer_id", actorName: "rvp.full_name",
    objectType: "'user'", objectId: "rv.advertiser_id", objectLabel: "rva.full_name", code: "case when rv.status = 'VISIBLE' then 'REVIEW_POSTED' else 'REVIEW_HIDDEN' end",
    detail: "rv.rating::text || '/5'", users: ["rv.reviewer_id", "rv.advertiser_id"],
  }),
  S("report", "safety", "Signalements d'annonce", {
    from: `ika_reports r ${profile("rp", "r.reporter_id")} ${listing("rl", "r.listing_id")}`, time: "r.created_at", id: "r.id", actor: "r.reporter_id", actorName: "rp.full_name",
    objectType: "'listing'", objectId: "r.listing_id", objectLabel: "rl.title", code: "'REPORT_CREATED'", detail: "concat_ws(' · ', r.reason, r.status)",
    sev: "case when r.status in ('OPEN', 'IN_PROGRESS') then 'warn' end", listingCol: "r.listing_id", users: ["r.reporter_id"],
  }),
  S("user_report", "safety", "Signalements de personnes", {
    from: `ika_user_reports ur ${profile("urp", "ur.reporter_id")} ${profile("urr", "ur.reported_id")}`, time: "ur.created_at", id: "ur.id", actor: "ur.reporter_id", actorName: "urp.full_name",
    objectType: "'user'", objectId: "ur.reported_id", objectLabel: "urr.full_name", code: "'USER_REPORTED'", detail: "ur.reason", sev: "case when ur.status = 'OPEN' then 'warn' end",
    users: ["ur.reporter_id", "ur.reported_id"],
  }),
  S("proof", "safety", "Pièces justificatives", {
    from: `ika_proofs pr ${profile("prp", "pr.owner_id")} ${listing("prl", "pr.listing_id")}`, time: "pr.created_at", id: "pr.id", actor: "pr.owner_id", actorName: "prp.full_name",
    objectType: "case when pr.listing_id is not null then 'listing' end", objectId: "pr.listing_id", objectLabel: "prl.title", code: "'PROOF_SUBMITTED'",
    detail: "concat_ws(' · ', pr.kind, pr.status)", listingCol: "pr.listing_id", users: ["pr.owner_id"],
  }),
  S("payment", "finance", "Paiements initiés", {
    from: `ika_payments py ${profile("pyp", "py.user_id")} ${listing("pyl", "py.listing_id")}`, time: "py.created_at", id: "py.id", actor: "py.user_id", actorName: "pyp.full_name",
    objectType: "'listing'", objectId: "py.listing_id", objectLabel: "pyl.title", code: "'PAYMENT_CREATED'",
    detail: "concat_ws(' · ', py.offer_code, py.amount_xof::text || ' FCFA', py.status, py.provider)", listingCol: "py.listing_id", users: ["py.user_id"],
  }),
  S("payment_paid", "finance", "Paiements confirmés", {
    from: `ika_payments py ${profile("pyp", "py.user_id")} ${listing("pyl", "py.listing_id")}`, base: "py.paid_at is not null", time: "py.paid_at", id: "py.id || ':paid'", actor: "py.user_id", actorName: "pyp.full_name",
    objectType: "'listing'", objectId: "py.listing_id", objectLabel: "pyl.title", code: "'PAYMENT_PAID'",
    detail: "concat_ws(' · ', py.offer_code, py.amount_xof::text || ' FCFA', py.provider)", listingCol: "py.listing_id", users: ["py.user_id"],
  }),
  S("campaign", "growth", "Campagnes", {
    from: `ika_campaigns cg ${profile("cgp", "cg.created_by")}`, time: "cg.created_at", id: "cg.id", actor: "cg.created_by", actorName: "cgp.full_name",
    objectType: "'campaign'", objectId: "cg.id", objectLabel: "cg.name", code: "'CAMPAIGN_CREATED'", detail: "concat_ws(' · ', cg.kind, cg.status)", users: ["cg.created_by"],
  }),
  S("newsletter", "growth", "Newsletters rédigées", {
    from: `ika_newsletters nl ${profile("nlp", "nl.created_by")}`, time: "nl.created_at", id: "nl.id", actor: "nl.created_by", actorName: "nlp.full_name",
    objectType: "'newsletter'", objectId: "nl.id", objectLabel: "nl.subject", code: "'NEWSLETTER_DRAFTED'", detail: "nl.status", users: ["nl.created_by"],
  }),
  S("newsletter_sent", "growth", "Newsletters envoyées", {
    from: `ika_newsletters nl ${profile("nlp", "nl.created_by")}`, base: "nl.sent_at is not null", time: "nl.sent_at", id: "nl.id || ':sent'", actor: "nl.created_by", actorName: "nlp.full_name",
    objectType: "'newsletter'", objectId: "nl.id", objectLabel: "nl.subject", code: "'NEWSLETTER_SENT'", detail: "coalesce(nl.recipients::text || ' destinataire(s)', '')", users: ["nl.created_by"],
  }),
  S("crm", "growth", "Pipeline CRM", {
    from: `ika_crm_pipeline cp ${profile("cpp", "cp.created_by")} ${listing("cpl", "cp.listing_id")}`, time: "cp.created_at", id: "cp.id", actor: "cp.created_by", actorName: "cpp.full_name",
    objectType: "case when cp.listing_id is not null then 'listing' end", objectId: "cp.listing_id", objectLabel: "cpl.title", code: "'CRM_LEAD_CREATED'", detail: "cp.stage",
    listingCol: "cp.listing_id", users: ["cp.created_by"],
  }),
  S("incident", "system", "Incidents", {
    from: "ika_incidents i", time: "i.created_at", id: "i.id", code: "'INCIDENT_OPENED'", detail: "concat_ws(' · ', i.kind, i.message)",
    sev: "case i.severity when 'CRITICAL' then 'bad' when 'WARNING' then 'warn' else 'info' end",
  }),
  S("backup", "system", "Sauvegardes", {
    from: `ika_backup_log b ${profile("bp", "b.created_by")}`, time: "b.created_at", id: "b.id", actor: "b.created_by", actorName: "bp.full_name",
    code: "'BACKUP_' || coalesce(b.status, 'LOGGED')", detail: "concat_ws(' · ', case when b.auto then 'automatique' else 'manuelle' end, b.file_name, b.error)",
    sev: "case when b.status = 'FAILED' then 'bad' end", users: ["b.created_by"],
  }),
  S("traffic", "traffic", "Pages et annonces consultées", {
    from: `ika_analytics_events e ${listing("el", "e.listing_id")}`, base: "e.is_bot = false and e.event_type in ('page_view', 'listing_view')", time: "e.occurred_at", id: "e.event_id",
    actor: "e.user_id", objectType: "case when e.listing_id is not null then 'listing' end", objectId: "e.listing_id", objectLabel: "el.title",
    code: "upper(e.event_type)", detail: "concat_ws(' · ', e.page_path, e.device_type, e.source)", listingCol: "e.listing_id", users: ["e.user_id"],
  }),
]);
export const SOURCE_KEYS = Object.freeze(SOURCES.map((s) => s.key));

const escapeLike = (v) => String(v).replace(/[\\%_]/g, (m) => `\\${m}`);

/** Sources retenues : `sources` explicites, sinon celles des catégories demandées (par défaut : tout sauf la fréquentation). */
export function selectSources({ sources, categories } = {}) {
  if (sources?.length) return SOURCES.filter((s) => sources.includes(s.key));
  const cats = categories?.length ? categories : DEFAULT_CATEGORIES;
  return SOURCES.filter((s) => cats.includes(s.cat));
}

/**
 * Requête d'une source. `filters` : { actor, q, listingId, userId } ; `range` : { from, before, limit }.
 * Renvoie null si la source ne peut pas répondre au filtre demandé (ex. trace d'annonce sur une source sans colonne annonce).
 */
export function buildSourceQuery(source, filters = {}, range) {
  const params = [range.from, range.before, range.limit];
  const where = [source.base, `${source.time} >= $1::timestamptz`, `${source.time} < $2::timestamptz`];
  const add = (value) => { params.push(value); return `$${params.length}`; };
  if (filters.actor) {
    if (!source.actor) return null;
    where.push(`${source.actor} = ${add(filters.actor)}`);
  }
  if (filters.listingId) {
    if (!source.listingCol) return null;
    where.push(`${source.listingCol} = ${add(filters.listingId)}`);
  }
  if (filters.userId) {
    if (!source.users?.length) return null;
    const p = add(filters.userId);
    const parts = source.users.map((c) => `${c} = ${p}`);
    if (source.note) parts.push(`strpos(coalesce(${source.note}, ''), ${p}) > 0`);
    where.push(`(${parts.join(" or ")})`);
  }
  if (filters.q) {
    const p = add(`%${escapeLike(filters.q)}%`);
    const cols = [source.id, source.actor, source.actorName, source.objectId, source.objectLabel, source.detail, source.code].filter(Boolean);
    where.push(`(${cols.map((c) => `coalesce((${c})::text, '') ilike ${p}`).join(" or ")})`);
  }
  const sql = `select ${source.id} as id, ${US(source.time)} as at_us, ${source.actor ?? NULL} as actor_id, ${source.actorName ?? NULL} as actor_name,
    ${source.objectType ?? NULL} as object_type, ${source.objectId ?? NULL} as object_id, ${source.objectLabel ?? NULL} as object_label,
    (${source.code})::text as code, ${source.detail ?? NULL} as detail, ${source.sev ?? NULL} as sev
    from ${source.from} where ${where.join(" and ")} order by ${source.time} desc limit $3`;
  return { sql, params };
}

// ---------- Libellés ----------
// [libellé, ton] ; ton : ok (vert), info (bleu), warn (or), bad (rouge), neutral
const L = {
  USER_REGISTERED: ["Nouvelle inscription", "ok"], SEC_REGISTER: ["Création de compte", "ok"], SEC_LOGIN: ["Connexion", "neutral"], SEC_LOGIN_FAILED: ["Échec de connexion", "warn"], SEC_LOGOUT: ["Déconnexion", "neutral"],
  LISTING_CREATED: ["Annonce déposée", "info"], FAVORITE_ADDED: ["Ajout aux favoris", "neutral"], COMMENT_POSTED: ["Commentaire publié", "neutral"], COMMENT_HIDDEN: ["Commentaire masqué", "warn"],
  CONTACT_CALL: ["Clic « Appeler »", "info"], CONTACT_WHATSAPP: ["Clic « WhatsApp »", "info"], MESSAGE_SENT: ["Message envoyé", "neutral"], VISIT_REQUESTED: ["Demande de visite", "info"],
  REVIEW_POSTED: ["Avis publié", "neutral"], REVIEW_HIDDEN: ["Avis masqué", "warn"], REPORT_CREATED: ["Annonce signalée", "warn"], USER_REPORTED: ["Personne signalée", "warn"], PROOF_SUBMITTED: ["Pièce déposée", "info"],
  PAYMENT_CREATED: ["Paiement initié", "info"], PAYMENT_PAID: ["Paiement confirmé", "ok"], CAMPAIGN_CREATED: ["Campagne créée", "ok"], NEWSLETTER_DRAFTED: ["Newsletter rédigée", "neutral"], NEWSLETTER_SENT: ["Newsletter envoyée", "ok"],
  CRM_LEAD_CREATED: ["Contact ajouté au pipeline", "info"], INCIDENT_OPENED: ["Incident ouvert", "bad"], BACKUP_OK: ["Sauvegarde vérifiée", "ok"], BACKUP_FAILED: ["Sauvegarde en échec", "bad"], BACKUP_LOGGED: ["Sauvegarde notée", "neutral"],
  PAGE_VIEW: ["Page consultée", "neutral"], LISTING_VIEW: ["Annonce consultée", "neutral"],
  // Actions de l'équipe (ika_audit)
  APPROVE: ["Annonce approuvée", "ok"], REJECT: ["Annonce refusée", "bad"], FEATURE: ["Mise à la une", "ok"], UNFEATURE: ["Retrait de la une", "neutral"], SANCTION: ["Sanction de compte", "bad"],
  RANKING_WEIGHTS: ["Pondérations des classements", "info"], HIDE_PROFILE_IMAGES: ["Photos de profil masquées", "warn"], SHOW_PROFILE_IMAGES: ["Photos de profil rétablies", "ok"], STAFF_ROLE: ["Changement de rôle", "warn"],
  DISMISS_REPORT: ["Signalement écarté", "neutral"], LISTING_EDIT: ["Annonce modifiée", "info"], HIDE_COMMENT: ["Commentaire masqué", "warn"], HIDE_REVIEW: ["Avis masqué", "warn"], DISMISS_REVIEW_REPORTS: ["Signalements d'avis écartés", "neutral"],
  VIEW_PROOF: ["Pièce consultée", "info"], VIEW_ADVERTISER_SHEET: ["Fiche annonceur consultée", "info"], OFFER_SET: ["Formule modifiée", "info"], PAYMENT_REFUND: ["Remboursement noté", "warn"], PAYMENT_REFUND_PARTIAL: ["Remboursement partiel à traiter", "bad"],
  PROOF_ACCEPT: ["Pièce acceptée", "ok"], PROOF_REFUSE: ["Pièce refusée", "bad"], BADGE_REVOKE: ["Badge retiré", "warn"], BLACKLIST_ADD: ["Ajout liste noire", "bad"], BLACKLIST_REMOVE: ["Retrait liste noire", "neutral"],
  ALERT_CLOSE: ["Alerte close", "neutral"], DISMISS_COMMENT_REPORTS: ["Signalements de commentaire écartés", "neutral"], DISMISS_USER_REPORTS: ["Signalements de personne écartés", "neutral"],
  GEO_SAVE: ["Localisation enregistrée", "info"], GEO_DELETE: ["Localisation supprimée", "warn"], IMPORT_CSV: ["Import CSV d'annonces", "info"], HOMEPAGE_SAVE: ["Page d'accueil modifiée", "info"], HOMEPAGE_IMAGE_UPLOAD: ["Photo d'accueil importée", "info"],
  OFFER_CREATE: ["Formule créée", "ok"], OFFER_TOGGLE: ["Formule activée/désactivée", "info"], RESTORE_LOG: ["Restauration notée", "warn"], LOGO_UPDATE: ["Logo modifié", "info"], NEWSLETTER_CREATE: ["Newsletter créée", "neutral"],
  NEWSLETTER_SEND: ["Newsletter envoyée", "ok"], LEGAL_UPDATE: ["Pages légales modifiées", "warn"], SEO_UPDATE: ["Réglages SEO modifiés", "info"], BROADCAST: ["Notification collective", "info"], CRM_PIPELINE_CREATE: ["Pipeline : contact créé", "info"],
  CRM_PIPELINE_STAGE: ["Pipeline : changement d'étape", "info"], CRM_VISIT_STATUS: ["Visite : statut modifié", "info"], LANGUAGE_TOGGLE: ["Langue activée/désactivée", "info"], REDIRECT_CREATE: ["Redirection créée", "info"], CATEGORY_TOGGLE: ["Catégorie activée/désactivée", "info"],
  COMPLAINT_ASSIGN: ["Réclamation affectée", "info"], COMPLAINT_COMMENT: ["Réclamation commentée", "neutral"], COMPLAINT_CLOSE: ["Réclamation close", "ok"], COMPLAINT_RESOLVE: ["Réclamation résolue", "ok"],
  INCIDENT_CREATE: ["Incident déclaré", "bad"], INCIDENT_RESOLVE: ["Incident résolu", "ok"], BACKUP_AUTO_MANUAL: ["Sauvegarde automatique lancée", "info"], BACKUP_VERIFY: ["Sauvegarde contrôlée", "ok"], INCIDENTS_CHECK_MANUAL: ["Contrôle des incidents", "info"],
  BACKUP_LOG: ["Sauvegarde notée", "neutral"], SETTINGS_UPDATE: ["Paramètres modifiés", "warn"], CAMPAIGN_CREATE: ["Campagne créée", "ok"], CAMPAIGN_UPDATE: ["Campagne modifiée", "info"],
  OWNER_ACTIVITY_EXPORT: ["Export du journal des mouvements", "warn"], OWNER_TRACE: ["Traçage d'un compte ou d'une annonce", "info"], OWNER_SECURITY_LOG: ["Journal de connexions activé/désactivé", "warn"],
};

const humanize = (code) => { const t = String(code ?? "").replace(/^CAMPAIGN_/, "Campagne · ").replace(/_/g, " ").toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
export function describeCode(code) {
  const hit = L[code];
  if (hit) return { label: hit[0], tone: hit[1] };
  if (/^CAMPAIGN_(ACTIVE|PAUSED|ENDED|DRAFT)$/.test(String(code))) return { label: `Campagne · ${{ ACTIVE: "activée", PAUSED: "mise en pause", ENDED: "terminée", DRAFT: "remise en brouillon" }[String(code).slice(9)]}`, tone: "info" };
  return { label: humanize(code), tone: "neutral" };
}

/** Ligne SQL -> événement du journal. `at` : millisecondes (affichage) ; `cursor` : microsecondes (pagination exacte). */
export function shapeEvent(row, source) {
  const { label, tone } = describeCode(row.code);
  const at = String(row.at_us ?? "");
  return {
    uid: `${source.key}:${row.id}`, source: source.key, category: source.cat, at: `${at.slice(0, 23)}Z`, cursor: at,
    code: row.code, label, tone: row.sev ?? tone,
    actor: row.actor_id || row.actor_name ? { id: row.actor_id ?? null, name: row.actor_name || null } : null,
    object: row.object_id ? { type: row.object_type ?? null, id: row.object_id, label: row.object_label ?? null } : null,
    detail: row.detail || null,
  };
}

/** Fusion exacte : le haut de page de la fusion est contenu dans le haut de page de chaque source. */
export function mergeEvents(batches, limit) {
  return batches.flat().sort((a, b) => (a.cursor < b.cursor ? 1 : a.cursor > b.cursor ? -1 : a.uid < b.uid ? 1 : -1)).slice(0, limit);
}

/** Cellule CSV sûre : guillemets doublés, et neutralisation des formules (=, +, -, @) ouvertes par un tableur. */
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function eventsToCsv(events) {
  const head = ["date_utc", "categorie", "source", "evenement", "code", "acteur_id", "acteur", "objet_type", "objet_id", "objet", "detail"];
  const lines = [head.join(",")];
  for (const e of events) lines.push([e.at, e.category, e.source, e.label, e.code, e.actor?.id, e.actor?.name, e.object?.type, e.object?.id, e.object?.label, e.detail].map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
