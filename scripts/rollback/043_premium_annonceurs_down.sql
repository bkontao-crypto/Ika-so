-- Retour arrière de 043 : supprime l'historique des octrois Premium et la date d'expiration (les abonnements en cours sont perdus).
drop index if exists ika_messages_sender_idx;
drop table if exists ika_premium_grants;
drop index if exists ika_profiles_premium_idx;
alter table ika_profiles drop column if exists premium_until;
