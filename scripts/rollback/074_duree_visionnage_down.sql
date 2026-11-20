-- Retour arrière de la migration 074 : supprime les mesures de durée de visionnage et rétablit la liste des types de la migration 045.
begin;
delete from ika_analytics_events where event_type = 'listing_dwell';
drop index if exists ika_analytics_dwell_idx;
alter table ika_analytics_events drop constraint if exists ika_analytics_events_event_type_check;
alter table ika_analytics_events add constraint ika_analytics_events_event_type_check check (event_type in (
  'page_view', 'listing_view',
  'contact_clicked', 'phone_clicked', 'whatsapp_clicked',
  'contact_request_created', 'visit_requested', 'message_sent',
  'listing_favorite_added', 'listing_favorite_removed', 'comment_created', 'comment_deleted',
  'listing_created', 'listing_updated', 'listing_published', 'listing_archived',
  'user_registered', 'user_login', 'user_logout',
  'verification_completed', 'report_created', 'payment_completed',
  'premium_cta_clicked', 'premium_checkout_started'));
update ika_settings set value = 'false' where key = 'analytics_enabled';
delete from _migrations where name = '074_duree_visionnage.sql';
commit;
