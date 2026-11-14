// Service « biens » (DEC-004) — Étape 3
export function createProperties({ db }) {
  return {
    async mine(userId) {
      const rows = await db.query(
        `select p.*, 
                (select count(*) from ika_listings l where l.property_id = p.id) as listing_count
         from ika_properties p
         where p.owner_id = $1
         order by p.updated_at desc`,
        [userId]
      );
      return rows;
    },

    async create(userId, input) {
      const rows = await db.query(
        `insert into ika_properties (owner_id, title, category, address, neighborhood, surface_m2, notes)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning *`,
        [userId, input.title, input.category || null, input.address || null,
         input.neighborhood || null, input.surface_m2 || null, input.notes || null]
      );
      return rows[0];
    },

    async get(userId, id) {
      const rows = await db.query(
        `select p.*, 
                (select json_agg(json_build_object('id', l.id, 'title', l.title, 'status', l.status))
                 from ika_listings l where l.property_id = p.id) as listings
         from ika_properties p
         where p.id = $1 and p.owner_id = $2`,
        [id, userId]
      );
      return rows[0] || null;
    },
  };
}