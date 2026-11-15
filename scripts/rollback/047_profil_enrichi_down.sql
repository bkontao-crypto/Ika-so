-- Retour arrière de la migration 047 (047_profil_enrichi.sql). ATTENTION : supprime les abonnements, publications, membres d'équipe et services des profils annonceurs (exporter avant).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/047_profil_enrichi_down.sql
begin;
drop table if exists ika_services;
drop table if exists ika_team_members;
drop table if exists ika_publications;
drop table if exists ika_follows;
delete from _migrations where name = '047_profil_enrichi.sql';
commit;
