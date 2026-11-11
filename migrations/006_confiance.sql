-- Phase 3 : confiance. Un badge n'existe que si une personne de l'équipe a contrôlé une pièce.
create table if not exists ika_proofs (
  id text primary key,
  owner_id text not null references ika_users (id) on delete cascade,
  listing_id text references ika_listings (id) on delete cascade,
  kind text not null check (kind in ('DOCUMENT_FONCIER', 'AGENCE')),
  file_type text not null,
  file_data text not null,                 -- image ou PDF encodé ; jamais renvoyé au public
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REFUSED')),
  reviewer_id text references ika_users (id) on delete set null,
  review_note text,
  agency_name text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists ika_proofs_status_idx on ika_proofs (status, created_at);
create index if not exists ika_proofs_owner_idx on ika_proofs (owner_id, created_at desc);

alter table ika_listings add column if not exists document_verified_at timestamptz;
alter table ika_profiles add column if not exists agency_verified_at timestamptz;
alter table ika_profiles add column if not exists agency_name text;

create table if not exists ika_blacklist (
  id text primary key,
  kind text not null check (kind in ('PHONE', 'EMAIL')),
  value text not null,
  reason text not null,
  created_by text references ika_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create table if not exists ika_alerts (
  id text primary key,
  kind text not null,
  listing_id text references ika_listings (id) on delete cascade,
  comment_id text references ika_comments (id) on delete cascade,
  detail text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_by text references ika_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists ika_alerts_unique_open on ika_alerts (kind, coalesce(listing_id, ''), coalesce(comment_id, '')) where status = 'OPEN';
create index if not exists ika_alerts_open_idx on ika_alerts (status, created_at desc);

create table if not exists ika_comment_reports (
  id text primary key,
  comment_id text not null references ika_comments (id) on delete cascade,
  reporter_id text not null references ika_users (id) on delete cascade,
  reason text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DISMISSED')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
