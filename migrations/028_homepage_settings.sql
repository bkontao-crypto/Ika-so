create table if not exists ika_homepage_settings (
  id integer primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text references ika_users(id) on delete set null
);
