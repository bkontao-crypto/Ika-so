-- Favoris, commentaires, signalements, contacts mesurés. Aucune adresse IP n'est stockée.
create table if not exists ika_favorites (
  user_id text not null references ika_users (id) on delete cascade,
  listing_id text not null references ika_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists ika_comments (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  user_id text not null references ika_users (id) on delete cascade,
  author_name text not null,
  body text not null,
  status text not null default 'VISIBLE' check (status in ('VISIBLE', 'HIDDEN')),
  created_at timestamptz not null default now()
);
create index if not exists ika_comments_listing_idx on ika_comments (listing_id, created_at desc);

create table if not exists ika_reports (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  reporter_id text references ika_users (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'OPEN' check (status in ('OPEN', 'DISMISSED')),
  created_at timestamptz not null default now()
);
create index if not exists ika_reports_open_idx on ika_reports (status, created_at desc);

create table if not exists ika_contact_events (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  user_id text references ika_users (id) on delete set null,
  kind text not null check (kind in ('CALL', 'WHATSAPP')),
  created_at timestamptz not null default now()
);
create index if not exists ika_contact_events_listing_idx on ika_contact_events (listing_id, created_at desc);
