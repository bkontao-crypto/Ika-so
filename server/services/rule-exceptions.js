// Conditions officielles (superadmin) + exceptions par compte (« jurisprudence »), toujours tracées : qui, quand, pourquoi.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { EXCEPTION_RULES, RULES_KEY, normalizeRules, stepRule } from "../lib/account-rules.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);

export function createRuleExceptions({ db, superadminSettings, accounts, moderationAudit }) {
  async function official() {
    return normalizeRules(await superadminSettings.get(RULES_KEY));
  }
  const view = (r) => ({
    id: r.id, userId: r.user_id, rule: r.rule, label: EXCEPTION_RULES[r.rule] ?? r.rule, reason: r.reason,
    grantedBy: r.granted_by, grantedByName: r.granted_name || r.granted_by, createdAt: iso(r.created_at), expiresAt: iso(r.expires_at),
    revokedAt: iso(r.revoked_at), revokedBy: r.revoked_by, revokedByName: r.revoked_name || r.revoked_by || null, revokedReason: r.revoked_reason,
    active: !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date()),
  });
  const SELECT = `select e.*, g.full_name as granted_name, v.full_name as revoked_name
                    from ika_rule_exceptions e left join ika_profiles g on g.user_id = e.granted_by left join ika_profiles v on v.user_id = e.revoked_by`;

  return {
    official,
    catalogue: EXCEPTION_RULES,

    /** Le superadmin décide des conditions officielles. Avant/après tracés. */
    async saveOfficial(actorId, value) {
      await accounts.requireStaff(actorId, "SUPERADMIN");
      const before = await official();
      const next = normalizeRules(value);
      await superadminSettings.set(actorId, RULES_KEY, next);
      await moderationAudit?.log(actorId, { action: "RULES_UPDATE", targetType: "settings", targetId: RULES_KEY, details: { before, after: next } }).catch(() => {});
      return next;
    },

    /** Exceptions actives d'un compte (clés), pour appliquer les conditions. */
    async activeKeys(userId, q = db) {
      const rows = await q.query("select rule from ika_rule_exceptions where user_id = $1 and revoked_at is null and (expires_at is null or expires_at > now())", [userId]);
      return new Set(rows.map((r) => r.rule));
    },

    /** Liste complète (actives, expirées, révoquées) : historique du compte, noms visibles côté équipe seulement. */
    async listForUser(userId, q = db) {
      return (await q.query(`${SELECT} where e.user_id = $1 order by e.created_at desc limit 100`, [userId])).map(view);
    },

    /** Accorde une exception : motif obligatoire ; réservé au rôle décidé par le superadmin. */
    async grant(actorId, userId, { rule, reason, days } = {}) {
      const conditions = await official();
      await accounts.requireStaff(actorId, conditions.exceptionGrantedBy);
      if (!EXCEPTION_RULES[rule]) throw badRequest("Condition inconnue.");
      const why = String(reason ?? "").trim().slice(0, 500);
      if (why.length < 5) throw badRequest("Indiquez le motif de l'exception (5 caractères au moins) : il est conservé dans l'historique du compte.");
      const d = days === undefined || days === null || days === "" ? null : Math.floor(Number(days));
      if (d !== null && (!Number.isFinite(d) || d < 1 || d > 365)) throw badRequest("Durée de l'exception : 1 à 365 jours, ou sans limite.");
      const target = (await db.query("select user_id from ika_profiles where user_id = $1", [String(userId ?? "").slice(0, 80)]))[0];
      if (!target) throw notFound("Compte introuvable.");
      const id = `rx_${randomUUID()}`;
      const rows = await db.query(
        "insert into ika_rule_exceptions (id, user_id, rule, reason, granted_by, expires_at) values ($1, $2, $3, $4, $5, case when $6::int is null then null else now() + ($6::int || ' days')::interval end) on conflict (user_id, rule) where revoked_at is null do nothing returning id",
        [id, target.user_id, rule, why, actorId, d]);
      if (!rows[0]) throw conflict("Une exception est déjà active pour cette condition sur ce compte. Révoquez-la d'abord pour la remplacer.");
      await moderationAudit?.log(actorId, { action: "RULE_EXCEPTION_GRANT", targetType: "user", targetId: target.user_id, details: { exceptionId: id, rule, reason: why, days: d } }).catch(() => {});
      return { ok: true, id };
    },

    /** Révoque une exception (elle reste dans l'historique). Mêmes personnes que pour l'accorder. */
    async revoke(actorId, exceptionId, { reason } = {}) {
      const conditions = await official();
      await accounts.requireStaff(actorId, conditions.exceptionGrantedBy);
      const why = String(reason ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez pourquoi vous révoquez cette exception (3 caractères au moins).");
      const rows = await db.query("update ika_rule_exceptions set revoked_at = now(), revoked_by = $2, revoked_reason = $3 where id = $1 and revoked_at is null returning user_id, rule", [String(exceptionId ?? "").slice(0, 80), actorId, why]);
      if (!rows[0]) throw notFound("Aucune exception active avec cet identifiant.");
      await moderationAudit?.log(actorId, { action: "RULE_EXCEPTION_REVOKE", targetType: "user", targetId: rows[0].user_id, details: { exceptionId, rule: rows[0].rule, reason: why } }).catch(() => {});
      return { ok: true };
    },
  };
}
export { stepRule };
