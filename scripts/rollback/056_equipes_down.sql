-- Retour arrière de la migration 056 (056_equipes.sql). ATTENTION : supprime les liens d'équipe entre comptes (ika_team_links).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/056_equipes_down.sql
begin;
drop table if exists ika_team_links;
delete from _migrations where name = '056_equipes.sql';
commit;
