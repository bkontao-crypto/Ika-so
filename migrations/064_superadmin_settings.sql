-- Migration additive — Réglages Superadmin (E09)
create table if not exists ika_superadmin_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text references ika_users(id)
);
