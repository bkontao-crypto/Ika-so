-- Migration 091 — MFA par application d'authentification (TOTP), socle.
-- Additive : deux nouvelles tables, aucune donnée existante touchée. Le secret est chiffré (AES-256-GCM) avant stockage.
-- Rien n'est exigé à la connexion tant que le branchement n'est pas livré.

create table if not exists ika_mfa (
  user_id text primary key references ika_users(id) on delete cascade,
  secret_enc text not null,
  enabled_at timestamptz,
  last_step bigint not null default 0,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- Codes de secours à usage unique : seul le hachage est conservé.
create table if not exists ika_mfa_recovery_codes (
  id text primary key,
  user_id text not null references ika_users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ika_mfa_recovery_codes_user_idx on ika_mfa_recovery_codes(user_id);
