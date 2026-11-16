-- Retour arrière de la migration 067. Vérifiez avant : select count(*) from ika_users where has_password = false;
-- (ces comptes n'ont que Google : les réactiver avant de retirer la colonne.)
begin;
alter table ika_users drop column if exists has_password;
delete from _migrations where name = '067_methodes_de_connexion.sql';
commit;
