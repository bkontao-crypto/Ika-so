-- 075 : dossier Premium étudié en 3 étapes (1 étude, 2 vérification, 3 confirmation), chaque étape tracée à la personne qui l'a validée.
-- Les étapes sont indépendantes (peuvent se faire en même temps) ; la demande ne peut être approuvée que lorsque les 3 sont validées.
create table if not exists ika_premium_request_steps (
  request_id text not null references ika_premium_requests (id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  done_by text not null,
  done_at timestamptz not null default now(),
  note text not null default '',
  primary key (request_id, step)
);
-- paid : le dossier est étudié APRÈS un paiement en ligne (le Premium payé est déjà actif). review_due_at : date limite de réponse annoncée.
alter table ika_premium_requests add column if not exists paid boolean not null default false;
alter table ika_premium_requests add column if not exists review_due_at timestamptz;
