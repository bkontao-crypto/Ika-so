-- Retour arrière de la migration 082 : le consentement WhatsApp est supprimé (SMS et e-mail inchangés).
begin;
alter table ika_notify_prefs drop column if exists whatsapp_enabled;
delete from _migrations where name = '082_alertes_whatsapp.sql';
commit;
