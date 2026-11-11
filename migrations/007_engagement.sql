-- Phase 4 : engagement. Alertes, messagerie interne, demandes de visite.
create table if not exists ika_saved_searches (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  label text not null,
  filters jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_saved_searches_user_idx on ika_saved_searches (user_id, created_at desc);

create table if not exists ika_notifications (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ika_notifications_user_idx on ika_notifications (user_id, created_at desc);
-- Une seule alerte « nouvelle annonce » par personne et par annonce, même si plusieurs recherches correspondent.
create unique index if not exists ika_notifications_match_uidx on ika_notifications (user_id, link) where kind = 'SEARCH_MATCH';

create table if not exists ika_threads (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  owner_id text not null references ika_users (id) on delete cascade,
  visitor_id text not null references ika_users (id) on delete cascade,
  owner_read_at timestamptz,
  visitor_read_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, visitor_id)
);
create index if not exists ika_threads_owner_idx on ika_threads (owner_id, last_message_at desc);
create index if not exists ika_threads_visitor_idx on ika_threads (visitor_id, last_message_at desc);

create table if not exists ika_messages (
  id text primary key,
  thread_id text not null references ika_threads (id) on delete cascade,
  sender_id text not null references ika_users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_messages_thread_idx on ika_messages (thread_id, created_at);

create table if not exists ika_visit_requests (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  requester_id text not null references ika_users (id) on delete cascade,
  owner_id text not null references ika_users (id) on delete cascade,
  proposed_at timestamptz not null,
  note text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  answer_note text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists ika_visits_owner_idx on ika_visit_requests (owner_id, status, proposed_at);
create index if not exists ika_visits_requester_idx on ika_visit_requests (requester_id, created_at desc);
