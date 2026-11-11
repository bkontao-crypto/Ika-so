-- Réinitialisation du mot de passe : jeton à usage unique, valable 30 minutes. Seul le hachage du jeton est stocké.
create table if not exists ika_password_resets (
  token_hash text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ika_password_resets_user_idx on ika_password_resets (user_id, created_at desc);
