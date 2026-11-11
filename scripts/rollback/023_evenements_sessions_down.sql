-- Retour arrière de la migration 023. ATTENTION : supprime tous les événements, sessions de visite et visiteurs collectés.
begin;
drop table if exists ika_listing_viewer_days;
drop table if exists ika_visitor_days;
drop table if exists ika_visit_sessions;
drop table if exists ika_analytics_events;
delete from _migrations where name = '023_evenements_sessions.sql';
commit;
