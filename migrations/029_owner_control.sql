-- Journal simple des sauvegardes (Owner Control).
create table if not exists ika_backup_log (
  id text primary key,
  kind text not null check (kind in ('MANUAL', 'AUTO')),
  note text,
  created_by text references ika_users(id) on delete set null,
  created_at timestamptz not null default now()
);
