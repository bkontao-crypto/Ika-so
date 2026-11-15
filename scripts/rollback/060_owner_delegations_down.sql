-- Retour arrière de la migration 060 (060_owner_delegations.sql). ATTENTION : supprime les délégations Owner Center (ika_owner_delegations).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/060_owner_delegations_down.sql
begin;
drop table if exists ika_owner_delegations;
delete from _migrations where name = '060_owner_delegations.sql';
commit;
