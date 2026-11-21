// Demandes Premium à la main (paiement en ligne fermé). Approbation : 1 à 3 mois, dans la limite fixée par le superadmin.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { DEFAULT_POLICY, POLICY_KEY, normalizePolicy } from "../lib/payment-policy.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
export const ACCOUNT_TYPES = ["AGENCY", "INDIVIDUAL", "OTHER"];
/** Les 3 étapes d'étude d'un dossier Premium : indépendantes, validables en même temps, toutes requises pour approuver. */
export const STEPS = Object.freeze({ 1: "Étude", 2: "Vérification", 3: "Confirmation" });
/** Suivi de remboursement (dossier refusé après paiement) : 3 étapes indépendantes ; la dernière validée clôt le suivi et informe l'annonceur. */
export const REFUND_STEPS = Object.freeze({ 1: "Paiement vérifié", 2: "Remboursement effectué", 3: "Annonceur informé" });
const refundStepNo = (v) => { const n = Math.floor(Number(v)); if (!REFUND_STEPS[n]) throw badRequest("Étape inconnue (1 paiement vérifié, 2 remboursement effectué, 3 annonceur informé)."); return n; };
const stepNo = (v) => { const n = Math.floor(Number(v)); if (!STEPS[n]) throw badRequest("Étape inconnue (1 étude, 2 vérification, 3 confirmation)."); return n; };
const cleanPhone = (v) => String(v ?? "").replace(/[^\d+]/g, "").slice(0, 20);

