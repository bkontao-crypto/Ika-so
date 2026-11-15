-- Retour arrière de la migration 064 (064_superadmin_settings.sql). ATTENTION : supprime les réglages Superadmin (ika_superadmin_settings).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/064_superadmin_settings_down.sql
begin;
drop table if exists ika_superadmin_settings;
delete from _migrations where name = '064_superadmin_settings.sql';
commit;
