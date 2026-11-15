-- Retour arrière de la migration 057 (057_partners.sql). ATTENTION : supprime tous les partenaires de la page « Partenaires » (ika_partners). Les logos importés (stored_files) restent.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/057_partners_down.sql
begin;
drop table if exists ika_partners;
delete from _migrations where name = '057_partners.sql';
commit;
