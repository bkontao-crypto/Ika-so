-- Retour arrière de la migration 019 (019_fournisseurs.sql). ATTENTION : supprime les préférences d'alertes ET les preuves de consentement (consent_at), ainsi que l'adresse de reprise des paiements en attente. Exporter ika_notify_prefs avant.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/019_fournisseurs_down.sql
begin;
drop table if exists ika_notify_prefs;
alter table if exists ika_payments drop column if exists checkout_url;
delete from _migrations where name = '019_fournisseurs.sql';
commit;
