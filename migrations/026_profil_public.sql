-- Profil public (photo de couverture, photo de profil, présentation) : additif, aucune table existante modifiée.
-- Les signalements d'un annonceur réutilisent ika_user_reports (thread_id nul), déjà visible de la modération.
-- Retour arrière : scripts/rollback/026_profil_public_down.sql
create table if not exists ika_advertiser_profiles (
  user_id text primary key references ika_users (id) on delete cascade,
  bio text check (bio is null or length(bio) <= 1500),
  founded_year integer check (founded_year is null or founded_year between 1900 and 2100),
  zones text[] not null default '{}',
  address text check (address is null or length(address) <= 200),
  opening_hours text check (opening_hours is null or length(opening_hours) <= 120),
  show_phone boolean not null default false,
  show_whatsapp boolean not null default false,
  cover_url text check (cover_url is null or cover_url ~ '^/api/media/[0-9a-f-]{36}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^/api/media/[0-9a-f-]{36}$'),
  images_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists ika_advertiser_profiles_cover_idx on ika_advertiser_profiles (cover_url) where cover_url is not null;
create index if not exists ika_advertiser_profiles_avatar_idx on ika_advertiser_profiles (avatar_url) where avatar_url is not null;

-- Clics « Appeler » / « WhatsApp » depuis le profil : un clic n'est ni une conversation ni une transaction.
create table if not exists ika_profile_contact_events (
  id text primary key,
  advertiser_id text not null references ika_users (id) on delete cascade,
  user_id text references ika_users (id) on delete set null,
  kind text not null check (kind in ('CALL', 'WHATSAPP')),
  created_at timestamptz not null default now()
);
create index if not exists ika_profile_contact_events_adv_idx on ika_profile_contact_events (advertiser_id, created_at desc);
