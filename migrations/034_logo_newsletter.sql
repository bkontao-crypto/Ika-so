-- Logo et newsletters.
create table if not exists ika_newsletters (
  id text primary key,
  subject text not null,
  content text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT')),
  sent_at timestamptz,
  created_by text references ika_users(id) on delete set null,
  created_at timestamptz not null default now()
);
