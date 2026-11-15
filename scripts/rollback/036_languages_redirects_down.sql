-- Retour arrière de la migration 036 (036_languages_redirects.sql). ATTENTION : supprime les langues et les redirections (ika_languages, ika_redirects).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/036_languages_redirects_down.sql
begin;
drop table if exists ika_redirects;
drop table if exists ika_languages;
delete from _migrations where name = '036_languages_redirects.sql';
commit;
