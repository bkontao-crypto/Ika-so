-- Retour arrière de 091_mfa.sql : supprime uniquement les trois tables MFA (aucune autre donnée touchée).
drop table if exists ika_mfa_attempts;
drop table if exists ika_mfa_backup_codes;
drop table if exists ika_mfa_secrets;
