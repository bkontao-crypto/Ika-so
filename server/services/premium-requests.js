// Demandes Premium à la main (paiement en ligne fermé). Approbation : 1 à 3 mois, dans la limite fixée par le superadmin.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { DEFAULT_POLICY, POLICY_KEY, normalizePolicy } from "../lib/payment-policy.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);
export const ACCOUNT_TYPES = ["AGENCY", "INDIVIDUAL", "OTHER"];
const cleanPhone = (v) => String(v ?? "").replace(/[^\d+]/g, "").slice(0, 20);

export function createPremiumRequests({ requestsHub, db, accounts, notify, superadminSettings, moderationAudit, payments }) {
  async function policy() {
    return normalizePolicy((await superadminSettings?.get(POLICY_KEY)) ?? DEFAULT_POLICY);
  }
  const view = (r) => ({ id: r.id, userId: r.user_id, months: r.months, status: r.status, grantedMonths: r.granted_months, decidedAt: iso(r.decided_at), decidedNote: r.decided_note, createdAt: iso(r.created_at), name: r.name, email: r.email, accountType: r.account_type, phone: r.phone, message: r.message, acceptedTermsAt: iso(r.accepted_terms_at), cancelledAt: iso(r.cancelled_at), certified: r.certified === undefined ? undefined : Boolean(r.certified) });

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
      const p = await policy();
      if (await payments.onlineOpen()) throw forbidden("Le paiement en ligne est ouvert : choisissez une formule et payez directement.");
      const m = Math.floor(Number(months));
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
      await db.query("insert into ika_premium_requests (id, user_id, months, account_type, phone, message, accepted_terms_at) values ($1, $2, $3, $4, $5, $6, now())", [id, userId, m, type, tel, note]);
      await requestsHub?.notifyStaff({ kind: "PREMIUM_REQUEST", title: "Nouvelle demande Premium", body: `${type === "AGENCY" ? "Agence" : type === "INDIVIDUAL" ? "Particulier" : "Professionnel"} · ${m} mois demandés.`, link: "/owner#/requests", exceptUserId: userId, module: "payments" });
      return { ok: true, id };
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
      return { request: rows[0] ? view(rows[0]) : null, history: rows.map(view), policy: await policy() };
    },

    /** File des demandes pour l'équipe (en attente d'abord). */
    async listForStaff() {
      const rows = await db.query(
        `select r.*, p.full_name as name, u.email,
                (p.agency_verified_at is not null or exists (select 1 from ika_listings l where l.owner_id = r.user_id and l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now()) and l.document_verified_at is not null)) as certified
           from ika_premium_requests r
           join ika_users u on u.id = r.user_id left join ika_profiles p on p.user_id = r.user_id
          order by (r.status = 'PENDING') desc, r.created_at desc limit 200`);
      return { requests: rows.map(view), policy: await policy() };
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
          await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_REJECT", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, note: why } }).catch(() => {});
          if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Demande Premium non retenue", body: why ? `Motif : ${why}` : "Votre demande Premium n'a pas été retenue. Vous pouvez en déposer une nouvelle.", link: "#/devenir-premium" }).catch(() => undefined);
          return { ok: true, status: "REJECTED" };
        }
        if (action !== "APPROVE") throw badRequest("Action inconnue.");
        const granted = Math.floor(Number(months));
        if (!Number.isFinite(granted) || granted < 1 || granted > p.manualPremiumMaxMonths) throw badRequest(`Durée accordée : 1 à ${p.manualPremiumMaxMonths} mois.`);
        const days = granted * 30;
        const prof = await tx.query("update ika_profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval where user_id = $1 returning premium_until", [r.user_id, String(days)]);
        if (!prof[0]) throw notFound("Profil introuvable.");
        await tx.query("update ika_premium_requests set status = 'APPROVED', granted_months = $2, decided_by = $3, decided_at = now(), decided_note = $4 where id = $1", [r.id, granted, staffId, why]);
        await tx.query("insert into ika_premium_grants (id, user_id, granted_by, days, reason) values ($1, $2, $3, $4, $5)", [`pg_${randomUUID()}`, r.user_id, staffId, days, `Approbation manuelle Premium (${granted} mois)`]);
        await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_APPROVE", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, months: granted } }).catch(() => {});
        const certified = await isCertified(r.user_id, tx);
        if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Premium activé", body: certified ? `Votre Premium est activé pour ${granted} mois. Votre centre de contrôle est ouvert : « Mon espace ».` : `Votre Premium est activé pour ${granted} mois. Dernière étape : faire certifier votre profil (agence : registre de commerce ; particulier : titre foncier d'une annonce). Le centre de contrôle s'ouvrira ensuite.`, link: certified ? "#/centre" : "#/devenir-premium" }).catch(() => undefined);
        return { ok: true, status: "APPROVED", premiumUntil: iso(prof[0].premium_until), certified };
      });
    },
  };
}
