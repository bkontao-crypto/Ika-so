-- Retour arrière de 051 : retire la trace du rappel d'échéance (les rappels déjà envoyés restent dans les notifications).
alter table ika_advertiser_applications drop column if exists documents_expiry_notified_at;
delete from _migrations where name = '051_application_documents_reminder.sql'; -- ajouté (BUG-002) : permet de rejouer la migration après le retour arrière
