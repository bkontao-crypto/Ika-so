-- Retour arrière de la migration 030 (030_marketing.sql). ATTENTION : supprime toutes les campagnes marketing (ika_campaigns).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/030_marketing_down.sql
begin;
drop table if exists ika_campaigns;
delete from _migrations where name = '030_marketing.sql';
commit;
