-- Migration 060 — Délégations Owner Center (DEC-003)
-- Un admin n'accède à un module délégable que s'il lui a été attribué.
-- Les modules « superadmin » ne sont jamais délégables.

create table if not exists ika_owner_delegations (
  user_id text not null references ika_users(id) on delete cascade,
  module text not null,
  granted_by text references ika_users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, module)
);

create index if not exists ika_owner_delegations_user_idx on ika_owner_delegations(user_id);
