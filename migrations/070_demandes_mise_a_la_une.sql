-- Demandes de mise à la une envoyées par les annonceurs à l'équipe (gratuites, aucun paiement ici).
-- La mise à la une elle-même reste décidée par l'équipe (contenu.gerer) ; aucun tarif n'est fixé ici.
create table if not exists ika_featured_requests (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  requester_id text not null references ika_users (id) on delete cascade,
  message text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  handled_by text,
  handled_at timestamptz,
  handled_note text not null default '',
  created_at timestamptz not null default now()
);
-- Une seule demande en attente par annonce.
create unique index if not exists ika_featured_requests_one_pending on ika_featured_requests (listing_id) where status = 'PENDING';
create index if not exists ika_featured_requests_status on ika_featured_requests (status, created_at);
