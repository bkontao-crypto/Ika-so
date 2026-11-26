-- Double authentification : choix de la méthode (application, code par e-mail, code par SMS).
-- Migration additive : la méthode des comptes existants reste « APP » (application d'authentification).
-- Retour arrière : scripts/rollback/095_mfa_methodes_down.sql
alter table ika_mfa_secrets add column if not exists method text not null default 'APP';
alter table ika_mfa_secrets drop constraint if exists ika_mfa_secrets_method_chk;
alter table ika_mfa_secrets add constraint ika_mfa_secrets_method_chk check (method in ('APP', 'EMAIL', 'SMS'));

-- Codes à usage unique envoyés par e-mail ou SMS : seule l'empreinte est conservée ; valables 10 minutes ; un seul usage.
create table if not exists ika_mfa_otps (
  id text primary key,
  user_id text not null references ika_profiles (user_id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ika_mfa_otps_user_idx on ika_mfa_otps (user_id, created_at desc);
