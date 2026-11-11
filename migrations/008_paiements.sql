-- Phase 5 : paiements. Aucun tarif n'est choisi ici : les offres démarrent inactives, à prix 0 (décision du propriétaire).
create table if not exists ika_offers (
  code text primary key,
  label text not null,
  days int not null check (days > 0),
  price_xof int not null default 0 check (price_xof >= 0),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into ika_offers (code, label, days) values
  ('BOOST_7', 'Mise à la une, 7 jours', 7),
  ('BOOST_30', 'Mise à la une, 30 jours', 30)
on conflict do nothing;

create table if not exists ika_payments (
  id text primary key,
  user_id text not null references ika_users (id),
  listing_id text not null references ika_listings (id),
  offer_code text not null references ika_offers (code),
  days int not null,
  amount_xof int not null check (amount_xof > 0),
  status text not null default 'PENDING', -- PENDING, PAID, FAILED, MISMATCH, REFUNDED
  provider text not null,
  provider_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  applied_at timestamptz
);
create unique index if not exists ika_payments_ref_idx on ika_payments (provider, provider_ref) where provider_ref is not null;
create index if not exists ika_payments_user_idx on ika_payments (user_id, created_at desc);
create index if not exists ika_payments_status_idx on ika_payments (status, created_at);

-- Un même événement du fournisseur n'est traité qu'une fois.
create table if not exists ika_payment_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create sequence if not exists ika_invoice_seq;
create table if not exists ika_invoices (
  number text primary key,
  payment_id text not null unique references ika_payments (id),
  user_id text not null references ika_users (id),
  label text not null,
  amount_xof int not null,
  issued_at timestamptz not null default now()
);
