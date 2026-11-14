-- Migration additive — CRM leads professionnels (E07)
create table if not exists ika_crm_leads (
  id text primary key default gen_random_uuid()::text,
  advertiser_id text not null references ika_users(id),
  listing_id text references ika_listings(id),
  contact_name text,
  contact_phone text,
  contact_email text,
  source text,
  status text not null default 'NEW',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ika_crm_leads_advertiser_idx
  on ika_crm_leads (advertiser_id, status, updated_at desc);

create index if not exists ika_crm_leads_listing_idx
  on ika_crm_leads (listing_id);
