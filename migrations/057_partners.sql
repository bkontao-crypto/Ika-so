-- Partenaires affichés sur la page « Partenaires » : ajoutés, modifiés, masqués ou retirés par un administrateur.
-- Le logo est facultatif : fichier du site (/media/…) ou image importée (/api/media/<uuid>, table stored_files).
create table if not exists ika_partners (
  id text primary key,
  name text not null check (length(name) between 2 and 80),
  category text not null check (length(category) between 2 and 40),
  description text not null default '' check (length(description) <= 300),
  website_url text check (website_url is null or length(website_url) <= 300),
  logo_url text check (logo_url is null or length(logo_url) <= 200),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN')),
  position integer not null default 0,
  created_by text references ika_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ika_partners_public_idx on ika_partners (status, position, created_at);
