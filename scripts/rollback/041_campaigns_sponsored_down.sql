-- Retour arrière de la migration 041 (041_campaigns_sponsored.sql). ATTENTION : supprime le rattachement des campagnes SPONSORED (annonce, visuel, lien, bouton, ordre).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/041_campaigns_sponsored_down.sql
begin;
drop index if exists ika_campaigns_live_idx;
alter table if exists ika_campaigns drop column if exists listing_id;
alter table if exists ika_campaigns drop column if exists image_url;
alter table if exists ika_campaigns drop column if exists link_url;
alter table if exists ika_campaigns drop column if exists cta_label;
alter table if exists ika_campaigns drop column if exists sort_order;
delete from _migrations where name = '041_campaigns_sponsored.sql';
commit;
