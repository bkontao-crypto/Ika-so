-- Retour arrière de la migration 026. ATTENTION : supprime présentations, références de photos de profil et clics de contact de profil.
-- Les signalements (ika_user_reports) et les avis ne sont pas touchés. Les fichiers d'images restent dans stored_files (nettoyage manuel).
begin;
drop table if exists ika_profile_contact_events;
drop table if exists ika_advertiser_profiles;
delete from _migrations where name = '026_profil_public.sql';
commit;
