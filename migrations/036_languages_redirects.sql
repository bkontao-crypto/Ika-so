-- Langues et redirections.
create table if not exists ika_languages (
  code text primary key,
  label text not null,
  active boolean not null default true
);
insert into ika_languages (code, label) values
  ('fr', 'Français'),
  ('bm', 'Bambara'),
  ('en', 'English')
on conflict do nothing;

create table if not exists ika_redirects (
  id text primary key,
  from_path text not null unique,
  to_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
