-- 078 : « Découvrir » — publications de la communauté (actualité, information, demande « Je cherche »), distinctes des annonces professionnelles.
-- Réutilise ika_publications (déjà les publications du profil) : les anciennes lignes deviennent des « Actualité » publiées.
alter table ika_publications add column if not exists kind text not null default 'ACTUALITE' check (kind in ('ACTUALITE', 'RECHERCHE', 'INFORMATION'));
alter table ika_publications add column if not exists category text check (category is null or char_length(category) <= 40);
alter table ika_publications add column if not exists zone text check (zone is null or char_length(zone) <= 80);
alter table ika_publications add column if not exists status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'HIDDEN'));
alter table ika_publications add column if not exists hidden_by text;
alter table ika_publications add column if not exists hidden_at timestamptz;
alter table ika_publications add column if not exists hidden_reason text;
create index if not exists ika_publications_feed_idx on ika_publications (created_at desc) where status = 'PUBLISHED';

-- Photos d'une publication (fichiers dans stored_files, comme les photos d'annonce).
create table if not exists ika_publication_photos (
  publication_id text not null references ika_publications (id) on delete cascade,
  position smallint not null check (position between 0 and 11),
  url text not null check (url ~ '^/api/media/[0-9a-f-]{36}$'),
  primary key (publication_id, position)
);
create index if not exists ika_publication_photos_url_idx on ika_publication_photos (url);

-- Signalements par les membres ; la modération masque ou rétablit (rien n'est supprimé par elle).
create table if not exists ika_publication_reports (
  id text primary key,
  publication_id text not null references ika_publications (id) on delete cascade,
  reporter_id text not null references ika_users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (publication_id, reporter_id)
);

-- Discussion à partir d'une publication : une conversation peut porter sur une annonce OU sur une publication.
alter table ika_threads alter column listing_id drop not null;
alter table ika_threads add column if not exists publication_id text references ika_publications (id) on delete cascade;
alter table ika_threads drop constraint if exists ika_threads_subject_chk;
alter table ika_threads add constraint ika_threads_subject_chk check (listing_id is not null or publication_id is not null);
create unique index if not exists ika_threads_publication_visitor_uniq on ika_threads (publication_id, visitor_id) where publication_id is not null;
