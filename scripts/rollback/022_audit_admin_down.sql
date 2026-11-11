-- Retour arrière de la migration 022. ATTENTION : détruit le journal d'audit administrateur (obligation de traçabilité : l'exporter avant).
begin;
drop function if exists ika_admin_audit_purge(timestamptz, text);
drop table if exists ika_admin_audit;
drop function if exists ika_admin_audit_guard();
delete from _migrations where name = '022_audit_admin.sql';
commit;
