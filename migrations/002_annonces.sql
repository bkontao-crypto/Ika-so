-- Profils, annonces et photos.
create table if not exists ika_profiles (
  user_id text primary key references ika_users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  phone_verified_at timestamptz,
  phone_channel text check (phone_channel in ('SMS', 'DEMO')),
  display_role text not null default 'Propriétaire direct',
  staff_role text not null default 'USER' check (staff_role in ('USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE', 'RESTRICTED', 'BANNED')),
  status_reason text,
  created_at timestamptz not null default now()
);
-- Un compte = un numéro vérifié.
create unique index if not exists ika_profiles_verified_phone_uidx
  on ika_profiles (phone) where phone_verified_at is not null;

create table if not exists ika_listings (
  id text primary key,
  owner_id text not null references ika_users (id) on delete cascade,
  title text not null,
  category text not null check (category in ('Terrain', 'Maison', 'Appartement', 'Studio')),
  transaction_type text not null check (transaction_type in ('Vente', 'Location')),
  price bigint not null check (price > 0),
  neighborhood text not null,
  city text not null default 'Bamako',
  surface_label text not null,
  surface_m2 integer,
  road_access text,
  bedrooms integer,
  bathrooms integer,
  furnished boolean,
  description text not null,
  declared_document text,
  latitude double precision,
  longitude double precision,
  image_url text not null,
  status text not null default 'PENDING'
    check (status in ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'SOLD', 'RENTED', 'ARCHIVED')),
  moderation_note text,
  visibility text not null default 'NORMAL' check (visibility in ('NORMAL', 'HIDDEN')),
  visibility_before_ban text,
  owner_name text not null,
  owner_phone text not null,
  owner_role text not null,
  phone_verified boolean not null default false,
  featured_until timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists ika_listings_status_idx on ika_listings (status, created_at desc);
create index if not exists ika_listings_owner_idx on ika_listings (owner_id, created_at desc);

create table if not exists ika_listing_photos (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  url text not null,
  position integer not null default 0
);
create index if not exists ika_listing_photos_listing_idx on ika_listing_photos (listing_id, position);
