// Service journal d'audit de modération (E09)
export function createModerationAudit({ db }) {
  return {
    async log(actorId, { action, targetType, targetId = null, details = null }) {
      if (!actorId || !action || !targetType) return null;
      const rows = await db.query(
        `insert into ika_moderation_audit (actor_id, action, target_type, target_id, details)
         values ($1, $2, $3, $4, $5)
         returning id, created_at`,
        [actorId, action, targetType, targetId, details ? JSON.stringify(details) : null]
      );
      return rows[0] || null;
    },

    async list({ targetType, targetId, actorId, limit = 50, offset = 0 } = {}) {
      const where = [];
      const params = [];
      if (targetType) { params.push(targetType); where.push(`target_type = $${params.length}`); }
      if (targetId) { params.push(targetId); where.push(`target_id = $${params.length}`); }
      if (actorId) { params.push(actorId); where.push(`actor_id = $${params.length}`); }
      params.push(Math.min(200, Math.max(1, limit)), Math.max(0, offset));
      const rows = await db.query(
        `select * from ika_moderation_audit
         ${where.length ? 'where ' + where.join(' and ') : ''}
         order by created_at desc
         limit $${params.length - 1} offset $${params.length}`,
        params
      );
      return rows;
    },
  };
}
