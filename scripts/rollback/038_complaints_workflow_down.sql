-- Retour arrière de la migration 038 (038_complaints_workflow.sql). ATTENTION : supprime les commentaires de réclamations (ika_complaint_comments) et la colonne closed_at. Le statut redevient OPEN ou DISMISSED : l'opération ÉCHOUE (et rien n'est modifié) s'il existe des signalements en IN_PROGRESS, RESOLVED ou CLOSED. Les clôturer ou les rouvrir avant.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/038_complaints_workflow_down.sql
begin;
alter table if exists ika_reports drop constraint if exists ika_reports_status_check;
alter table if exists ika_reports add constraint ika_reports_status_check check (status in ('OPEN', 'DISMISSED'));
alter table if exists ika_reports drop column if exists closed_at;
drop table if exists ika_complaint_comments;
delete from _migrations where name = '038_complaints_workflow.sql';
commit;
