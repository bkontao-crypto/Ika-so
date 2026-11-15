-- Retour arrière de la migration 031 (031_crm_pipeline.sql). ATTENTION : supprime le pipeline CRM Owner Control (ika_crm_pipeline).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/031_crm_pipeline_down.sql
begin;
drop table if exists ika_crm_pipeline;
delete from _migrations where name = '031_crm_pipeline.sql';
commit;
