-- Retour arrière de 079. Les comptes en Premium sans limite gardent leur date lointaine : remettre une vraie fin avant si besoin.
begin;
drop table if exists ika_certification_acquise;
alter table ika_profiles drop column if exists premium_unlimited, drop column if exists premium_unlimited_by, drop column if exists premium_unlimited_at, drop column if exists premium_unlimited_reason;
delete from _migrations where name = '079_certification_acquise.sql';
commit;
