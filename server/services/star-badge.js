// Badge Étoile (compte identifié) : dossier en constitution (pièces envoyées une à une), envoi à l'équipe, lecture tracée des pièces.
// Lot 1 = fondations. Les étapes d'étude, la décision, l'expiration et le paiement viennent aux lots suivants.
// Les pièces sont PRIVÉES : stockées dans stored_files mais jamais servies par /api/media (qui ne sert que des images publiques ou de profil).
import { randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { parseProofFile } from "../lib/trust.js";
import { storeDataUrl } from "../lib/file-storage.js";
import { DEFAULT_STAR_POLICY, DOC_KINDS, STAR_ACCOUNT_TYPES, STAR_POLICY_KEY, normalizeStarPolicy } from "../lib/star-badge-policy.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
const cleanPhone = (v) => String(v ?? "").replace(/[^\d+]/g, "").slice(0, 20);
const OPEN = ["DRAFT", "PENDING"];

export function createStarBadge({ db, accounts, superadminSettings, requestsHub, moderationAudit }) {
  async function policy() {
    return normalizeStarPolicy((await superadminSettings?.get(STAR_POLICY_KEY)) ?? DEFAULT_STAR_POLICY);
  }
  const labels = (kinds) => kinds.map((k) => ({ kind: k, label: DOC_KINDS[k] }));
  /** Ce que voit l'annonceur : texte du bouton « C'est quoi », pièces à fournir, prix, durée, délai (jamais les réglages internes). */
  const publicPolicy = (p) => ({
    enabled: p.enabled, infoTitle: p.infoTitle, infoBody: p.infoBody, warningText: p.warningText,
    requirePhone: p.requirePhone, paymentRequired: p.paymentRequired, priceXof: p.priceXof, durationMonths: p.durationMonths, reviewDelayDays: p.reviewDelayDays,
    requirements: Object.fromEntries(Object.entries(p.requirements).map(([t, r]) => [t, { required: labels(r.required), optional: labels(r.optional) }])),
  });
  const view = (r, docs = []) => ({ id: r.id, status: r.status, accountType: r.account_type, phone: r.phone, message: r.message, acceptedTermsAt: iso(r.accepted_terms_at), submittedAt: iso(r.submitted_at), reviewDueAt: iso(r.review_due_at), decidedAt: iso(r.decided_at), decidedNote: r.decided_note, createdAt: iso(r.created_at), documents: docs.map((d) => ({ id: d.id, kind: d.kind, label: DOC_KINDS[d.kind], fileType: d.file_type, createdAt: iso(d.created_at) })) });
  const docsOf = (ids) => (ids.length ? db.query("select id, request_id, kind, file_type, created_at from ika_star_documents where request_id = any($1::text[]) order by created_at", [ids]) : Promise.resolve([]));
  async function requireEnabled() {
    const p = await policy();
    if (!p.enabled) throw forbidden("Le badge Étoile n'est pas ouvert pour le moment.");
    return p;
  }

  return {
    policy,
    /** Réglages complets pour l'écran d'administration. */
    async settings() { return policy(); },
    /** Enregistre les réglages (normalisés) ; chaque changement est tracé. */
    async saveSettings(staffId, raw) {
      await accounts.requireStaff(staffId);
      const value = normalizeStarPolicy(raw);
      await superadminSettings.set(staffId, STAR_POLICY_KEY, value);
      await moderationAudit?.log(staffId, { action: "STAR_BADGE_SETTINGS_UPDATE", targetType: "settings", targetId: null, details: { value } }).catch(() => {});
      return value;
    },
    publicInfo: async () => publicPolicy(await policy()),

    /** Dossier ouvert de l'annonceur, son historique (10 derniers) et les règles à afficher. */
    async mine(userId) {
      const p = await policy();
      const rows = await db.query("select * from ika_star_requests where user_id = $1 order by created_at desc limit 10", [userId]);
      const docs = await docsOf(rows.map((r) => r.id));
      const mineView = (r) => view(r, docs.filter((d) => d.request_id === r.id));
      return { policy: publicPolicy(p), request: rows[0] ? mineView(rows[0]) : null, history: rows.map(mineView) };
    },

    /** Ajoute (ou remplace) une pièce du dossier en constitution ; crée le dossier au premier envoi. Une pièce par fichier : le corps JSON reste petit. */
    async addDocument(userId, { accountType, kind, fileData }) {
      const p = await requireEnabled();
      await accounts.requireActive(userId);
      if (!Object.hasOwn(DOC_KINDS, kind)) throw badRequest("Type de pièce inconnu.");
      let file;
      try { file = parseProofFile(fileData); } catch (error) { throw badRequest(error.message); }
      return db.transaction(async (tx) => {
        await tx.query("select user_id from ika_profiles where user_id = $1 for update", [userId]); // sérialise les envois simultanés du même compte
        let r = (await tx.query("select * from ika_star_requests where user_id = $1 and status = any($2::text[])", [userId, OPEN]))[0];
        if (r && r.status !== "DRAFT") throw conflict("Votre dossier est déjà envoyé à l'équipe. Retirez-le pour le modifier.");
        if (!r) {
          if (!STAR_ACCOUNT_TYPES.includes(accountType)) throw badRequest("Indiquez votre type de compte (agence, particulier ou autre).");
          r = (await tx.query("insert into ika_star_requests (id, user_id, account_type) values ($1, $2, $3) returning *", [`sr_${randomUUID()}`, userId, accountType]))[0];
        }
        const allowed = [...p.requirements[r.account_type].required, ...p.requirements[r.account_type].optional];
        if (!allowed.includes(kind)) throw badRequest(`Cette pièce n'est pas demandée pour ce type de compte : ${DOC_KINDS[kind]}.`);
        const old = (await tx.query("select id, file_id from ika_star_documents where request_id = $1 and kind = $2", [r.id, kind]))[0];
        const stored = await storeDataUrl(tx, fileData);
        if (old) {
          await tx.query("delete from ika_star_documents where id = $1", [old.id]);
          await tx.query("delete from stored_files where id = $1", [old.file_id]);
        }
        const docId = `sd_${randomUUID()}`;
        await tx.query("insert into ika_star_documents (id, request_id, kind, file_id, file_type) values ($1, $2, $3, $4, $5)", [docId, r.id, kind, stored.id, file.type]);
        return { ok: true, requestId: r.id, documentId: docId, kind };
      });
    },

    /** Envoie le dossier à l'équipe : téléphone confirmé (si exigé), pièces obligatoires toutes présentes, conditions acceptées. */
    async submit(userId, { phone, message, acceptTerms } = {}) {
      const p = await requireEnabled();
      await accounts.requireActive(userId);
      if (p.requirePhone) await accounts.requireVerifiedPhone(userId);
      const tel = cleanPhone(phone);
      if (tel.replace(/\D/g, "").length < 8) throw badRequest("Indiquez un numéro de téléphone joignable (8 chiffres au moins).");
      if (acceptTerms !== true) throw badRequest("Vous devez accepter les conditions pour envoyer la demande.");
      const note = String(message ?? "").trim().slice(0, 500);
      const sent = await db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_star_requests where user_id = $1 and status = 'DRAFT' for update", [userId]))[0];
        if (!r) throw notFound("Aucun dossier en cours : envoyez d'abord vos pièces.");
        const have = new Set((await tx.query("select kind from ika_star_documents where request_id = $1", [r.id])).map((d) => d.kind));
        const missing = p.requirements[r.account_type].required.filter((k) => !have.has(k));
        if (missing.length) throw badRequest(`Pièces obligatoires manquantes : ${missing.map((k) => DOC_KINDS[k]).join(", ")}.`);
        await tx.query("update ika_star_requests set status = 'PENDING', phone = $2, message = $3, accepted_terms_at = now(), submitted_at = now(), review_due_at = now() + ($4 || ' days')::interval where id = $1", [r.id, tel, note, String(p.reviewDelayDays)]);
        return r;
      });
      await requestsHub?.notifyStaff({ kind: "STAR_REQUEST", title: "Nouvelle demande de badge Étoile", body: `${sent.account_type === "AGENCY" ? "Agence" : sent.account_type === "INDIVIDUAL" ? "Particulier" : "Professionnel"} · dossier complet à étudier.`, link: "/owner#/requests", exceptUserId: userId, module: "trust" });
      return { ok: true, id: sent.id, reviewDelayDays: p.reviewDelayDays };
    },

    /** Retire le dossier (en constitution ou en attente) : les pièces envoyées sont supprimées. */
    async cancel(userId) {
      return db.transaction(async (tx) => {
        const r = (await tx.query("select id from ika_star_requests where user_id = $1 and status = any($2::text[]) for update", [userId, OPEN]))[0];
        if (!r) throw notFound("Aucun dossier à retirer.");
        const files = (await tx.query("select file_id from ika_star_documents where request_id = $1", [r.id])).map((d) => d.file_id);
        await tx.query("delete from ika_star_documents where request_id = $1", [r.id]);
        if (files.length) await tx.query("delete from stored_files where id = any($1::uuid[])", [files]);
        await tx.query("update ika_star_requests set status = 'CANCELLED', cancelled_at = now() where id = $1", [r.id]);
        return { ok: true };
      });
    },

    /** File de l'équipe : dossiers envoyés, pièces listées sans contenu. */
    async listForStaff() {
      const rows = await db.query(
        `select r.*, p.full_name as name, u.email from ika_star_requests r
           join ika_users u on u.id = r.user_id left join ika_profiles p on p.user_id = r.user_id
          where r.status <> 'DRAFT' and r.status <> 'CANCELLED'
          order by (r.status = 'PENDING') desc, r.submitted_at desc nulls last limit 200`);
      const docs = await docsOf(rows.map((r) => r.id));
      return { policy: publicPolicy(await policy()), requests: rows.map((r) => ({ ...view(r, docs.filter((d) => d.request_id === r.id)), userId: r.user_id, name: r.name, email: r.email })) };
    },

    /** Ouvrir une pièce est tracé : on sait qui l'a vue et quand. */
    async viewDocument(staffId, requestId, documentId) {
      await accounts.requireStaff(staffId);
      const rows = await db.query(
        `select d.kind, d.file_type, r.user_id, f.content from ika_star_documents d
           join ika_star_requests r on r.id = d.request_id left join stored_files f on f.id = d.file_id
          where d.id = $1 and d.request_id = $2 and r.status <> 'DRAFT'`, [String(documentId ?? "").slice(0, 80), String(requestId ?? "").slice(0, 80)]);
      if (!rows[0]?.content) throw notFound("Pièce introuvable.");
      await moderationAudit?.log(staffId, { action: "STAR_DOCUMENT_VIEW", targetType: "star_request", targetId: String(requestId), details: { userId: rows[0].user_id, documentId, kind: rows[0].kind } }).catch(() => {});
      return { fileType: rows[0].file_type, fileData: `data:${rows[0].file_type};base64,${Buffer.from(rows[0].content).toString("base64")}` };
    },
  };
}
