-- Phase 2 (analytique) : événements, sessions de visite, visiteurs uniques. Additive ; aucune clé étrangère vers les comptes.
-- La liste des types d'événements est une liste blanche : en ajouter un exige une nouvelle migration (voulu).
-- ika_sessions (authentification) n'est pas modifiée. Retour arrière : scripts/rollback/023_evenements_sessions_down.sql
create table if not exists ika_analytics_events (
  id bigserial primary key,
  event_id text not null unique,
  event_type text not null check (event_type in (
    'page_view', 'listing_view',
    'contact_clicked', 'phone_clicked', 'whatsapp_clicked',
    'contact_request_created', 'visit_requested', 'message_sent',
    'listing_favorite_added', 'listing_favorite_removed', 'comment_created', 'comment_deleted',
    'listing_created', 'listing_updated', 'listing_published', 'listing_archived',
    'user_registered', 'user_login', 'user_logout',
    'verification_completed', 'report_created', 'payment_completed')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  user_id text,
  visitor_id text,
  session_id text,
  country_code char(2),
  listing_id text,
  advertiser_id text,
  agency_id text,
  page_path text,
  source text,
  device_type text check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')),
  is_bot boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048)
);
create index if not exists ika_analytics_events_time_idx on ika_analytics_events (occurred_at);
create index if not exists ika_analytics_events_type_idx on ika_analytics_events (event_type, occurred_at);
create index if not exists ika_analytics_events_listing_idx on ika_analytics_events (listing_id, occurred_at) where listing_id is not null;
create index if not exists ika_analytics_events_visitor_idx on ika_analytics_events (visitor_id, occurred_at) where visitor_id is not null;

create table if not exists ika_visit_sessions (
  session_id text primary key,
  visitor_id text,
  user_id text,
  started_at timestamptz not null,
  last_seen_at timestamptz not null check (last_seen_at >= started_at),
  device_type text,
  browser_family text,
  country_code char(2),
  entry_path text,
  source text,
  page_views integer not null default 0 check (page_views >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  is_bot boolean not null default false
);
create index if not exists ika_visit_sessions_seen_idx on ika_visit_sessions (last_seen_at desc);
create index if not exists ika_visit_sessions_start_idx on ika_visit_sessions (started_at);
create index if not exists ika_visit_sessions_user_idx on ika_visit_sessions (user_id, started_at desc) where user_id is not null;

create table if not exists ika_visitor_days (
  day date not null,
  visitor_id text not null,
  country_code char(2),
  primary key (day, visitor_id)
);
create table if not exists ika_listing_viewer_days (
  day date not null,
  listing_id text not null,
  visitor_id text not null,
  primary key (day, listing_id, visitor_id)
);
