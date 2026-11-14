-- Migration additive — Journal d'audit des actions de modération (E09)
-- Append-only, aucun impact sur les tables existantes.

create table if not exists ika_moderation_audit (
  id text primary key default gen_random_uuid()::text,
  actor_id text not null references ika_users(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ika_moderation_audit_target_idx
  on ika_moderation_audit (target_type, target_id, created_at desc);

create index if not exists ika_moderation_audit_actor_idx
  on ika_moderation_audit (actor_id, created_at desc);
