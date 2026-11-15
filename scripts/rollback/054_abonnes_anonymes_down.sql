-- Retour arrière de la migration 054 (054_abonnes_anonymes.sql). ATTENTION : supprime le choix d'abonnement anonyme (colonnes anonymous et follow_anonymous_default).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/054_abonnes_anonymes_down.sql
begin;
alter table if exists ika_follows drop column if exists anonymous;
alter table if exists ika_users drop column if exists follow_anonymous_default;
delete from _migrations where name = '054_abonnes_anonymes.sql';
commit;
