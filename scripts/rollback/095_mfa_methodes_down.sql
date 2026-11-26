-- Retour arrière de 095. Les comptes dont la méthode est EMAIL ou SMS n'auraient plus de secret TOTP exploitable :
-- ils sont désactivés (ils devront réactiver la MFA par application). Les comptes « APP » ne sont pas touchés.
begin;
delete from ika_mfa_backup_codes where user_id in (select user_id from ika_mfa_secrets where method <> 'APP');
delete from ika_mfa_secrets where method <> 'APP';
drop table if exists ika_mfa_otps;
alter table ika_mfa_secrets drop constraint if exists ika_mfa_secrets_method_chk;
alter table ika_mfa_secrets drop column if exists method;
delete from _migrations where name = '095_mfa_methodes.sql';
commit;
