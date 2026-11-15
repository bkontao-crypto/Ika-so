-- Retour arrière de la migration 053 (053_profil_ville.sql). ATTENTION : supprime la ville affichée sur les profils (colonne city).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/053_profil_ville_down.sql
begin;
alter table if exists ika_advertiser_profiles drop column if exists city;
delete from _migrations where name = '053_profil_ville.sql';
commit;
