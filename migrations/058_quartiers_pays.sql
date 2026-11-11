-- Quartiers et pays gérés par le Superadmin (Owner Control Center, « Quartiers & pays »).
-- Additive : une table nouvelle (ika_zones), une colonne ajoutée à ika_listings (pays, « ML » par défaut), les 10 quartiers d'origine repris tels quels.
-- ika_countries existe déjà (migration 021) : le Mali y est actif ; le Superadmin peut en ajouter et les activer.
-- Retour arrière : scripts/rollback/058_quartiers_pays_down.sql
create table if not exists ika_zones (
  id text primary key,
  name text not null check (length(name) between 2 and 60),
  country_code char(2) not null references ika_countries (code),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  active boolean not null default true,
  created_by text references ika_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un nom de quartier = un seul quartier (l'annonce garde le nom en texte : « neighborhood »).
create unique index if not exists ika_zones_name_uniq on ika_zones (lower(name));
create index if not exists ika_zones_country_idx on ika_zones (country_code, active);

insert into ika_zones (id, name, country_code, latitude, longitude) values
  ('zone-aci-2000', 'ACI 2000', 'ML', 12.616, -8.024),
  ('zone-badalabougou', 'Badalabougou', 'ML', 12.612, -7.986),
  ('zone-korofina', 'Korofina', 'ML', 12.662, -7.992),
  ('zone-hamdallaye', 'Hamdallaye', 'ML', 12.649, -8.016),
  ('zone-yirimadio', 'Yirimadio', 'ML', 12.608, -7.958),
  ('zone-bacodjicoroni', 'Bacodjicoroni', 'ML', 12.582, -8.018),
  ('zone-sebenikoro', 'Sébénikoro', 'ML', 12.574, -8.078),
  ('zone-kalaban-coura', 'Kalaban Coura', 'ML', 12.578, -7.978),
  ('zone-sotuba', 'Sotuba', 'ML', 12.648, -7.928),
  ('zone-kati', 'Kati', 'ML', 12.745, -8.072)
on conflict do nothing;

alter table ika_listings add column if not exists country_code char(2) not null default 'ML' references ika_countries (code);
