-- Consentement individuel aux statistiques d'usage : facultatif, non précoché (aucune ligne = pas de consentement).
-- Additif. Sert au rattachement des actions d'un compte (voir services/analytics.js). Retour arrière : scripts/rollback/027_consentement_statistiques_down.sql
create table if not exists ika_analytics_consent (
  user_id text primary key references ika_users (id) on delete cascade,
  accepted boolean not null,
  text_version text not null check (length(text_version) between 1 and 80),
  decided_at timestamptz not null default now()
);
