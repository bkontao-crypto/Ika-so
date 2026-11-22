-- 083 : alertes programmées = recherches enregistrées étendues (dates, pause, suspension, historique) + formules de boost préparées (fermées).
alter table ika_saved_searches add column if not exists starts_on date;
alter table ika_saved_searches add column if not exists ends_on date;
alter table ika_saved_searches add column if not exists status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'SUSPENDED'));
alter table ika_saved_searches add column if not exists status_reason text;
alter table ika_saved_searches add column if not exists updated_at timestamptz not null default now();
alter table ika_saved_searches add constraint ika_saved_searches_dates_chk check (starts_on is null or ends_on is null or ends_on >= starts_on) not valid;

-- Historique conservé même après suppression de l'alerte (pas de clé étrangère).
create table if not exists ika_alert_history (
  id text primary key,
  search_id text not null,
  user_id text not null,
  actor_id text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ika_alert_history_search_idx on ika_alert_history (search_id, created_at desc);

-- Formules de boost : configurables par le superadmin, toutes INACTIVES et sans achat possible tant que le paiement n'est pas branché.
create table if not exists ika_boost_plans (
  code text primary key,
  label text not null check (char_length(label) between 2 and 40),
  description text check (description is null or char_length(description) <= 300),
  price_xof integer not null check (price_xof >= 0),
  days integer not null check (days > 0),
  priority integer not null check (priority >= 0),
  active boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into ika_boost_plans (code, label, description, price_xof, days, priority, sort) values
  ('STARTER', 'Starter', 'Priorité de notification de niveau 1.', 500, 7, 1, 1),
  ('SILVER', 'Silver', 'Priorité de notification de niveau 2.', 1000, 15, 2, 2),
  ('GOLD', 'Gold', 'Priorité de notification de niveau 3.', 2000, 30, 3, 3),
  ('VIP', 'VIP', 'Priorité de notification la plus élevée.', 5000, 30, 4, 4)
on conflict (code) do nothing;
