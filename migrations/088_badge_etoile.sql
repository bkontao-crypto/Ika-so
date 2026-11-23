-- 088 : badge Étoile (compte identifié). Demandes et pièces justificatives PRIVÉES (jamais servies publiquement).
-- Migration additive : aucune table ni colonne existante n'est modifiée.
-- DRAFT = dossier en cours de constitution (pièces envoyées une à une) ; PENDING = envoyé à l'équipe.
create table if not exists ika_star_requests (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  account_type text not null check (account_type in ('AGENCY', 'INDIVIDUAL', 'OTHER')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  phone text not null default '',
  message text not null default '',
  accepted_terms_at timestamptz,
  submitted_at timestamptz,
  review_due_at timestamptz,
  paid boolean not null default false,
  decided_by text,
  decided_at timestamptz,
  decided_note text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
-- Un seul dossier ouvert (en constitution ou en attente) par compte.
create unique index if not exists ika_star_requests_open_idx on ika_star_requests (user_id) where status in ('DRAFT', 'PENDING');
create index if not exists ika_star_requests_status_idx on ika_star_requests (status, created_at);

create table if not exists ika_star_documents (
  id text primary key,
  request_id text not null references ika_star_requests (id) on delete cascade,
  kind text not null check (kind in ('ID_CARD', 'PHOTO', 'SELFIE', 'RESIDENCE', 'COMPANY_REGISTER', 'HQ_PROOF')),
  file_id uuid not null references stored_files (id),
  file_type text not null,
  created_at timestamptz not null default now(),
  unique (request_id, kind)
);
