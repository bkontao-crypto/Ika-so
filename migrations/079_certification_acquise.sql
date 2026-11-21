-- 079 : droits acquis de certification + Premium sans limite.
-- Quand le superadmin change les critères de certification, les comptes Premium déjà certifiés gardent l'accès jusqu'à la fin de leur Premium
-- (une ligne par compte, `until` = fin du Premium au moment du changement). Un renouvellement après cette date relève de la nouvelle règle.
create table if not exists ika_certification_acquise (
  user_id text primary key,
  until timestamptz not null,
  rule_before text not null,          -- règle en vigueur au moment du changement (texte lisible)
  changed_by text not null,
  created_at timestamptz not null default now()
);
-- Premium sans limite (accordé par le superadmin, tracé) : premium_until est alors fixé à une date lointaine, ce qui garde tous les contrôles existants valides.
alter table ika_profiles add column if not exists premium_unlimited boolean not null default false;
alter table ika_profiles add column if not exists premium_unlimited_by text;
alter table ika_profiles add column if not exists premium_unlimited_at timestamptz;
alter table ika_profiles add column if not exists premium_unlimited_reason text;
