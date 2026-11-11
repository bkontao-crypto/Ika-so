-- Brouillon d'annonce enregistré côté serveur : un seul brouillon « nouvelle annonce » par compte.
-- Table séparée de ika_listings : un brouillon peut être incomplet (prix vide, aucune photo) et ne doit
-- jamais apparaître dans les listes, la modération, la recherche ni les statistiques.
-- Additive seulement : aucune table ni colonne existante n'est modifiée.
create table if not exists ika_listing_drafts (
  user_id text primary key references ika_users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  -- Garde-fou : l'application plafonne déjà la taille, la base la refuse aussi.
  constraint ika_listing_drafts_size check (pg_column_size(payload) <= 24000)
);
