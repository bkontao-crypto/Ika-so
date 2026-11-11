-- Comptes et sessions. Mot de passe : scrypt (jamais en clair). Session : seul le hachage du jeton est stocké.
create table if not exists ika_users (
  id text primary key,
  email text not null unique check (email = lower(email)),
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists ika_sessions (
  token_hash text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_sessions_user_idx on ika_sessions (user_id);
create index if not exists ika_sessions_expires_idx on ika_sessions (expires_at);
