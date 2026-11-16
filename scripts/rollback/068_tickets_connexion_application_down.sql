-- Retour arrière de la migration 068 (tickets de connexion : aucune donnée utilisateur).
begin;
drop table if exists ika_login_tickets;
delete from _migrations where name = '068_tickets_connexion_application.sql';
commit;
