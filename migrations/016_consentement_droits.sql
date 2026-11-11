-- Consentement aux conditions et exercice des droits (Loi n° 2013-015 : consentement art. 3, accès, suppression).
alter table ika_users add column if not exists terms_version text;
alter table ika_users add column if not exists terms_accepted_at timestamptz;
alter table ika_users add column if not exists deleted_at timestamptz;

-- Journal des demandes de droits. Aucune donnée personnelle : seulement le type, la date et l'issue.
create table if not exists ika_data_requests (
  id text primary key,
  kind text not null check (kind in ('EXPORT', 'DELETE')),
  outcome text not null check (outcome in ('DONE', 'REFUSED')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists ika_data_requests_created_idx on ika_data_requests (created_at desc);

-- La facture garde le nom du client tel qu'il était à l'émission (obligation comptable), même si le compte est anonymisé.
alter table ika_invoices add column if not exists customer_name text;
update ika_invoices i set customer_name = u.name from ika_users u where u.id = i.user_id and i.customer_name is null;
