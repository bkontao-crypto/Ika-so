-- Phase 2 (comptes) : double authentification (MFA) par appli d'authentification (TOTP) et codes de secours.
-- Migration additive : aucune table existante n'est modifiée. Rien n'est exigé ni activé ici (l'obligation viendra par réglage, à l'étape d'activation).
-- Le secret TOTP est conservé chiffré (AES-256-GCM, clé en variable d'environnement), jamais en clair.
-- Retour arrière : scripts/rollback/091_mfa_down.sql
create table if not exists ika_mfa_secrets (
  user_id text primary key references ika_profiles (user_id) on delete cascade,
  secret_enc text not null,
  confirmed_at timestamptz,            -- nul tant que l'utilisateur n'a pas saisi un premier code valide
  last_step bigint,                    -- dernier pas TOTP accepté : un code ne sert qu'une fois
  created_at timestamptz not null default now()
);

create table if not exists ika_mfa_backup_codes (
  id text primary key,
  user_id text not null references ika_profiles (user_id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
create index if not exists ika_mfa_backup_codes_unused_idx on ika_mfa_backup_codes (user_id) where used_at is null;

-- Tentatives de vérification (limitation en base : elle survit au redémarrage et à plusieurs instances).
create table if not exists ika_mfa_attempts (
  id bigserial primary key,
  user_id text not null references ika_profiles (user_id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_mfa_attempts_user_idx on ika_mfa_attempts (user_id, created_at desc);
