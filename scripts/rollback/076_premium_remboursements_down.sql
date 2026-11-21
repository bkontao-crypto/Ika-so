-- Retour arrière de la migration 076 : supprime le suivi de remboursement Premium (les demandes Premium restent).
begin;
drop table if exists ika_premium_refund_steps;
drop table if exists ika_premium_refunds;
delete from _migrations where name = '076_premium_remboursements.sql';
commit;
