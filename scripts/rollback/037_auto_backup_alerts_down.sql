-- Retour arrière de la migration 037 (037_auto_backup_alerts.sql). ATTENTION : supprime la colonne auto de ika_backup_log et de ika_incidents.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/037_auto_backup_alerts_down.sql
begin;
alter table if exists ika_backup_log drop column if exists auto;
alter table if exists ika_incidents drop column if exists auto;
delete from _migrations where name = '037_auto_backup_alerts.sql';
commit;
