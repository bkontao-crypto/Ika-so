-- Demandes Premium envoyées par les annonceurs quand le paiement en ligne n'est pas ouvert.
-- L'équipe (administrateur délégué « Paiements » ou superadmin) approuve pour 1, 2 ou 3 mois au plus, ou refuse.
create table if not exists ika_premium_requests (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  months integer not null check (months between 1 and 3),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  granted_months integer check (granted_months between 1 and 3),
  decided_by text,
  decided_at timestamptz,
  decided_note text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists ika_premium_requests_one_pending on ika_premium_requests (user_id) where status = 'PENDING';
create index if not exists ika_premium_requests_status on ika_premium_requests (status, created_at);
