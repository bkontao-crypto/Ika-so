// Conditions officielles (superadmin) + exceptions par compte (« jurisprudence »), toujours tracées : qui, quand, pourquoi.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { EXCEPTION_RULES, RULES_KEY, normalizeRules, stepRule } from "../lib/account-rules.js";
import { describeGroups, evaluateGroups, factsFromRow, normalizeGroups, sameGroups } from "../lib/certification-criteria.js";

const UNLIMITED = "9999-12-31T00:00:00Z"; // Premium sans limite : date lointaine, pour que tous les contrôles existants restent valides
const LIVE = "l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())";
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

  /** Droits acquis : les comptes Premium actifs qui remplissaient l'ancienne règle la gardent jusqu'à la fin de leur Premium en cours. */
  async function protectAcquired(actorId, oldGroups) {
    const rows = await db.query(
      `select p.user_id, p.premium_until, p.phone_verified_at, p.agency_verified_at,
              (select count(*)::int from ika_listings l where l.owner_id = p.user_id and ${LIVE} and l.document_verified_at is not null) as title_checked
         from ika_profiles p where p.premium_until > now()`);
    const label = describeGroups(oldGroups);
    for (const r of rows) {
      if (!evaluateGroups(oldGroups, factsFromRow(r)).satisfied) continue;
      await db.query(
        `insert into ika_certification_acquise (user_id, until, rule_before, changed_by) values ($1, $2, $3, $4)
         on conflict (user_id) do update set until = greatest(ika_certification_acquise.until, excluded.until), rule_before = excluded.rule_before, changed_by = excluded.changed_by, created_at = now()`,
        [r.user_id, r.premium_until, label, actorId]);
    }
  }

  return {
    official,
    catalogue: EXCEPTION_RULES,

    /** Le superadmin décide des conditions officielles. Avant/après tracés. */
    async saveOfficial(actorId, value) {
      await accounts.requireStaff(actorId, "SUPERADMIN");
      if (value && typeof value === "object" && value.certificationGroups !== undefined) value = { ...value, certificationGroups: normalizeGroups(value.certificationGroups) }; // 400 si critère inconnu ou vide
      const before = await official();
      const next = normalizeRules({ ...before, ...(value && typeof value === "object" ? value : {}) });
      await superadminSettings.set(actorId, RULES_KEY, next);
      if (!sameGroups(before.certificationGroups, next.certificationGroups)) await protectAcquired(actorId, before.certificationGroups);
      await moderationAudit?.log(actorId, { action: "RULES_UPDATE", targetType: "settings", targetId: RULES_KEY, details: { before, after: next } }).catch(() => {});
      return next;
    },

    /** Droit acquis actif d'un compte (null si aucun) : date de fin et règle d'origine. */
    async acquired(userId, q = db) {
      const r = (await q.query("select until, rule_before, created_at from ika_certification_acquise where user_id = $1 and until > now()", [userId]))[0];
      return r ? { until: iso(r.until), ruleBefore: r.rule_before, since: iso(r.created_at) } : null;
    },

    /** État Premium pour la fiche : sans limite ou non, qui l'a décidé. */
    async premiumState(userId, q = db) {
      const r = (await q.query("select p.premium_until, p.premium_unlimited, p.premium_unlimited_at, p.premium_unlimited_reason, g.full_name as by_name from ika_profiles p left join ika_profiles g on g.user_id = p.premium_unlimited_by where p.user_id = $1", [userId]))[0];
      return r ? { premiumUntil: iso(r.premium_until), unlimited: Boolean(r.premium_unlimited), by: r.by_name ?? null, at: iso(r.premium_unlimited_at), reason: r.premium_unlimited_reason } : null;
    },

    /** Premium sans limite : superadmin seul, motif obligatoire, tracé. Il dure jusqu'à retrait ou suspension/expulsion du compte. Le retirer met fin au Premium immédiatement. */
    async setPremiumUnlimited(actorId, userId, { on, reason } = {}) {
      await accounts.requireStaff(actorId, "SUPERADMIN");
      const why = String(reason ?? "").trim().slice(0, 500);
      if (why.length < 5) throw badRequest("Indiquez le motif (5 caractères au moins) : il est conservé dans l'historique du compte.");
      const target = String(userId ?? "").slice(0, 80);
      const rows = on
        ? await db.query("update ika_profiles set premium_until = $2, premium_unlimited = true, premium_unlimited_by = $3, premium_unlimited_at = now(), premium_unlimited_reason = $4 where user_id = $1 returning user_id", [target, UNLIMITED, actorId, why])
        : await db.query("update ika_profiles set premium_until = now(), premium_unlimited = false, premium_unlimited_by = $2, premium_unlimited_at = now(), premium_unlimited_reason = $3 where user_id = $1 and premium_unlimited returning user_id", [target, actorId, why]);
      if (!rows[0]) throw notFound(on ? "Compte introuvable." : "Ce compte n'a pas de Premium sans limite.");
      await moderationAudit?.log(actorId, { action: on ? "PREMIUM_UNLIMITED_ON" : "PREMIUM_UNLIMITED_OFF", targetType: "user", targetId: target, details: { reason: why } }).catch(() => {});
      return { ok: true, unlimited: Boolean(on) };
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
