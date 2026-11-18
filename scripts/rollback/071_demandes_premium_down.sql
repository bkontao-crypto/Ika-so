-- Retour arrière de la migration 071 : supprime les demandes Premium à la main (les jours Premium déjà accordés restent sur les profils et dans ika_premium_grants).
begin;
drop index if exists ika_premium_requests_status;
drop index if exists ika_premium_requests_one_pending;
drop table if exists ika_premium_requests;
delete from _migrations where name = '071_demandes_premium.sql';
commit;
