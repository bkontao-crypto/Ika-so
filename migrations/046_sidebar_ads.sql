-- Publicités latérales (sidebar) pour Accueil et Annonces.
-- Kind 'SIDEBAR' ajouté aux campagnes existantes, avec placement (home, annonces, both).
-- Durée via starts_at / ends_at déjà présents.

alter table ika_campaigns drop constraint if exists ika_campaigns_kind_check;
alter table ika_campaigns add constraint ika_campaigns_kind_check
  check (kind in ('BANNER', 'PROMO', 'SPONSORED', 'NEWS', 'SIDEBAR'));

alter table ika_campaigns add column if not exists placement text not null default 'both'
  check (placement in ('home', 'annonces', 'both'));

create index if not exists ika_campaigns_sidebar_idx on ika_campaigns (kind, status, placement) where kind = 'SIDEBAR';
