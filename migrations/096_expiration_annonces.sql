-- 096 : durée de publication, expiration automatique et archivage automatique des annonces.
-- Migration additive : aucune annonce existante n'est modifiée (starts_at / expires_at restent NULL = pas d'échéance imposée).
-- Retour arrière (manuel, voir docs/EXPIRATIONS_ANNONCES.md) : supprimer les 2 tables, les index et les 4 colonnes ajoutés,
-- puis recréer la contrainte ika_listings_status_check sans 'SCHEDULED' (après avoir remis les annonces SCHEDULED en PENDING).

alter table ika_listings add column if not exists starts_at timestamptz;
alter table ika_listings add column if not exists expired_at timestamptz;
alter table ika_listings add column if not exists archived_at timestamptz;
alter table ika_listings add column if not exists archived_mode text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ika_listings'::regclass and conname = 'ika_listings_archived_mode_check'
  ) then
    alter table ika_listings
      add constraint ika_listings_archived_mode_check check (archived_mode is null or archived_mode in ('MANUAL', 'AUTO'));
  end if;
end $$;

-- Nouveau statut « Programmée » (SCHEDULED) : les filtres existants « status = 'PUBLISHED' » la masquent donc d'office.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'ika_listings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%ARCHIVED%'
  loop
    execute format('alter table ika_listings drop constraint %I', c.conname);
  end loop;
end $$;
alter table ika_listings
  add constraint ika_listings_status_check
  check (status in ('DRAFT', 'PENDING', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'SOLD', 'RENTED', 'ARCHIVED'));

create index if not exists ika_listings_expiry_idx on ika_listings (status, expires_at) where expires_at is not null;
create index if not exists ika_listings_starts_idx on ika_listings (starts_at) where status = 'SCHEDULED';
create index if not exists ika_listings_archive_idx on ika_listings (status, expired_at) where status = 'EXPIRED';

-- Historique des événements d'une annonce (qui, quoi, ancienne et nouvelle valeur). Ne contient aucune donnée sensible.
create table if not exists ika_listing_events (
  id bigserial primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  actor_id text,
  actor_kind text not null default 'SYSTEM' check (actor_kind in ('OWNER', 'STAFF', 'SYSTEM')),
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists ika_listing_events_listing_idx on ika_listing_events (listing_id, created_at desc);
create index if not exists ika_listing_events_action_idx on ika_listing_events (action, created_at desc);

-- Avertissements d'expiration : un seul par annonce, par type et par échéance (idempotence).
create table if not exists ika_expiry_warnings (
  id bigserial primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  owner_id text not null references ika_users (id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  status text not null default 'SENT' check (status in ('SENT', 'FAILED')),
  sent_at timestamptz not null default now(),
  unique (listing_id, kind, due_at)
);
create index if not exists ika_expiry_warnings_owner_idx on ika_expiry_warnings (owner_id, sent_at desc);
