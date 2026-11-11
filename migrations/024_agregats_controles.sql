-- Phase 2 (analytique) : agrégats horaires et quotidiens, contrôles de qualité. Additive.
-- method_version permet de recalculer sans mélanger les anciennes méthodes. Retour arrière : scripts/rollback/024_agregats_controles_down.sql
create table if not exists ika_agg_hourly (
  hour_start timestamptz not null,
  metric text not null,
  dim_type text not null default '',
  dim_id text not null default '',
  country_code char(2) not null default '',
  value numeric not null,
  method_version integer not null check (method_version >= 1),
  primary key (hour_start, metric, dim_type, dim_id, country_code)
);
create table if not exists ika_agg_daily (
  day date not null,
  metric text not null,
  dim_type text not null default '',
  dim_id text not null default '',
  country_code char(2) not null default '',
  value numeric not null,
  method_version integer not null check (method_version >= 1),
  primary key (day, metric, dim_type, dim_id, country_code)
);
create index if not exists ika_agg_daily_metric_idx on ika_agg_daily (metric, day desc);
create table if not exists ika_analytics_checks (
  id text primary key,
  checked_at timestamptz not null default now(),
  check_name text not null,
  scope text,
  expected numeric,
  observed numeric,
  ok boolean not null,
  detail text
);
create index if not exists ika_analytics_checks_time_idx on ika_analytics_checks (checked_at desc);
