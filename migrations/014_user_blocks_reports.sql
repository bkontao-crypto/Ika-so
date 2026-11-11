-- Messagerie : blocage et signalement d'une personne.
-- Additive seulement : aucune table existante n'est modifiée.
create table if not exists ika_user_blocks (
  blocker_id text not null references ika_users (id) on delete cascade,
  blocked_id text not null references ika_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint ika_user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists ika_user_blocks_blocked_idx on ika_user_blocks (blocked_id);

-- Signalement d'une personne depuis une conversation. La modération ne lit pas la conversation entière :
-- elle ne voit que l'extrait transmis au moment du signalement (les derniers messages).
create table if not exists ika_user_reports (
  id text primary key,
  reporter_id text not null references ika_users (id) on delete cascade,
  reported_id text not null references ika_users (id) on delete cascade,
  thread_id text references ika_threads (id) on delete set null,
  reason text not null,
  details text,
  excerpt jsonb not null default '[]'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN', 'DISMISSED')),
  created_at timestamptz not null default now(),
  constraint ika_user_reports_not_self check (reporter_id <> reported_id)
);
-- Un seul signalement ouvert par personne signalante et par personne signalée.
create unique index if not exists ika_user_reports_open_uidx on ika_user_reports (reporter_id, reported_id) where status = 'OPEN';
create index if not exists ika_user_reports_open_idx on ika_user_reports (status, created_at desc);
