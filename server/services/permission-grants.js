// Attribution individuelle de permissions nommées (BUG-004, PLAN_ROLES_PERMISSIONS « Code A »).
// Réservé à `permissions.grant` (Superadmin). Règles de fond dans server/lib/permissions.js (assertCanGrant) ; la base
// refuse en plus toute permission non délégable (déclencheur de la migration 025). Chaque octroi / retrait est tracé dans ika_audit.
import { badRequest, notFound } from "../lib/errors.js";
import { assertCanGrant, can } from "../lib/permissions.js";

const MAX_DAYS = 365;

function expiryDays(days) {
  if (days === undefined || days === null || days === "") return null; // sans échéance
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) throw badRequest(`Durée invalide (1 à ${MAX_DAYS} jours, ou vide pour sans échéance).`);
  return n;
}

export function createPermissionGrants({ db, accounts }) {
  return {
    /** Permissions accordables (catalogue de la base) et attributions en cours (non expirées). */
    async list(actorId) {
      await accounts.requirePermission(actorId, "permissions.grant");
      const grantable = await db.query("select code, label from ika_permissions where delegable order by code");
      const rows = await db.query(
        `select g.user_id, u.name, p.staff_role, g.permission_code, g.reason, g.granted_by, g.granted_at, g.expires_at
           from ika_user_permissions g
           join ika_users u on u.id = g.user_id
           join ika_profiles p on p.user_id = g.user_id
          where g.expires_at is null or g.expires_at > now()
          order by u.name, g.permission_code`,
      );
      return {
        grantable,
        grants: rows.map((r) => ({
          userId: r.user_id, name: r.name, staffRole: r.staff_role, permission: r.permission_code, reason: r.reason,
          grantedBy: r.granted_by, grantedAt: r.granted_at, expiresAt: r.expires_at,
        })),
      };
    },

    /** Accorde (ou renouvelle) une permission à un modérateur ou un administrateur. `days` : durée facultative. */
    async grant(actorId, { userId, permission, reason, days } = {}) {
      const actor = await accounts.requirePermission(actorId, "permissions.grant");
      const target = (await db.query("select staff_role from ika_profiles where user_id = $1", [userId]))[0];
      if (!target) throw notFound("Compte introuvable.");
      assertCanGrant({ actorId, actorRole: actor.staff_role, targetId: userId, targetRole: target.staff_role, permission, reason });
      if (can(target.staff_role, permission)) throw badRequest("Son rôle lui donne déjà cette permission.");
      const nbDays = expiryDays(days);
      const why = String(reason).trim().slice(0, 300);
      await db.transaction(async (tx) => {
        await tx.query(
          `insert into ika_user_permissions (user_id, permission_code, granted_by, reason, expires_at)
           values ($1, $2, $3, $4, case when $5::int is null then null else now() + ($5::int || ' days')::interval end)
           on conflict (user_id, permission_code) do update
             set granted_by = excluded.granted_by, granted_at = now(), reason = excluded.reason, expires_at = excluded.expires_at`,
          [userId, permission, actorId, why, nbDays],
        );
        await accounts.audit(actorId, "PERMISSION_GRANT", null, `${permission} ${userId} : ${why}`, tx);
      });
      return { ok: true };
    },

    /** Retire une attribution individuelle (les droits issus du rôle ne sont pas concernés). */
    async revoke(actorId, { userId, permission } = {}) {
      await accounts.requirePermission(actorId, "permissions.grant");
      await db.transaction(async (tx) => {
        const removed = await tx.query("delete from ika_user_permissions where user_id = $1 and permission_code = $2 returning user_id", [userId, permission]);
        if (!removed[0]) throw notFound("Aucune attribution à retirer.");
        await accounts.audit(actorId, "PERMISSION_REVOKE", null, `${permission} ${userId}`, tx);
      });
      return { ok: true };
    },
  };
}
