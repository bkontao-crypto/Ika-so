-- Retour arrière de la migration 084 : le fil d'échanges est supprimé (les demandes et leurs notes restent).
begin;
drop table if exists ika_advertiser_app_messages;
delete from _migrations where name = '084_demande_annonceur_messages.sql';
commit;
