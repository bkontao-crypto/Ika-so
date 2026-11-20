-- Retour arrière de la migration 075 : supprime les étapes et les deux colonnes (les demandes restent, sans leurs étapes).
begin;
drop table if exists ika_premium_request_steps;
alter table ika_premium_requests drop column if exists review_due_at;
alter table ika_premium_requests drop column if exists paid;
delete from _migrations where name = '075_premium_etapes.sql';
commit;
