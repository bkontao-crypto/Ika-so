-- 074 : nouveau type d'événement « listing_dwell » (durée de visionnage d'une fiche, en secondes dans metadata). Additive.
alter table ika_analytics_events drop constraint if exists ika_analytics_events_event_type_check;
alter table ika_analytics_events add constraint ika_analytics_events_event_type_check check (event_type in (
  'page_view', 'listing_view',
  'contact_clicked', 'phone_clicked', 'whatsapp_clicked',
  'contact_request_created', 'visit_requested', 'message_sent',
  'listing_favorite_added', 'listing_favorite_removed', 'comment_created', 'comment_deleted',
  'listing_created', 'listing_updated', 'listing_published', 'listing_archived',
  'user_registered', 'user_login', 'user_logout',
  'verification_completed', 'report_created', 'payment_completed',
  'premium_cta_clicked', 'premium_checkout_started',
  'listing_dwell'));
create index if not exists ika_analytics_dwell_idx on ika_analytics_events (listing_id) where event_type = 'listing_dwell';

-- La migration 021 avait posé analytics_enabled = 'false'. Décision du propriétaire (20 novembre 2026) : collecte active par défaut.
-- Le propriétaire peut toujours la couper (réglage ou ANALYTICS_ENABLED=false).
update ika_settings set value = 'true' where key = 'analytics_enabled' and value = 'false';
