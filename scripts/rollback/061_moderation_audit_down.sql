-- Retour arrière de la migration 061 (061_moderation_audit.sql). ATTENTION : supprime le journal d'audit de modération (ika_moderation_audit) : trace de contrôle perdue, l'exporter avant.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/061_moderation_audit_down.sql
begin;
drop table if exists ika_moderation_audit;
delete from _migrations where name = '061_moderation_audit.sql';
commit;
