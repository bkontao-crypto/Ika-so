-- 086 : messages reçus par les blocs « Formulaire » de l'accueil (blocs libres créés par le superadmin).
create table if not exists ika_home_form_messages (
  id text primary key,
  block_id text not null,
  block_title text not null default '',
  name text not null,
  contact text not null,
  message text not null,
  status text not null default 'NEW' check (status in ('NEW', 'HANDLED')),
  handled_by text references ika_users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ika_home_form_messages_status_idx on ika_home_form_messages (status, created_at desc);
