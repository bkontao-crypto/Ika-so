-- Extension des réclamations (affectation, résolution) et alertes d'incident.
alter table ika_reports add column if not exists assigned_to text references ika_users(id) on delete set null;
alter table ika_reports add column if not exists resolution text;
alter table ika_reports add column if not exists resolved_at timestamptz;

create table if not exists ika_incidents (
  id text primary key,
  kind text not null check (kind in ('DB', 'PAYMENT', 'STORAGE', 'ERROR', 'OTHER')),
  severity text not null default 'WARNING' check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
