-- Avis sur un annonceur : une note de 1 à 5 et un commentaire, un seul avis par personne et par annonceur.
-- Additive seulement. Un avis n'est possible qu'après un vrai échange (message ou contact), contrôlé par le service.
create table if not exists ika_reviews (
  id text primary key,
  advertiser_id text not null references ika_users (id) on delete cascade,
  reviewer_id text not null references ika_users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'VISIBLE' check (status in ('VISIBLE', 'HIDDEN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advertiser_id, reviewer_id),
  constraint ika_reviews_not_self check (advertiser_id <> reviewer_id)
);
create index if not exists ika_reviews_advertiser_idx on ika_reviews (advertiser_id, status, rating desc, created_at desc);

create table if not exists ika_review_reports (
  id text primary key,
  review_id text not null references ika_reviews (id) on delete cascade,
  reporter_id text not null references ika_users (id) on delete cascade,
  reason text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DISMISSED')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);
create index if not exists ika_review_reports_open_idx on ika_review_reports (status, created_at desc);
