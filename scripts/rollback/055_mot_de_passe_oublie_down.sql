-- Retour arrière de la migration 055 (055_mot_de_passe_oublie.sql). ATTENTION : supprime les jetons de réinitialisation de mot de passe en cours (ika_password_resets). Les liens déjà envoyés cesseront de fonctionner.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/055_mot_de_passe_oublie_down.sql
begin;
drop table if exists ika_password_resets;
delete from _migrations where name = '055_mot_de_passe_oublie.sql';
commit;
