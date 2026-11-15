-- Retour arrière de la migration 017 (017_avis_annonceur.sql). ATTENTION : supprime tous les avis sur les annonceurs et leurs signalements (les exporter avant).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/017_avis_annonceur_down.sql
begin;
drop table if exists ika_review_reports;
drop table if exists ika_reviews;
delete from _migrations where name = '017_avis_annonceur.sql';
commit;
