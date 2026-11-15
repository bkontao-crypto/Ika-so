-- Retour arrière de la migration 049 (049_advertiser_applications.sql). ATTENTION : supprime toutes les demandes pour devenir annonceur et leurs pièces (ika_advertiser_applications).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/049_advertiser_applications_down.sql
begin;
drop table if exists ika_advertiser_applications;
delete from _migrations where name = '049_advertiser_applications.sql';
commit;
