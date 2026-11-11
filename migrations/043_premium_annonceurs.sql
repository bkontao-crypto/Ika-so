-- Annonceurs Premium : durée de l'abonnement sur le profil + historique des octrois (décidés par un super administrateur).
-- Additive. Retour arrière : scripts/rollback/043_premium_annonceurs_down.sql
alter table ika_profiles add column if not exists premium_until timestamptz;
create index if not exists ika_profiles_premium_idx on ika_profiles (premium_until) where premium_until is not null;

create table if not exists ika_premium_grants (
  id text primary key,
  user_id text not null references ika_users (id) on delete cascade,
  granted_by text references ika_users (id) on delete set null,
  days int not null check (days between 1 and 3660),
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ika_premium_grants_user_idx on ika_premium_grants (user_id, created_at desc);

-- Accélère le classement de l'annuaire et le tableau de bord (annonces d'un annonceur, réponses aux messages).
create index if not exists ika_messages_sender_idx on ika_messages (thread_id, sender_id);
