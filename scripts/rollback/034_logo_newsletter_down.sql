-- Retour arrière de la migration 034 (034_logo_newsletter.sql). ATTENTION : supprime toutes les newsletters (ika_newsletters).
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/034_logo_newsletter_down.sql
begin;
drop table if exists ika_newsletters;
delete from _migrations where name = '034_logo_newsletter.sql';
commit;
