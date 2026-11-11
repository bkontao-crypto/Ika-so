delete from ika_analytics_events where event_type in ('premium_cta_clicked', 'premium_checkout_started');
alter table ika_analytics_events drop constraint if exists ika_analytics_events_event_type_check;
alter table ika_analytics_events add constraint ika_analytics_events_event_type_check check (event_type in (
  'page_view', 'listing_view',
  'contact_clicked', 'phone_clicked', 'whatsapp_clicked',
  'contact_request_created', 'visit_requested', 'message_sent',
  'listing_favorite_added', 'listing_favorite_removed', 'comment_created', 'comment_deleted',
  'listing_created', 'listing_updated', 'listing_published', 'listing_archived',
  'user_registered', 'user_login', 'user_logout',
  'verification_completed', 'report_created', 'payment_completed'));
alter table ika_payments drop column if exists origin;
