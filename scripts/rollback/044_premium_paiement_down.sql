-- Retour arrière de 044. Les paiements Premium déjà enregistrés sont supprimés (les jours Premium déjà donnés restent sur les profils).
drop index if exists ika_premium_grants_payment_idx;
alter table ika_premium_grants drop column if exists payment_id;
delete from ika_invoices where payment_id in (select id from ika_payments where kind = 'PREMIUM');
delete from ika_payments where kind = 'PREMIUM';
alter table ika_payments drop constraint if exists ika_payments_kind_check;
alter table ika_payments drop column if exists kind;
alter table ika_payments alter column listing_id set not null;
delete from ika_offers where kind = 'PREMIUM';
alter table ika_offers drop constraint if exists ika_offers_kind_check;
alter table ika_offers drop column if exists kind;
