-- Suivi de conversion du Premium : deux nouveaux types d'événements (liste blanche, voir lib/analytics-events.js) et l'origine du clic gardée sur le paiement.
-- Additive. Retour arrière : scripts/rollback/045_suivi_premium_down.sql
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
-- Emplacement de l'invitation Premium d'où vient l'achat (liste fermée côté serveur, jamais de texte libre).
alter table ika_payments add column if not exists origin text;
