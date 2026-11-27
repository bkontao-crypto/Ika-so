-- Retour arrière de la migration 096 : retire les marqueurs « centralisé » et le contact personnalisé des annonces
-- (les conversations et demandes restent, elles redeviennent de simples échanges avec le propriétaire enregistré).
begin;
drop index if exists ika_visits_central_idx;
drop index if exists ika_threads_central_idx;
alter table ika_listings drop constraint if exists ika_listings_contact_mode_chk;
alter table ika_listings drop column if exists contact_custom_whatsapp, drop column if exists contact_custom_phone, drop column if exists contact_mode;
alter table ika_visit_requests drop column if exists central;
alter table ika_threads drop column if exists central;
delete from _migrations where name = '096_contacts_centralises.sql';
commit;
