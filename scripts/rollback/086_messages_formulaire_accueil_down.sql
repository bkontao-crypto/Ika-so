-- Retour arrière de la migration 086 : supprime la table des messages reçus par les formulaires de l'accueil (données personnelles incluses).
begin;
drop table if exists ika_home_form_messages;
delete from _migrations where name = '086_messages_formulaire_accueil.sql';
commit;
