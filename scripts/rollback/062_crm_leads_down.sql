-- Retour arrière de la migration 062 (062_crm_leads.sql). ATTENTION : supprime les prospects CRM des annonceurs (ika_crm_leads). Exécuter d'abord le retour arrière de 063.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/062_crm_leads_down.sql
begin;
drop table if exists ika_crm_leads;
delete from _migrations where name = '062_crm_leads.sql';
commit;
