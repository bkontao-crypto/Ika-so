-- 090 : favoris des publications Découvrir (menu « ⋯ » de la publication). Les favoris d'annonces (ika_favorites) sont inchangés.
create table if not exists ika_publication_favorites (
  user_id text not null references ika_users (id) on delete cascade,
  publication_id text not null references ika_publications (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, publication_id)
);
create index if not exists ika_publication_favorites_user_idx on ika_publication_favorites (user_id, created_at desc);
