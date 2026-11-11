-- Retour arrière de 051 : retire la trace du rappel d'échéance (les rappels déjà envoyés restent dans les notifications).
alter table ika_advertiser_applications drop column if exists documents_expiry_notified_at;
