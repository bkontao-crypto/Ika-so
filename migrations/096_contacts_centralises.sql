-- Gestion centralisée des contacts (ordonnance du 27 nov. 2026). Migration ADDITIVE : rien n'est supprimé ni réécrit.
-- Les réglages (interrupteur général, quatre catégories) vivent dans ika_superadmin_settings, clé « contact_central » : absents = tout désactivé.
-- Les fils et demandes existants gardent central = false : leur routage vers le propriétaire ne change pas.
alter table ika_threads add column if not exists central boolean not null default false;
alter table ika_visit_requests add column if not exists central boolean not null default false;
-- Mode de contact et coordonnées personnalisées d'une annonce (mode C). Null = règle par défaut de la catégorie.
alter table ika_listings add column if not exists contact_mode text;
alter table ika_listings add column if not exists contact_custom_phone text;
alter table ika_listings add column if not exists contact_custom_whatsapp text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ika_listings_contact_mode_chk') then
    alter table ika_listings add constraint ika_listings_contact_mode_chk check (contact_mode is null or contact_mode in ('OWNER', 'CENTRAL', 'CUSTOM'));
  end if;
end $$;
create index if not exists ika_threads_central_idx on ika_threads (last_message_at desc) where central;
create index if not exists ika_visits_central_idx on ika_visit_requests (status, proposed_at) where central;
