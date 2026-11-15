-- Retour arrière de la migration 029 (029_owner_control.sql). ATTENTION : supprime le journal des sauvegardes (ika_backup_log).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/029_owner_control_down.sql
begin;
drop table if exists ika_backup_log;
delete from _migrations where name = '029_owner_control.sql';
commit;
