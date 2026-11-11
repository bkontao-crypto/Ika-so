-- Profil annonceur enrichi : abonnements, publications, équipe, services.
-- Additive. Données gérées par le propriétaire du profil ou le staff.

create table if not exists ika_follows (
  follower_id text not null references ika_users (id) on delete cascade,
  followee_id text not null references ika_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
create index if not exists ika_follows_followee_idx on ika_follows (followee_id);

create table if not exists ika_publications (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists ika_publications_user_idx on ika_publications (user_id, created_at desc);

create table if not exists ika_team_members (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  name text not null,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists ika_services (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
