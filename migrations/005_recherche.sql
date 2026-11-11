-- Phase 2 : recherche plein texte (sans accents, français) et recherche par fragments de mots.
-- unaccent et pg_trgm sont fournis par le paquet « contrib » de PostgreSQL et sont des extensions de confiance (aucun super-utilisateur requis).
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent n'est pas déclaré « immutable » par PostgreSQL ; avec un dictionnaire fixé il l'est en pratique, ce qui permet de l'indexer.
create or replace function ika_norm(value text) returns text
language sql immutable parallel safe
as $$ select lower(public.unaccent('public.unaccent'::regdictionary, coalesce(value, ''))) $$;

create index if not exists ika_listings_search_fts_idx on ika_listings
  using gin (to_tsvector('french', ika_norm(title || ' ' || neighborhood || ' ' || description)));
create index if not exists ika_listings_search_trgm_idx on ika_listings
  using gin (ika_norm(title || ' ' || neighborhood || ' ' || description) gin_trgm_ops);
create index if not exists ika_listings_filters_idx on ika_listings (category, transaction_type, neighborhood, price)
  where status = 'PUBLISHED';
