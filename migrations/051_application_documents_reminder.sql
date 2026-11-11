-- Rappel avant l'échéance de conservation des pièces d'une demande annonceur : un seul rappel par échéance.
-- Additive. Le renouvellement remet la colonne à NULL (nouvelle échéance, nouveau rappel possible).
alter table ika_advertiser_applications add column if not exists documents_expiry_notified_at timestamptz;
