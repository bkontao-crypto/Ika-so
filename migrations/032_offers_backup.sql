-- Extension des offres (prix) et journal de restauration.
alter table ika_offers add column if not exists price_xof integer;
alter table ika_offers add column if not exists active boolean not null default true;

create table if not exists ika_restore_log (
  id text primary key,
  backup_id text,
  note text,
  created_by text references ika_users(id) on delete set null,
  created_at timestamptz not null default now()
);
