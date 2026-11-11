-- Équipes entre comptes : un compte invite un autre compte ; une fois accepté, les deux profils s'affichent mutuellement comme membres d'équipe.
create table if not exists ika_team_links (
  id text primary key,
  requester_id text not null references ika_users (id) on delete cascade,
  target_id text not null references ika_users (id) on delete cascade,
  role text check (role is null or length(role) <= 80),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'REMOVED')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> target_id)
);
-- Une seule relation active (en attente ou acceptée) par paire de comptes, quel que soit le sens.
create unique index if not exists ika_team_links_pair_uidx
  on ika_team_links (least(requester_id, target_id), greatest(requester_id, target_id)) where status in ('PENDING', 'ACCEPTED');
create index if not exists ika_team_links_target_idx on ika_team_links (target_id, status);
create index if not exists ika_team_links_requester_idx on ika_team_links (requester_id, status);
