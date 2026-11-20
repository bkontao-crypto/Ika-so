-- Retour arrière de la migration 073 : retire l'historique de connexion et les champs de fin de sanction (les sanctions en cours deviennent sans date de fin).
begin;
drop table if exists ika_login_history;
drop index if exists ika_profiles_last_login_idx;
alter table ika_profiles drop column if exists status_until;
alter table ika_profiles drop column if exists login_count;
alter table ika_profiles drop column if exists last_login_at;
delete from _migrations where name = '073_utilisateurs_centre.sql';
commit;
