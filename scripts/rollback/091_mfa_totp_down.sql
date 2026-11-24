-- Retour arrière de la migration 091 : supprime les tables MFA (secrets chiffrés et codes de secours). Tables nouvelles uniquement : aucune donnée héritée n'est touchée. Les comptes qui avaient activé la MFA la perdent (sauvegarder d'abord : branche Neon).
begin;
drop table if exists ika_mfa_recovery_codes;
drop table if exists ika_mfa;
delete from _migrations where name = '091_mfa_totp.sql';
commit;
