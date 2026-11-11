-- Phase 2 (analytique) : pays et paramètres. Additive : une table nouvelle, des lignes ajoutées à ika_settings.
-- La collecte est désactivée par défaut (analytics_enabled = 'false') ; l'activer exige l'avis juridique (voir docs/RECOMMANDATIONS_METIER.md D-3).
-- Retour arrière : scripts/rollback/021_pays_parametres_down.sql
create table if not exists ika_countries (
  code char(2) primary key check (code = upper(code)),
  name text not null,
  currency text not null,
  timezone text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
insert into ika_countries (code, name, currency, timezone, active)
values ('ML', 'Mali', 'XOF', 'Africa/Bamako', true)
on conflict do nothing;
insert into ika_settings (key, value) values
  ('analytics_enabled', 'false'),
  ('analytics_start_date', ''),
  ('analytics_retention_raw_months', '12'),
  ('analytics_retention_agg_years', '5'),
  ('audit_retention_years', '5')
on conflict do nothing;
