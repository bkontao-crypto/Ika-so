-- Demandes pour devenir annonceur (particulier gratuit ou agence).
-- Additive.

create table if not exists ika_advertiser_applications (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  type text not null check (type in ('PARTICULIER', 'AGENCE')),
  status text not null default 'PENDING' check (status in ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  display_role_requested text,
  data jsonb not null default '{}',
  documents jsonb not null default '[]',
  admin_note text,
  reviewed_by text references ika_users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ika_adv_app_user_idx on ika_advertiser_applications (user_id, created_at desc);
create index if not exists ika_adv_app_status_idx on ika_advertiser_applications (status, type);
