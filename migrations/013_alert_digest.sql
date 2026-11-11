-- Alertes groupées : chaque compte choisit « immédiate » (comportement actuel, par défaut) ou « une fois par jour ».
-- Additive seulement : aucune table existante n'est modifiée ; sans ligne dans ika_alert_prefs, rien ne change.
create table if not exists ika_alert_prefs (
  user_id text primary key references ika_users (id) on delete cascade,
  mode text not null default 'INSTANT' check (mode in ('INSTANT', 'DAILY')),
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Annonces correspondantes en attente du prochain résumé (une ligne par personne et par annonce).
create table if not exists ika_alert_pending (
  user_id text not null references ika_users (id) on delete cascade,
  listing_id text not null references ika_listings (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists ika_alert_pending_created_idx on ika_alert_pending (created_at);
