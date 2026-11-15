-- Retour arrière de la migration 048 (048_response_rate_index.sql). Supprime seulement un index (aucune donnée perdue ; le calcul du taux de réponse redevient plus lent).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/048_response_rate_index_down.sql
begin;
drop index if exists ika_messages_thread_sender_idx;
delete from _migrations where name = '048_response_rate_index.sql';
commit;
