-- Retour arrière de 093_superadmin_emplacements.sql : retire la colonne, l'index, la contrainte et les réglages ajoutés.
-- Tout ou rien (transaction) ; la ligne _migrations est effacée pour que la migration puisse être rejouée.
begin;
alter table ika_profiles drop constraint if exists ika_profiles_superadmin_slot_role_chk;
drop index if exists ika_profiles_superadmin_slot_uidx;
alter table ika_profiles drop column if exists superadmin_slot;
delete from ika_settings where key in ('mfa_required', 'mfa_required_since');
delete from _migrations where name = '093_superadmin_emplacements.sql';
commit;