export function createPremiumRequests({ requestsHub, db, accounts, notify, superadminSettings, moderationAudit, payments }) {
  async function policy() {
    return normalizePolicy((await superadminSettings?.get(POLICY_KEY)) ?? DEFAULT_POLICY);
  }
  const view = (r) => ({ id: r.id, userId: r.user_id, months: r.months, status: r.status, grantedMonths: r.granted_months, decidedAt: iso(r.decided_at), decidedNote: r.decided_note, createdAt: iso(r.created_at), name: r.name, email: r.email, accountType: r.account_type, phone: r.phone, message: r.message, acceptedTermsAt: iso(r.accepted_terms_at), cancelledAt: iso(r.cancelled_at), certified: r.certified === undefined ? undefined : Boolean(r.certified), paid: Boolean(r.paid), reviewDueAt: iso(r.review_due_at) });
  /** Vue annonceur : l'avancement seulement (jamais le nom des personnes qui étudient le dossier). */
  const userView = (r, steps = []) => ({ ...view(r), progress: [1, 2, 3].map((n) => steps.some((s) => s.step === n)) });
  const stepsOf = (q, ids) => (ids.length ? q.query("select s.request_id, s.step, s.done_by, s.done_at, s.note, p.full_name as done_name from ika_premium_request_steps s left join ika_profiles p on p.user_id = s.done_by where s.request_id = any($1::text[]) order by s.step", [ids]) : Promise.resolve([]));
  const stepView = (labels) => (s) => ({ step: s.step, label: labels[s.step], doneBy: s.done_by, doneByName: s.done_name || s.done_by, doneAt: iso(s.done_at), note: s.note });

  /** Profil certifié = agence vérifiée ou titre foncier contrôlé sur une annonce en ligne (même règle que le centre de contrôle). */
  async function isCertified(userId, q = db) {
      const r = (await q.query(
        `select p.agency_verified_at is not null as agency,
                (select count(*)::int from ika_listings l where l.owner_id = p.user_id and l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now()) and l.document_verified_at is not null) as titles
           from ika_profiles p where p.user_id = $1`, [userId]))[0];
      return Boolean(r && (r.agency || Number(r.titles) > 0));
  }

  return {
    policy,

    /** L'annonceur demande le Premium pour 1 à maxMois mois. Refusé si le paiement en ligne est ouvert (il doit payer). */
    async create(userId, { months, accountType, phone, message, acceptTerms } = {}) {
      await accounts.requireActive(userId);
      await accounts.requireVerifiedPhone(userId);
      const p = await policy();
      // Paiement en ligne ouvert : on paie d'abord, le dossier est étudié ensuite. Fermé : dossier d'abord, activation à la main après les 3 étapes.
      const online = await payments.onlineOpen();
      let paid = false;
      if (online) {
        const prem = (await db.query("select premium_until from ika_profiles where user_id = $1", [userId]))[0];
        if (!(prem?.premium_until && new Date(prem.premium_until) > new Date())) throw forbidden("Le paiement Premium est activé : payez d'abord, votre dossier sera étudié après le paiement.");
        paid = true;
      }
      const m = paid ? 1 : Math.floor(Number(months));
      if (!Number.isFinite(m) || m < 1 || m > p.manualPremiumMaxMonths) throw badRequest(`Durée invalide (1 à ${p.manualPremiumMaxMonths} mois).`);
      const type = String(accountType ?? "");
      if (!ACCOUNT_TYPES.includes(type)) throw badRequest("Indiquez votre type de compte (agence, particulier ou autre).");
      const tel = cleanPhone(phone);
      if (tel.replace(/\D/g, "").length < 8) throw badRequest("Indiquez un numéro de téléphone joignable (8 chiffres au moins).");
      const note = String(message ?? "").trim().slice(0, 500);
      if (acceptTerms !== true) throw badRequest("Vous devez accepter les conditions pour envoyer la demande.");
      const pending = await db.query("select id from ika_premium_requests where user_id = $1 and status = 'PENDING'", [userId]);
      if (pending[0]) throw conflict("Une demande Premium est déjà en attente.");
      const id = `pr_${randomUUID()}`;
      await db.query("insert into ika_premium_requests (id, user_id, months, account_type, phone, message, accepted_terms_at, paid, review_due_at) values ($1, $2, $3, $4, $5, $6, now(), $7, now() + ($8 || ' days')::interval)", [id, userId, m, type, tel, note, paid, String(p.reviewDelayDays)]);
      await requestsHub?.notifyStaff({ kind: "PREMIUM_REQUEST", title: "Nouvelle demande Premium", body: `${type === "AGENCY" ? "Agence" : type === "INDIVIDUAL" ? "Particulier" : "Professionnel"} · ${m} mois demandés.`, link: "/owner#/requests", exceptUserId: userId, module: "payments" });
      return { ok: true, id, reviewDelayDays: p.reviewDelayDays };
    },

    /** L'annonceur retire sa demande tant qu'elle est en attente. */
    async cancel(userId, requestId) {
      const rows = await db.query("update ika_premium_requests set status = 'CANCELLED', cancelled_at = now() where id = $1 and user_id = $2 and status = 'PENDING' returning id", [String(requestId ?? "").slice(0, 80), userId]);
      if (!rows[0]) throw notFound("Aucune demande en attente à annuler.");
      return { ok: true };
    },

    /** Dernière demande de l'annonceur, son historique (10 dernières) et la politique à afficher. */
    async mine(userId) {
      const rows = await db.query("select * from ika_premium_requests where user_id = $1 order by created_at desc limit 10", [userId]);
      const steps = await stepsOf(db, rows.map((r) => r.id));
      const mineView = (r) => userView(r, steps.filter((s) => s.request_id === r.id));
      return { request: rows[0] ? mineView(rows[0]) : null, history: rows.map(mineView), policy: await policy() };
    },

    /** File des demandes pour l'équipe (en attente d'abord). */
    async listForStaff() {
      const rows = await db.query(
        `select r.*, p.full_name as name, u.email,
                (p.agency_verified_at is not null or exists (select 1 from ika_listings l where l.owner_id = r.user_id and l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now()) and l.document_verified_at is not null)) as certified
           from ika_premium_requests r
           join ika_users u on u.id = r.user_id left join ika_profiles p on p.user_id = r.user_id
          order by (r.status = 'PENDING') desc, r.created_at desc limit 200`);
      const steps = await stepsOf(db, rows.map((r) => r.id));
      const refundRows = await db.query("select f.id, f.request_id, f.user_id, f.status, f.opened_at, f.closed_at, p.full_name as name from ika_premium_refunds f left join ika_profiles p on p.user_id = f.user_id order by (f.status = 'OPEN') desc, f.opened_at desc limit 100");
      const rsteps = refundRows.length ? await db.query("select s.refund_id, s.step, s.done_by, s.done_at, s.note, p.full_name as done_name from ika_premium_refund_steps s left join ika_profiles p on p.user_id = s.done_by where s.refund_id = any($1::text[]) order by s.step", [refundRows.map((f) => f.id)]) : [];
      const refunds = refundRows.map((f) => ({ id: f.id, requestId: f.request_id, userId: f.user_id, name: f.name, status: f.status, openedAt: iso(f.opened_at), closedAt: iso(f.closed_at), steps: rsteps.filter((x) => x.refund_id === f.id).map(stepView(REFUND_STEPS)) }));
      return { refunds, refundSteps: Object.entries(REFUND_STEPS).map(([n, label]) => ({ step: Number(n), label })), requests: rows.map((r) => ({ ...view(r), steps: steps.filter((s) => s.request_id === r.id).map(stepView(STEPS)) })), steps: Object.entries(STEPS).map(([n, label]) => ({ step: Number(n), label })), policy: await policy() };
    },

    /** Valide une étape (1 étude, 2 vérification, 3 confirmation). Les étapes sont indépendantes ; chaque validation est tracée à la personne. */
    async completeStep(staffId, requestId, step, { note } = {}) {
      const n = stepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      return db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_premium_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Demande introuvable.");
        if (r.status !== "PENDING") throw conflict("Cette demande a déjà été traitée.");
        const inserted = await tx.query("insert into ika_premium_request_steps (request_id, step, done_by, note) values ($1, $2, $3, $4) on conflict (request_id, step) do nothing returning step", [r.id, n, staffId, why]);
        if (!inserted[0]) {
          const who = (await tx.query("select p.full_name from ika_premium_request_steps s left join ika_profiles p on p.user_id = s.done_by where s.request_id = $1 and s.step = $2", [r.id, n]))[0];
          throw conflict(`L'étape « ${STEPS[n]} » est déjà validée${who?.full_name ? ` par ${who.full_name}` : ""}.`);
        }
        await moderationAudit?.log(staffId, { action: "PREMIUM_STEP_DONE", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, step: n, label: STEPS[n], note: why } }).catch(() => {});
        const done = Number((await tx.query("select count(*)::int as n from ika_premium_request_steps where request_id = $1", [r.id]))[0]?.n ?? 0);
        return { ok: true, step: n, done, complete: done === 3 };
      });
    },

    /** Retire la validation d'une étape (erreur de saisie, élément nouveau) : motif obligatoire, tracé. */
    async undoStep(staffId, requestId, step, { note } = {}) {
      const n = stepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez pourquoi vous retirez cette validation (3 caractères au moins).");
      return db.transaction(async (tx) => {
        const r = (await tx.query("select * from ika_premium_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]))[0];
        if (!r) throw notFound("Demande introuvable.");
        if (r.status !== "PENDING") throw conflict("Cette demande a déjà été traitée.");
        const gone = await tx.query("delete from ika_premium_request_steps where request_id = $1 and step = $2 returning done_by", [r.id, n]);
        if (!gone[0]) throw conflict(`L'étape « ${STEPS[n]} » n'était pas validée.`);
        await moderationAudit?.log(staffId, { action: "PREMIUM_STEP_UNDONE", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, step: n, label: STEPS[n], previousBy: gone[0].done_by, note: why } }).catch(() => {});
        return { ok: true, step: n };
      });
    },

    /** Valide une étape du suivi de remboursement. Indépendantes ; la 3e validée clôt le suivi et notifie l'annonceur (décision finale). */
    async completeRefundStep(staffId, refundId, step, { note } = {}) {
      const n = refundStepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      return db.transaction(async (tx) => {
        const f = (await tx.query("select * from ika_premium_refunds where id = $1 for update", [String(refundId ?? "").slice(0, 80)]))[0];
        if (!f) throw notFound("Suivi de remboursement introuvable.");
        if (f.status !== "OPEN") throw conflict("Ce remboursement est déjà clôturé.");
        const inserted = await tx.query("insert into ika_premium_refund_steps (refund_id, step, done_by, note) values ($1, $2, $3, $4) on conflict (refund_id, step) do nothing returning step", [f.id, n, staffId, why]);
        if (!inserted[0]) throw conflict(`L'étape « ${REFUND_STEPS[n]} » est déjà validée.`);
        await moderationAudit?.log(staffId, { action: "PREMIUM_REFUND_STEP_DONE", targetType: "premium_refund", targetId: f.id, details: { userId: f.user_id, requestId: f.request_id, step: n, label: REFUND_STEPS[n], note: why } }).catch(() => {});
        const done = Number((await tx.query("select count(*)::int as n from ika_premium_refund_steps where refund_id = $1", [f.id]))[0]?.n ?? 0);
        const complete = done === 3;
        if (complete) {
          await tx.query("update ika_premium_refunds set status = 'DONE', closed_at = now() where id = $1", [f.id]);
          if (notify) await notify(f.user_id, { kind: "PREMIUM", title: "Remboursement Premium effectué", body: "Votre remboursement a été traité par l'équipe Ika So.", link: "#/devenir-premium" }).catch(() => undefined);
        }
        return { ok: true, step: n, done, complete };
      });
    },

    /** Retire la validation d'une étape de remboursement (suivi encore ouvert) : motif obligatoire, tracé. */
    async undoRefundStep(staffId, refundId, step, { note } = {}) {
      const n = refundStepNo(step);
      const why = String(note ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez pourquoi vous retirez cette validation (3 caractères au moins).");
      return db.transaction(async (tx) => {
        const f = (await tx.query("select * from ika_premium_refunds where id = $1 for update", [String(refundId ?? "").slice(0, 80)]))[0];
        if (!f) throw notFound("Suivi de remboursement introuvable.");
        if (f.status !== "OPEN") throw conflict("Ce remboursement est déjà clôturé.");
        const gone = await tx.query("delete from ika_premium_refund_steps where refund_id = $1 and step = $2 returning done_by", [f.id, n]);
        if (!gone[0]) throw conflict(`L'étape « ${REFUND_STEPS[n]} » n'était pas validée.`);
        await moderationAudit?.log(staffId, { action: "PREMIUM_REFUND_STEP_UNDONE", targetType: "premium_refund", targetId: f.id, details: { userId: f.user_id, step: n, label: REFUND_STEPS[n], previousBy: gone[0].done_by, note: why } }).catch(() => {});
        return { ok: true, step: n };
      });
    },

    /** Approuve (1 à maxMois mois, ajoutés au Premium en cours) ou refuse. */
    async decide(staffId, requestId, { action, months, note } = {}) {
      const p = await policy();
      const why = String(note ?? "").trim().slice(0, 300);
      return db.transaction(async (tx) => {
        const rows = await tx.query("select * from ika_premium_requests where id = $1 for update", [String(requestId ?? "").slice(0, 80)]);
        const r = rows[0];
        if (!r) throw notFound("Demande introuvable.");
        if (r.status !== "PENDING") throw conflict("Cette demande a déjà été traitée.");
        if (action === "REJECT") {
          if (why.length < 3) throw badRequest("Indiquez le motif du refus (3 caractères au moins) : il est transmis à l'annonceur.");
          await tx.query("update ika_premium_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decided_note = $3 where id = $1", [r.id, staffId, why]);
          if (r.paid) await tx.query("insert into ika_premium_refunds (id, request_id, user_id) values ($1, $2, $3) on conflict (request_id) do nothing", [`rf_${randomUUID()}`, r.id, r.user_id]);
          await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_REJECT", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, note: why } }).catch(() => {});
          if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Demande Premium non retenue", body: why ? `Motif : ${why}` : "Votre demande Premium n'a pas été retenue. Vous pouvez en déposer une nouvelle.", link: "#/devenir-premium" }).catch(() => undefined);
          return { ok: true, status: "REJECTED" };
        }
        if (action !== "APPROVE") throw badRequest("Action inconnue.");
        const doneSteps = await tx.query("select step, done_by from ika_premium_request_steps where request_id = $1 order by step", [r.id]);
        const missing = [1, 2, 3].filter((n) => !doneSteps.some((s) => s.step === n));
        if (missing.length) throw conflict(`Validez d'abord toutes les étapes avant d'approuver (manquantes : ${missing.map((n) => STEPS[n]).join(", ")}).`);
        if (r.paid) {
          // Dossier étudié après paiement : le Premium payé est déjà actif, rien à accorder ; l'approbation certifie le compte.
          await tx.query("update ika_premium_requests set status = 'APPROVED', decided_by = $2, decided_at = now(), decided_note = $3 where id = $1", [r.id, staffId, why]);
          await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_APPROVE", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, paid: true, steps: doneSteps.map((s) => ({ step: s.step, by: s.done_by })) } }).catch(() => {});
          if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Votre compte Premium est certifié", body: "Votre dossier a été étudié et approuvé par l'équipe Ika So.", link: "#/centre" }).catch(() => {});
          return { ok: true, status: "APPROVED", paid: true };
        }
        const granted = Math.floor(Number(months));
        if (!Number.isFinite(granted) || granted < 1 || granted > p.manualPremiumMaxMonths) throw badRequest(`Durée accordée : 1 à ${p.manualPremiumMaxMonths} mois.`);
        const days = granted * 30;
        const prof = await tx.query("update ika_profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval where user_id = $1 returning premium_until", [r.user_id, String(days)]);
        if (!prof[0]) throw notFound("Profil introuvable.");
        await tx.query("update ika_premium_requests set status = 'APPROVED', granted_months = $2, decided_by = $3, decided_at = now(), decided_note = $4 where id = $1", [r.id, granted, staffId, why]);
        await tx.query("insert into ika_premium_grants (id, user_id, granted_by, days, reason) values ($1, $2, $3, $4, $5)", [`pg_${randomUUID()}`, r.user_id, staffId, days, `Approbation manuelle Premium (${granted} mois)`]);
        await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_APPROVE", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, months: granted, steps: doneSteps.map((s) => ({ step: s.step, by: s.done_by })) } }).catch(() => {});
        const certified = await isCertified(r.user_id, tx); // information seulement (badge de confiance)
        const phoneOk = (await tx.query("select phone_verified_at, phone_channel from ika_profiles where user_id = $1", [r.user_id]).catch(() => []))[0];
        const smsOk = Boolean(phoneOk?.phone_verified_at);
        if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Premium activé", body: !smsOk ? `Votre Premium est activé pour ${granted} mois, mais ses avantages restent fermés tant que votre numéro de téléphone n'est pas confirmé. C'est une protection pour tous les utilisateurs. Confirmez-le depuis la page Devenir Premium.` : `Votre Premium est activé pour ${granted} mois. Votre centre de contrôle est ouvert : « Mon espace ».`, link: smsOk ? "#/centre" : "#/devenir-premium" }).catch(() => undefined);
        return { ok: true, status: "APPROVED", premiumUntil: iso(prof[0].premium_until), certified };
      });
    },
  };
}
