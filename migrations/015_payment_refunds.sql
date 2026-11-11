-- Remboursements : trace complète et rapprochement avec le fournisseur.
-- Additive seulement : colonnes ajoutées, aucune existante modifiée. Le statut EXPIRED (paiement resté en attente)
-- n'exige aucun changement : la colonne status est un texte libre.
alter table ika_payments add column if not exists refunded_at timestamptz;
alter table ika_payments add column if not exists refund_reason text;
alter table ika_payments add column if not exists refunded_by text;            -- identifiant de l'administrateur, ou « provider »
alter table ika_payments add column if not exists refund_ref text;             -- référence du remboursement chez le fournisseur
alter table ika_payments add column if not exists refund_confirmed_at timestamptz; -- confirmé par le fournisseur (webhook)

-- Remboursements notés mais pas encore confirmés par le fournisseur : la liste que l'administrateur doit rapprocher.
create index if not exists ika_payments_refund_open_idx on ika_payments (refunded_at)
  where status = 'REFUNDED' and refund_confirmed_at is null;
-- Paiements restés en attente : balayés par l'expiration.
create index if not exists ika_payments_pending_idx on ika_payments (created_at) where status = 'PENDING';
