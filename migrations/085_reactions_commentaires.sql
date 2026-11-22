-- 085 : « j'aime » (annonces, publications, commentaires), commentaires sur les publications Découvrir, republication interne.
create table if not exists ika_likes (
  user_id text not null references ika_users (id) on delete cascade,
  target_type text not null check (target_type in ('LISTING', 'PUBLICATION', 'COMMENT')),
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists ika_likes_target_idx on ika_likes (target_type, target_id);

-- Un commentaire porte soit sur une annonce, soit sur une publication (les commentaires d'annonce existants sont inchangés).
alter table ika_comments alter column listing_id drop not null;
alter table ika_comments add column if not exists publication_id text references ika_publications (id) on delete cascade;
alter table ika_comments add constraint ika_comments_one_target check ((listing_id is not null) <> (publication_id is not null));
create index if not exists ika_comments_publication_idx on ika_comments (publication_id, created_at) where publication_id is not null;

-- Republication sur Découvrir : référence vers l'annonce ou la publication d'origine (sans clé étrangère : l'original peut disparaître).
alter table ika_publications add column if not exists shared_type text check (shared_type is null or shared_type in ('LISTING', 'PUBLICATION'));
alter table ika_publications add column if not exists shared_id text;
create index if not exists ika_publications_shared_idx on ika_publications (shared_type, shared_id) where shared_id is not null;
