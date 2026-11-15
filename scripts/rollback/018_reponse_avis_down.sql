-- Retour arrière de la migration 018 (018_reponse_avis.sql). ATTENTION : supprime les réponses des annonceurs aux avis (colonnes reply_body et reply_at).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/018_reponse_avis_down.sql
begin;
alter table if exists ika_reviews drop column if exists reply_body;
alter table if exists ika_reviews drop column if exists reply_at;
delete from _migrations where name = '018_reponse_avis.sql';
commit;
