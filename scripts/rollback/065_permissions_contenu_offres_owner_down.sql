-- Retour arrière de la migration 065. ATTENTION : supprime aussi les permissions individuelles accordées pour ces 3 codes (les exporter avant).
-- Le code (server/lib/permissions.js) doit alors être rétabli à la version précédente, sinon les contrôles correspondants refuseront ou accepteront selon le rôle seul.
begin;
delete from ika_permissions where code in ('contenu.gerer', 'offres.tarifs', 'owner.stats'); -- cascade : ika_role_permissions et ika_user_permissions
delete from _migrations where name = '065_permissions_contenu_offres_owner.sql';
commit;
