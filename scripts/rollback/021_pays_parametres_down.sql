-- Retour arrière de la migration 021. Supprime la table des pays et les réglages analytiques.
begin;
delete from ika_settings where key in ('analytics_enabled', 'analytics_start_date', 'analytics_retention_raw_months', 'analytics_retention_agg_years', 'audit_retention_years');
drop table if exists ika_countries;
delete from _migrations where name = '021_pays_parametres.sql';
commit;
