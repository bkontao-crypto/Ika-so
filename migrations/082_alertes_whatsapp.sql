-- 082 : consentement WhatsApp (désactivé par défaut) pour les alertes hors du site.
alter table ika_notify_prefs add column if not exists whatsapp_enabled boolean not null default false;
