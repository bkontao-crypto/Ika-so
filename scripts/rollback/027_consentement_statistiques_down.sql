-- Retour arrière de la migration 027. ATTENTION : supprime l'historique des choix de consentement (les exporter avant).
begin;
drop table if exists ika_analytics_consent;
delete from _migrations where name = '027_consentement_statistiques.sql';
commit;
