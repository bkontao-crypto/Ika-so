-- Retour arrière de 091_mfa.sql : supprime uniquement les trois tables MFA (aucune autre donnée touchée).
-- Tout ou rien (transaction) ; la ligne _migrations est effacée pour que la migration puisse être rejouée.
begin;
drop table if exists ika_mfa_attempts;
drop table if exists ika_mfa_backup_codes;
drop table if exists ika_mfa_secrets;
delete from _migrations where name = '091_mfa.sql';
commit;
