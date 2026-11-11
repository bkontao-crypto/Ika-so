-- Module « Cartographie immobilière » (étape 1) : position GPS et délimitation de parcelle d'une annonce.
-- Additive : aucune table ni donnée existante n'est modifiée. Une ligne par annonce, supprimée avec elle.
-- Coordonnées en WGS84 (EPSG:4326), degrés décimaux. Le polygone est un GeoJSON « Polygon » (un seul anneau, [longitude, latitude]).
-- PostGIS n'est pas requis : voir scripts/postgis-optionnel.sql pour l'ajout facultatif d'une colonne géométrique indexée.
-- Retour arrière : scripts/rollback/020_listing_geo_down.sql
create table if not exists ika_listing_geo (
  listing_id text primary key references ika_listings (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  polygon jsonb check (polygon is null or jsonb_typeof(polygon) = 'object'),
  vertex_count integer not null default 0 check (vertex_count between 0 and 500),
  area_m2 double precision check (area_m2 is null or area_m2 >= 0),
  perimeter_m double precision check (perimeter_m is null or perimeter_m >= 0),
  computed_at timestamptz,
  -- Position exacte masquée au public tant que l'annonceur ne l'a pas demandé.
  is_public boolean not null default false,
  created_by text references ika_users (id) on delete set null,
  updated_by text references ika_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ika_listing_geo_point_idx on ika_listing_geo (latitude, longitude);
