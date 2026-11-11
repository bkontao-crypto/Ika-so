-- Vérification du numéro, journal d'activité, premier administrateur, paramètres.
create table if not exists ika_otp (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  channel text not null check (channel in ('SMS', 'DEMO')),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ika_otp_user_idx on ika_otp (user_id, created_at desc);
create index if not exists ika_otp_phone_idx on ika_otp (phone, created_at desc);

create table if not exists ika_audit (
  id text primary key,
  actor_id text not null,
  action text not null,
  listing_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ika_audit_created_idx on ika_audit (created_at desc);

-- Une seule ligne possible : un seul gagnant pour le rôle de premier administrateur.
create table if not exists ika_bootstrap (
  id integer primary key check (id = 1),
  created_at timestamptz not null default now()
);

create table if not exists ika_settings (
  key text primary key,
  value text not null
);
insert into ika_settings (key, value) values ('featured_max', '6') on conflict do nothing;
