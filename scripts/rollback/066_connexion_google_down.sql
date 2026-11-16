-- Retour arrière de la migration 066. Les comptes créés par Google gardent leur ligne, mais ne pourront plus se connecter par Google.
-- Vérifiez avant : select count(*) from ika_users where google_sub is not null;
begin;
drop index if exists ika_users_google_sub_uidx;
alter table ika_users drop column if exists google_sub;
delete from _migrations where name = '066_connexion_google.sql';
commit;
