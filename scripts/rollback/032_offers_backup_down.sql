-- Retour arrière de la migration 032 (032_offers_backup.sql). ATTENTION : supprime le journal de restauration (ika_restore_log). Les colonnes price_xof et active de ika_offers sont CONSERVÉES : elles existaient déjà depuis la migration 008.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/032_offers_backup_down.sql
begin;
drop table if exists ika_restore_log;
delete from _migrations where name = '032_offers_backup.sql';
commit;
