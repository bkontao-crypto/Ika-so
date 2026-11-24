-- Retour arrière de la migration 089 : supprime les étapes tracées et les colonnes de validité/retrait. Les dossiers REVOKED repassent en REJECTED, les badges accordés perdent leur date de fin (sauvegarder d'abord : branche Neon).
begin;
drop table if exists ika_star_request_steps;
drop index if exists ika_star_requests_valid_idx;
update ika_star_requests set status = 'REJECTED' where status = 'REVOKED';
alter table ika_star_requests drop constraint if exists ika_star_requests_status_check;
alter table ika_star_requests add constraint ika_star_requests_status_check check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
alter table ika_star_requests drop column if exists valid_until, drop column if exists revoked_by, drop column if exists revoked_at, drop column if exists revoked_note, drop column if exists expiry_notified_at, drop column if exists documents_purged_at;
delete from _migrations where name = '089_badge_etoile_etapes.sql';
commit;
