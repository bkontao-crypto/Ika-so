-- Retour arrière de la migration 059 (059_properties.sql). ATTENTION : supprime les biens (ika_properties) et le lien property_id des annonces. Exécuter d'abord les retours arrière de 060 à 064 si possible.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/059_properties_down.sql
begin;
alter table if exists ika_listings drop column if exists property_id;
drop table if exists ika_properties;
delete from _migrations where name = '059_properties.sql';
commit;
