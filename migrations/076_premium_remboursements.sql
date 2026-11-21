-- 076 : suivi de remboursement d'un dossier Premium refusé APRÈS paiement (le Premium payé reste actif ; aucun remboursement automatique).
-- 3 étapes tracées à la personne : 1 paiement vérifié, 2 remboursement effectué chez le fournisseur, 3 utilisateur informé.
create table if not exists ika_premium_refunds (
  id text primary key,
  request_id text not null unique references ika_premium_requests (id) on delete cascade,
  user_id text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists ika_premium_refund_steps (
  refund_id text not null references ika_premium_refunds (id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  done_by text not null,
  done_at timestamptz not null default now(),
  note text not null default '',
  primary key (refund_id, step)
);
