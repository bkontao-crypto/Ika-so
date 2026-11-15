-- Retour arrière de la migration 063 (063_crm_leads_score.sql). ATTENTION : supprime le score des prospects CRM (colonne score).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/063_crm_leads_score_down.sql
begin;
drop index if exists ika_crm_leads_score_idx;
alter table if exists ika_crm_leads drop column if exists score;
delete from _migrations where name = '063_crm_leads_score.sql';
commit;
