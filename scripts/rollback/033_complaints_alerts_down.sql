-- Retour arrière de la migration 033 (033_complaints_alerts.sql). ATTENTION : supprime les incidents (ika_incidents) et les colonnes assigned_to, resolution, resolved_at des signalements. Exécuter d'abord le retour arrière de 038.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/033_complaints_alerts_down.sql
begin;
drop table if exists ika_incidents;
alter table if exists ika_reports drop column if exists assigned_to;
alter table if exists ika_reports drop column if exists resolution;
alter table if exists ika_reports drop column if exists resolved_at;
delete from _migrations where name = '033_complaints_alerts.sql';
commit;
