-- Owner Control Center v2 : journal de sécurité (connexions) pour la traçabilité des mouvements du site.
-- Additive et idempotente. Aucune adresse IP, aucun agent utilisateur brut, aucun e-mail saisi : seulement l'événement,
-- le compte concerné (si connu), la famille d'appareil et le résultat. Pas de clé étrangère : la ligne survit à la suppression d'un compte.
-- Le reste de la traçabilité (annonces, contacts, paiements, messages, signalements, actions de l'équipe…) lit les tables existantes : rien à copier.
-- Retour arrière : scripts/rollback/042_owner_activity_down.sql
create table if not exists ika_security_log (
  id text primary key,
  occurred_at timestamptz not null default now(),
  event text not null check (event in ('REGISTER', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT')),
  user_id text,
  device_type text check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')),
  outcome text not null default 'OK' check (outcome in ('OK', 'FAILED')),
  detail text
);
create index if not exists ika_security_log_time_idx on ika_security_log (occurred_at desc);
create index if not exists ika_security_log_user_idx on ika_security_log (user_id, occurred_at desc) where user_id is not null;

-- Interrupteur du journal de sécurité (réglable par le propriétaire).
insert into ika_settings (key, value) values ('security_log_enabled', 'true') on conflict do nothing;

-- Index de lecture du journal unifié (tables dont la date n'était pas indexée seule).
create index if not exists ika_favorites_created_idx on ika_favorites (created_at desc);
create index if not exists ika_comments_created_idx on ika_comments (created_at desc);
create index if not exists ika_messages_created_idx on ika_messages (created_at desc);
create index if not exists ika_contact_events_created_idx on ika_contact_events (created_at desc);
create index if not exists ika_payments_created_idx on ika_payments (created_at desc);
create index if not exists ika_profiles_created_idx on ika_profiles (created_at desc);
create index if not exists ika_reports_created_idx on ika_reports (created_at desc);
