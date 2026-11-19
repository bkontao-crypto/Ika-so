-- Retour arrière de la migration 072 : retire les champs ajoutés aux demandes Premium (type de compte, téléphone, message, acceptation, annulation).
-- Les demandes annulées redeviennent « REJECTED » (la valeur CANCELLED n'existe plus). Les demandes elles-mêmes sont conservées.
begin;
update ika_premium_requests set status = 'REJECTED', decided_note = case when decided_note = '' then 'Annulée par l''annonceur' else decided_note end where status = 'CANCELLED';
alter table ika_premium_requests drop constraint if exists ika_premium_requests_account_type_check;
alter table ika_premium_requests drop constraint if exists ika_premium_requests_status_check;
alter table ika_premium_requests add constraint ika_premium_requests_status_check check (status in ('PENDING', 'APPROVED', 'REJECTED'));
alter table ika_premium_requests drop column if exists cancelled_at;
alter table ika_premium_requests drop column if exists accepted_terms_at;
alter table ika_premium_requests drop column if exists message;
alter table ika_premium_requests drop column if exists phone;
alter table ika_premium_requests drop column if exists account_type;
delete from _migrations where name = '072_demandes_premium_details.sql';
commit;
