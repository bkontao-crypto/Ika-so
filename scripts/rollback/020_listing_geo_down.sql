-- Retour arrière de la migration 020. ATTENTION : supprime toutes les positions et parcelles enregistrées.
-- Faites une sauvegarde avant (scripts/backup.sh). À lancer avec psql, dans une transaction.
begin;
drop table if exists ika_listing_geo;
delete from _migrations where name = '020_listing_geo.sql';
commit;
