-- 084 : fil d'échanges d'une demande annonceur (demande d'informations de l'équipe, réponse du candidat), conservé avec la demande.
create table if not exists ika_advertiser_app_messages (
  id text primary key,
  application_id text not null references ika_advertiser_applications (id) on delete cascade,
  author_id text,
  side text not null check (side in ('STAFF', 'USER')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists ika_adv_app_msg_idx on ika_advertiser_app_messages (application_id, created_at);
-- Les demandes d'informations déjà envoyées (message conservé dans admin_note) rejoignent le fil.
insert into ika_advertiser_app_messages (id, application_id, author_id, side, body, created_at)
select 'am_' || id, id, reviewed_by, 'STAFF', left(admin_note, 1000), coalesce(reviewed_at, updated_at)
from ika_advertiser_applications where status = 'ADDITIONAL_INFO_REQUIRED' and admin_note is not null and admin_note <> ''
on conflict (id) do nothing;
