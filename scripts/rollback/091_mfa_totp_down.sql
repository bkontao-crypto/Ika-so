-- Retour arrière de la migration 091 (tables nouvelles uniquement : aucune donnée héritée n'est supprimée).
drop table if exists ika_mfa_recovery_codes;
drop table if exists ika_mfa;
