-- Phase 2 (comptes) : MFA à la connexion. Une session est « vérifiée » quand le code MFA a été saisi (ou quand la MFA vient d'y être activée).
-- Migration additive : une colonne nullable. Les sessions existantes restent valables pour les comptes sans MFA ; la colonne ne compte que pour les comptes qui ont activé la MFA.
-- Retour arrière : scripts/rollback/092_mfa_sessions_down.sql
alter table ika_sessions add column if not exists mfa_verified_at timestamptz;
