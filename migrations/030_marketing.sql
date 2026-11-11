-- Campagnes marketing simples (Owner Control).
create table if not exists ika_campaigns (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('BANNER', 'PROMO', 'SPONSORED', 'NEWS')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
  content text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text references ika_users(id) on delete set null,
  created_at timestamptz not null default now()
);
