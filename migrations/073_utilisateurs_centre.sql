-- 073 : historique de connexion durable + fin de sanction (centre « Utilisateurs » de l'Owner Center).
-- Additif : aucune donnée existante n'est modifiée, sauf last_login_at rempli depuis les sessions réellement connues.
alter table ika_profiles add column if not exists last_login_at timestamptz;
alter table ika_profiles add column if not exists login_count integer not null default 0;
alter table ika_profiles add column if not exists status_until timestamptz;

create table if not exists ika_login_history (
  id bigserial primary key,
  user_id text not null,
  method text not null default 'PASSWORD',
  created_at timestamptz not null default now()
);
create index if not exists ika_login_history_user_idx on ika_login_history (user_id, created_at desc);
create index if not exists ika_login_history_at_idx on ika_login_history (created_at);

update ika_profiles p set last_login_at = s.last_at
from (select user_id, max(created_at) as last_at from ika_sessions group by user_id) s
where s.user_id = p.user_id and p.last_login_at is null;

create index if not exists ika_profiles_last_login_idx on ika_profiles (last_login_at);
