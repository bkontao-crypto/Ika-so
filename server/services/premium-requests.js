// Demandes Premium à la main (paiement en ligne fermé). Approbation : 1 à 3 mois, dans la limite fixée par le superadmin.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { DEFAULT_POLICY, POLICY_KEY, normalizePolicy } from "../lib/payment-policy.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);

export function createPremiumRequests({ db, accounts, notify, superadminSettings, moderationAudit, payments }) {
  async function policy() {
    return normalizePolicy((await superadminSettings?.get(POLICY_KEY)) ?? DEFAULT_POLICY);
  }
  const view = (r) => ({ id: r.id, userId: r.user_id, months: r.months, status: r.status, grantedMonths: r.granted_months, decidedAt: iso(r.decided_at), decidedNote: r.decided_note, createdAt: iso(r.created_at), name: r.name, email: r.email });

  return {
    policy,

    /** L'annonceur demande le Premium pour 1 à maxMois mois. Refusé si le paiement en ligne est ouvert (il doit payer). */
    async create(userId, { months } = {}) {
      await accounts.requireActive(userId);
      const p = await policy();
      if (await payments.onlineOpen()) throw forbidden("Le paiement en ligne est ouvert : choisissez une formule et payez directement.");
      const m = Math.floor(Number(months));
      if (!Number.isFinite(m) || m < 1 || m > p.manualPremiumMaxMonths) throw badRequest(`Durée invalide (1 à ${p.manualPremiumMaxMonths} mois).`);
      const pending = await db.query("select id from ika_premium_requests where user_id = $1 and status = 'PENDING'", [userId]);
      if (pending[0]) throw conflict("Une demande Premium est déjà en attente.");
      const id = `pr_${randomUUID()}`;
      await db.query("insert into ika_premium_requests (id, user_id, months) values ($1, $2, $3)", [id, userId, m]);
      return { ok: true, id };
    },

    /** Dernière demande de l'annonceur (et la politique à afficher). */
    async mine(userId) {
      const rows = await db.query("select * from ika_premium_requests where user_id = $1 order by created_at desc limit 1", [userId]);
      return { request: rows[0] ? view(rows[0]) : null, policy: await policy() };
    },

    /** File des demandes pour l'équipe (en attente d'abord). */
    async listForStaff() {
      const rows = await db.query(
        `select r.*, p.full_name as name, u.email from ika_premium_requests r
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
          await tx.query("update ika_premium_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decided_note = $3 where id = $1", [r.id, staffId, why]);
          await moderationAudit?.log(staffId, { action: "PREMIUM_REQUEST_REJECT", targetType: "premium_request", targetId: r.id, details: { userId: r.user_id, note: why } }).catch(() => {});
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
        if (notify) await notify(r.user_id, { kind: "PREMIUM", title: "Premium activé", body: `Votre Premium est activé pour ${granted} mois.`, link: "/premium" }).catch(() => undefined);
        return { ok: true, status: "APPROVED", premiumUntil: iso(prof[0].premium_until) };
      });
    },
  };
}
