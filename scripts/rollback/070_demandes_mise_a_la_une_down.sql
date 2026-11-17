-- Retour arrière de la migration 070 : supprime les demandes de mise à la une (aucune donnée de paiement).
begin;
drop index if exists ika_featured_requests_status;
drop index if exists ika_featured_requests_one_pending;
drop table if exists ika_featured_requests;
delete from _migrations where name = '070_demandes_mise_a_la_une.sql';
commit;
