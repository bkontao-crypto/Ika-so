-- Campagnes SPONSORED : rattachement à une annonce ou visuel + lien propres, bouton d'appel, ordre d'affichage.
alter table ika_campaigns add column if not exists listing_id text references ika_listings (id) on delete set null;
alter table ika_campaigns add column if not exists image_url text;
alter table ika_campaigns add column if not exists link_url text;
alter table ika_campaigns add column if not exists cta_label text;
alter table ika_campaigns add column if not exists sort_order int not null default 0;
create index if not exists ika_campaigns_live_idx on ika_campaigns (kind, status, sort_order);
