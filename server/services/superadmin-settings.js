// Service réglages Superadmin (E09)
const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** Réglages d'affichage exposés sans authentification : liste blanche, jamais le reste de la table. */
export function publicView(main) {
  const m = main && typeof main === "object" ? main : {};
  const out = {};
  if (typeof m.welcome_title === "string") out.welcome_title = m.welcome_title.slice(0, 160);
  if (typeof m.welcome_subtitle === "string") out.welcome_subtitle = m.welcome_subtitle.slice(0, 300);
  if (m.modules && typeof m.modules === "object") {
    out.modules = {};
    for (const k of ["crm", "map", "premium", "whatsapp"]) if (typeof m.modules[k] === "boolean") out.modules[k] = m.modules[k];
  }
  if (m.colors && typeof m.colors === "object") {
    out.colors = {};
    for (const k of ["primary", "accent"]) if (typeof m.colors[k] === "string" && HEX.test(m.colors[k])) out.colors[k] = m.colors[k];
  }
  return out;
}

export function createSuperadminSettings({ db }) {
  return {
    publicView,
    async get(key) {
      const rows = await db.query(
        `select value from ika_superadmin_settings where key = $1`,
        [key]
      );
      return rows[0]?.value ?? null;
    },

    async getAll() {
      const rows = await db.query(
        `select key, value, updated_at from ika_superadmin_settings order by key`
      );
      return Object.fromEntries(rows.map(r => [r.key, r.value]));
    },

    async set(actorId, key, value) {
      const rows = await db.query(
        `insert into ika_superadmin_settings (key, value, updated_by)
         values ($1, $2, $3)
         on conflict (key) do update
           set value = excluded.value,
               updated_at = now(),
               updated_by = excluded.updated_by
         returning key, value, updated_at`,
        [key, JSON.stringify(value), actorId]
      );
      return rows[0];
    },
  };
}
