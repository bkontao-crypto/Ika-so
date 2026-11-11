-- Historique de prix d'une annonce : un point à chaque publication par la modération, si le prix a changé
-- depuis le dernier point. Un prix saisi puis modifié avant publication n'apparaît donc jamais.
-- Additive seulement : aucune table existante n'est modifiée.
create table if not exists ika_listing_price_history (
  id text primary key,
  listing_id text not null references ika_listings (id) on delete cascade,
  price bigint not null check (price > 0),
  recorded_at timestamptz not null default now()
);
create index if not exists ika_listing_price_history_listing_idx
  on ika_listing_price_history (listing_id, recorded_at desc);

-- Point de départ des annonces déjà en ligne : leur prix actuel, à la date de publication.
insert into ika_listing_price_history (id, listing_id, price, recorded_at)
select 'pr-' || gen_random_uuid()::text, l.id, l.price, coalesce(l.published_at, l.updated_at, now())
from ika_listings l
where l.status = 'PUBLISHED'
  and not exists (select 1 from ika_listing_price_history h where h.listing_id = l.id);
