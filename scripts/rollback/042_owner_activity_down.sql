-- Retour arrière de 042 : supprime le journal de sécurité et ses index. Les données de connexion enregistrées sont perdues.
drop index if exists ika_favorites_created_idx;
drop index if exists ika_comments_created_idx;
drop index if exists ika_messages_created_idx;
drop index if exists ika_contact_events_created_idx;
drop index if exists ika_payments_created_idx;
drop index if exists ika_profiles_created_idx;
drop index if exists ika_reports_created_idx;
delete from ika_settings where key = 'security_log_enabled';
drop table if exists ika_security_log;
