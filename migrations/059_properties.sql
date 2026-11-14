-- Migration 059 — Entité « bien » (DEC-004)
-- Additive : aucune donnée existante n'est modifiée.
-- Un bien peut être lié à plusieurs annonces via property_id (nullable).

create table if not exists ika_properties (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null references ika_users(id) on delete cascade,
  title text not null,
  category text,
  address text,
  neighborhood text,
  surface_m2 numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ika_properties_owner_idx on ika_properties(owner_id);

alter table ika_listings
  add column if not exists property_id text references ika_properties(id) on delete set null;

create index if not exists ika_listings_property_idx on ika_listings(property_id);
