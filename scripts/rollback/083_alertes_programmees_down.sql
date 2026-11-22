-- Retour arrière de la migration 083 : les recherches enregistrées redeviennent simples (dates et pauses perdues, recherches conservées).
begin;
drop table if exists ika_boost_plans;
drop table if exists ika_alert_history;
alter table ika_saved_searches drop constraint if exists ika_saved_searches_dates_chk;
alter table ika_saved_searches drop column if exists updated_at, drop column if exists status_reason, drop column if exists status, drop column if exists ends_on, drop column if exists starts_on;
delete from _migrations where name = '083_alertes_programmees.sql';
commit;
