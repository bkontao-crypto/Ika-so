// Badge Étoile (compte identifié) : dossier en constitution (pièces envoyées une à une), envoi à l'équipe, lecture tracée des pièces.
// Lot 1 = fondations. Les étapes d'étude, la décision, l'expiration et le paiement viennent aux lots suivants.
// Les pièces sont PRIVÉES : stockées dans stored_files mais jamais servies par /api/media (qui ne sert que des images publiques ou de profil).
import { randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { parseProofFile } from "../lib/trust.js";
import { storeDataUrl } from "../lib/file-storage.js";
import { DEFAULT_STAR_POLICY, DOC_KINDS, STAR_ACCOUNT_TYPES, STAR_POLICY_KEY, STAR_STEPS, normalizeStarPolicy } from "../lib/star-badge-policy.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
const cleanPhone = (v) => String(v ?? "").replace(/[^\d+]/g, "").slice(0, 20);
const OPEN = ["DRAFT", "PENDING"];

export function createStarBadge({ db, accounts, superadminSettings, requestsHub, moderationAudit, notify }) {
  async function policy() {
    return normalizeStarPolicy((await superadminSettings?.get(STAR_POLICY_KEY)) ?? DEFAULT_STAR_POLICY);
  }
  const labels = (kinds) => kinds.map((k) => ({ kind: k, label: DOC_KINDS[k] }));
  /** Ce que voit l'annonceur : texte du bouton « C'est quoi », pièces à fournir, prix, durée, délai (jamais les réglages internes). */
  const publicPolicy = (p) => ({
    enabled: p.enabled, infoTitle: p.infoTitle, infoBody: p.infoBody, warningText: p.warningText,
    requirePhone: p.requirePhone, paymentRequired: p.paymentRequired, priceXof: p.priceXof, durationMonths: p.durationMonths, reviewDelayDays: p.reviewDelayDays,
    steps: p.requiredSteps.map((n) => ({ step: n, label: STAR_STEPS[n] })),
    requirements: Object.fromEntries(Object.entries(p.requirements).map(([t, r]) => [t, { required: labels(r.required), optional: labels(r.optional) }])),
  });
  const view = (r, docs = [], steps = []) => ({ id: r.id, status: r.status, accountType: r.account_type, phone: r.phone, message: r.message, acceptedTermsAt: iso(r.accepted_terms_at), submittedAt: iso(r.submitted_at), reviewDueAt: iso(r.review_due_at), decidedAt: iso(r.decided_at), decidedNote: r.decided_note, validUntil: iso(r.valid_until), revokedAt: iso(r.revoked_at), revokedNote: r.revoked_note ?? "", documentsPurgedAt: iso(r.documents_purged_at), paid: r.paid === true, createdAt: iso(r.created_at),
    progress: [1, 2, 3].map((n) => steps.some((x) => x.step === n)),
    steps: steps.map((x) => ({ step: x.step, label: STAR_STEPS[x.step], doneBy: x.done_by, doneByName: x.done_name || x.done_by, doneAt: iso(x.done_at), note: x.note })),
    documents: docs.map((d) => ({ id: d.id, kind: d.kind, label: DOC_KINDS[d.kind], fileType: d.file_type, createdAt: iso(d.created_at) })) });
  const stepsOf = (ids) => (ids.length ? db.query("select s.request_id, s.step, s.done_by, s.done_at, s.note, p.full_name as done_name from ika_star_request_steps s left join ika_profiles p on p.user_id = s.done_by where s.request_id = any($1::text[]) order by s.step", [ids]) : Promise.resolve([]));
  const stepNo = (v) => { const n = Math.floor(Number(v)); if (!STAR_STEPS[n]) throw badRequest("Étape inconnue (1 étude, 2 vérification, 3 confirmation)."); return n; };
  const say = (userId, note) => (notify ? notify(userId, { kind: "STAR", link: "#/profil", ...note }).catch(() => undefined) : undefined);
  const dateFr = (d) => new Date(d).toLocaleDateString("fr-FR", { timeZone: "Africa/Bamako" });
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

    /** Dossier le plus récent de l'annonceur, son historique (10 derniers), le badge actif éventuel et les règles à afficher. */
    async mine(userId) {
      const p = await policy();
      const rows = await db.query("select * from ika_star_requests where user_id = $1 order by created_at desc limit 10", [userId]);
      const [docs, steps] = await Promise.all([docsOf(rows.map((r) => r.id)), stepsOf(rows.map((r) => r.id))]);
      const mineView = (r) => view(r, docs.filter((d) => d.request_id === r.id), steps.filter((x) => x.request_id === r.id));
      const active = (await db.query("select valid_until from ika_star_requests where user_id = $1 and status = 'APPROVED' and valid_until > now() order by valid_until desc limit 1", [userId]))[0];
      const badge = active ? { validUntil: iso(active.valid_until), renewable: new Date(active.valid_until).getTime() - Date.now() <= 30 * 86_400_000 } : null;
      return { policy: publicPolicy(p), badge, request: rows[0] ? mineView(rows[0]) : null, history: rows.map(mineView) };
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

    /** File de l'équipe : dossiers envoyés ou décidés, étapes validées, pièces listées sans contenu. */
    async listForStaff() {
      const rows = await db.query(
        `select r.*, p.full_name as name, u.email from ika_star_requests r
           join ika_users u on u.id = r.user_id left join ika_profiles p on p.user_id = r.user_id
          where r.status <> 'DRAFT' and r.status <> 'CANCELLED'
          order by (r.status = 'PENDING') desc, coalesce(r.submitted_at, r.created_at) desc limit 200`);
      const ids = rows.map((r) => r.id);
      const [docs, steps, p] = await Promise.all([docsOf(ids), stepsOf(ids), policy()]);
      return { policy: publicPolicy(p), requiredSteps: p.requiredSteps, retentionDays: p.retentionDays, requests: rows.map((r) => ({ ...view(r, docs.filter((d) => d.request_id === r.id), steps.filter((x) => x.request_id === r.id)), userId: r.user_id, name: r.name, email: r.email })) };
    },

    /** Valide une étape (1 étude, 2 vérification, 3 confirmation). Indépendantes ; chaque validation est tracée à la personne. */
    async completeStep(staffId, requestId, step, { note } = {}) {
      const n = stepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      const p = await policy();
      if (!p.requiredSteps.includes(n)) throw badRequest(`L'étape « ${STAR_STEPS[n]} » n'est pas demandée dans les réglages.`);
      return db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_star_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Dossier introuvable.");
        if (r.status !== "PENDING") throw conflict("Ce dossier a déjà été traité ou n'est pas encore envoyé.");
        const inserted = await tx.query("insert into ika_star_request_steps (request_id, step, done_by, note) values ($1, $2, $3, $4) on conflict (request_id, step) do nothing returning step", [r.id, n, staffId, why]);
        if (!inserted[0]) {
          const who = (await tx.query("select p.full_name from ika_star_request_steps s left join ika_profiles p on p.user_id = s.done_by where s.request_id = $1 and s.step = $2", [r.id, n]))[0];
          throw conflict(`L'étape « ${STAR_STEPS[n]} » est déjà validée${who?.full_name ? ` par ${who.full_name}` : ""}.`);
        }
        await moderationAudit?.log(staffId, { action: "STAR_STEP_DONE", targetType: "star_request", targetId: r.id, details: { userId: r.user_id, step: n, label: STAR_STEPS[n], note: why } }).catch(() => {});
        const doneNow = (await tx.query("select step from ika_star_request_steps where request_id = $1", [r.id])).map((x) => x.step);
        return { ok: true, step: n, done: doneNow.length, complete: p.requiredSteps.every((k) => doneNow.includes(k)) };
      });
    },

    /** Retire la validation d'une étape (erreur, élément nouveau) : motif obligatoire, tracé. */
    async undoStep(staffId, requestId, step, { note } = {}) {
      const n = stepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez pourquoi vous retirez cette validation (3 caractères au moins).");
      return db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_star_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Dossier introuvable.");
        if (r.status !== "PENDING") throw conflict("Ce dossier a déjà été traité.");
        const gone = await tx.query("delete from ika_star_request_steps where request_id = $1 and step = $2 returning done_by", [r.id, n]);
        if (!gone[0]) throw conflict(`L'étape « ${STAR_STEPS[n]} » n'était pas validée.`);
        await moderationAudit?.log(staffId, { action: "STAR_STEP_UNDONE", targetType: "star_request", targetId: r.id, details: { userId: r.user_id, step: n, label: STAR_STEPS[n], previousBy: gone[0].done_by, note: why } }).catch(() => {});
        return { ok: true, step: n };
      });
    },

    /** Décision finale. REJECT : motif obligatoire, transmis à l'annonceur. APPROVE : toutes les étapes demandées validées (et paiement reçu s'il est exigé) ; la validité se cumule en cas de renouvellement. */
    async decide(staffId, requestId, { action, note } = {}) {
      const p = await policy();
      const why = String(note ?? "").trim().slice(0, 300);
      const out = await db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_star_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Dossier introuvable.");
        if (r.status !== "PENDING") throw conflict("Ce dossier a déjà été traité ou n'est pas encore envoyé.");
        if (action === "REJECT") {
          if (why.length < 3) throw badRequest("Indiquez le motif du refus (3 caractères au moins) : il est transmis à l'annonceur.");
          await tx.query("update ika_star_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decided_note = $3 where id = $1", [r.id, staffId, why]);
          await moderationAudit?.log(staffId, { action: "STAR_REQUEST_REJECT", targetType: "star_request", targetId: r.id, details: { userId: r.user_id, note: why } }).catch(() => {});
          return { ok: true, status: "REJECTED", userId: r.user_id, why };
        }
        if (action !== "APPROVE") throw badRequest("Action inconnue.");
        const done = (await tx.query("select step, done_by from ika_star_request_steps where request_id = $1 order by step", [r.id]));
        const missing = p.requiredSteps.filter((n) => !done.some((x) => x.step === n));
        if (missing.length) throw conflict(`Validez d'abord toutes les étapes avant d'approuver (manquantes : ${missing.map((n) => STAR_STEPS[n]).join(", ")}).`);
        if (p.paymentRequired && !r.paid) throw conflict("Le paiement du badge n'a pas été reçu : approbation impossible tant qu'il est exigé dans les réglages.");
        const upd = await tx.query(
          `update ika_star_requests set status = 'APPROVED', decided_by = $2, decided_at = now(), decided_note = $3, expiry_notified_at = null,
                  valid_until = greatest(now(), coalesce((select max(valid_until) from ika_star_requests where user_id = $4 and status = 'APPROVED' and id <> $1), now())) + ($5 || ' months')::interval
            where id = $1 returning valid_until`, [r.id, staffId, why, r.user_id, String(p.durationMonths)]);
        await moderationAudit?.log(staffId, { action: "STAR_REQUEST_APPROVE", targetType: "star_request", targetId: r.id, details: { userId: r.user_id, steps: done.map((x) => ({ step: x.step, by: x.done_by })), validUntil: iso(upd[0].valid_until), note: why } }).catch(() => {});
        return { ok: true, status: "APPROVED", userId: r.user_id, validUntil: iso(upd[0].valid_until) };
      });
      if (out.status === "REJECTED") await say(out.userId, { title: "Demande de badge Étoile non retenue", body: `Motif : ${out.why}. Vous pouvez déposer une nouvelle demande.` });
      else await say(out.userId, { title: "Votre compte est certifié : badge Étoile accordé", body: `Valable jusqu'au ${dateFr(out.validUntil)}. Votre identité a été vérifiée par l'équipe IKA SO.` });
      return { ok: true, status: out.status, validUntil: out.validUntil ?? null };
    },

    /** Retire un badge accordé (fraude, pièce périmée, signalements) : motif obligatoire, transmis à l'annonceur, tracé. */
    async revoke(staffId, requestId, { note } = {}) {
      const why = String(note ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez le motif du retrait (3 caractères au moins) : il est transmis à l'annonceur.");
      const userId = await db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_star_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Dossier introuvable.");
        if (r.status !== "APPROVED") throw conflict("Seul un badge accordé peut être retiré.");
        await tx.query("update ika_star_requests set status = 'REVOKED', revoked_by = $2, revoked_at = now(), revoked_note = $3 where user_id = $1 and status = 'APPROVED'", [r.user_id, staffId, why]);
        await moderationAudit?.log(staffId, { action: "STAR_BADGE_REVOKE", targetType: "star_request", targetId: r.id, details: { userId: r.user_id, note: why } }).catch(() => {});
        return r.user_id;
      });
      await say(userId, { title: "Votre badge Étoile a été retiré", body: `Motif : ${why}.` });
      return { ok: true, status: "REVOKED" };
    },

    /** Traitement à la demande (aucune minuterie) : rappelle les badges qui expirent sous 30 jours ou ont expiré, et efface les pièces dont la durée de conservation est écoulée. */
    async sweep(staffId) {
      const p = await policy();
      const due = await db.query("update ika_star_requests set expiry_notified_at = now() where status = 'APPROVED' and expiry_notified_at is null and valid_until <= now() + interval '30 days' returning user_id, valid_until");
      for (const d of due) {
        const over = new Date(d.valid_until).getTime() <= Date.now();
        await say(d.user_id, { title: over ? "Votre badge Étoile a expiré" : "Votre badge Étoile expire bientôt", body: over ? "Déposez une nouvelle demande pour le renouveler." : `Il expire le ${dateFr(d.valid_until)}. Vous pouvez déjà déposer une demande de renouvellement.` });
      }
      let purged = 0;
      if (p.retentionDays > 0) {
        purged = await db.transaction(async (tx) => {
          const old = await tx.query(
            `select r.id from ika_star_requests r
              where r.documents_purged_at is null and r.status in ('APPROVED', 'REJECTED', 'REVOKED')
                and coalesce(r.revoked_at, r.decided_at) < now() - ($1 || ' days')::interval
                and exists (select 1 from ika_star_documents d where d.request_id = r.id) for update`, [String(p.retentionDays)]);
          for (const r of old) {
            const files = (await tx.query("select file_id from ika_star_documents where request_id = $1", [r.id])).map((d) => d.file_id);
            await tx.query("delete from ika_star_documents where request_id = $1", [r.id]);
            if (files.length) await tx.query("delete from stored_files where id = any($1::uuid[])", [files]);
            await tx.query("update ika_star_requests set documents_purged_at = now() where id = $1", [r.id]);
          }
          return old.length;
        });
      }
      await moderationAudit?.log(staffId, { action: "STAR_BADGE_SWEEP", targetType: "star_request", targetId: null, details: { reminded: due.length, purged } }).catch(() => {});
      return { ok: true, reminded: due.length, purged };
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
