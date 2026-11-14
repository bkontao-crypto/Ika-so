-- Annulation manuelle des migrations 059 à 064 (à n'exécuter qu'après sauvegarde, et seulement si ces tables ne contiennent rien à conserver).
begin;
drop table if exists ika_superadmin_settings;
drop index if exists ika_crm_leads_score_idx;
drop table if exists ika_crm_leads;
drop table if exists ika_moderation_audit;
drop table if exists ika_owner_delegations;
alter table ika_listings drop column if exists property_id;
drop table if exists ika_properties;
delete from _migrations where name in ('059_properties.sql','060_owner_delegations.sql','061_moderation_audit.sql','062_crm_leads.sql','063_crm_leads_score.sql','064_superadmin_settings.sql');
commit;
