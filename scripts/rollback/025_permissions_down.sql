-- Retour arrière de la migration 025. ATTENTION : supprime les permissions individuelles accordées (les exporter avant).
-- Les rôles (ika_profiles.staff_role) et le comportement actuel ne sont pas touchés.
begin;
drop table if exists ika_user_permissions;
drop function if exists ika_user_permission_guard();
drop table if exists ika_role_permissions;
drop table if exists ika_permissions;
delete from _migrations where name = '025_permissions.sql';
commit;
