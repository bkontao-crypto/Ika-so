// Délégations Owner Center (DEC-003)
// Un admin n'accède à un module délégable que s'il lui a été attribué par un Superadmin.
import { badRequest, forbidden } from "../lib/errors.js";

export const DELEGABLE_MODULES = new Set([
  "dashboard", "overview", "activity", "charts", "trends", "regions",
  "report", "report.pdf", "premium-funnel", "subscriptions", "monitoring",
  "health", "agencies", "crm", "pipeline", "visits", "complaints", "incidents",
  "marketing", "campaigns", "partners", "imports", "duplicates", "moderation",
  "reviews", "trust",
]);

export function createOwnerDelegations({ db, accounts }) {
  async function requireSuper(userId) {
    const profile = await accounts.requireStaff(userId, "SUPERADMIN");
    return profile;
  }

  return {
    async list(actorId) {
      await requireSuper(actorId);
      return db.query(`select d.user_id, d.module, d.granted_at, u.name
                       from ika_owner_delegations d
                       join ika_users u on u.id = d.user_id
                       order by u.name, d.module`);
    },

    async grant(actorId, targetUserId, module) {
      await requireSuper(actorId);
      if (!DELEGABLE_MODULES.has(module)) throw badRequest("Module non délégable.");
      await db.query(`insert into ika_owner_delegations (user_id, module, granted_by)
                      values ($1, $2, $3) on conflict (user_id, module) do nothing`,
                     [targetUserId, module, actorId]);
      return { ok: true };
    },

    async revoke(actorId, targetUserId, module) {
      await requireSuper(actorId);
      await db.query("delete from ika_owner_delegations where user_id = $1 and module = $2",
                     [targetUserId, module]);
      return { ok: true };
    },

    async canAccess(userId, module) {
      const profile = await accounts.requireStaff(userId, "MODERATOR");
      if (profile.staff_role === "SUPERADMIN") return true;
      if (profile.staff_role !== "ADMIN") return false;
      if (!DELEGABLE_MODULES.has(module)) return false;
      const rows = await db.query("select 1 from ika_owner_delegations where user_id = $1 and module = $2", [userId, module]);
      return rows.length > 0;
    },
  };
}
