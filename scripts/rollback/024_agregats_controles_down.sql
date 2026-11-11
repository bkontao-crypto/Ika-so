-- Retour arrière de la migration 024. ATTENTION : supprime les agrégats et les contrôles. Sauvegarde avant (scripts/backup.sh).
begin;
drop table if exists ika_analytics_checks;
drop table if exists ika_agg_daily;
drop table if exists ika_agg_hourly;
delete from _migrations where name = '024_agregats_controles.sql';
commit;
