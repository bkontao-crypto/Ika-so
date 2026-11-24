-- 089 : badge Étoile, lot 2 — étude en 3 étapes (1 étude, 2 vérification, 3 confirmation), décision finale, validité, retrait, effacement des pièces.
-- Migration additive : le seul changement d'une table existante est l'ajout du statut REVOKED (badge retiré) à la contrainte de ika_star_requests (créée en 088).
create table if not exists ika_star_request_steps (
  request_id text not null references ika_star_requests (id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  done_by text not null,
  done_at timestamptz not null default now(),
  note text not null default '',
  primary key (request_id, step)
);
alter table ika_star_requests drop constraint if exists ika_star_requests_status_check;
alter table ika_star_requests add constraint ika_star_requests_status_check check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'));
-- valid_until : fin de validité du badge accordé. expiry_notified_at : rappel d'expiration déjà envoyé. documents_purged_at : pièces effacées (durée de conservation écoulée).
alter table ika_star_requests add column if not exists valid_until timestamptz;
alter table ika_star_requests add column if not exists revoked_by text;
alter table ika_star_requests add column if not exists revoked_at timestamptz;
alter table ika_star_requests add column if not exists revoked_note text not null default '';
alter table ika_star_requests add column if not exists expiry_notified_at timestamptz;
alter table ika_star_requests add column if not exists documents_purged_at timestamptz;
create index if not exists ika_star_requests_valid_idx on ika_star_requests (user_id, valid_until) where status = 'APPROVED';
