-- Retour arrière de la migration 035 (035_categories_trends.sql). ATTENTION : supprime la table des catégories actives (ika_categories). Exécuter d'abord le retour arrière de 052.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/035_categories_trends_down.sql
begin;
drop table if exists ika_categories;
delete from _migrations where name = '035_categories_trends.sql';
commit;
