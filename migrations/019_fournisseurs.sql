-- Fournisseurs tiers (tous désactivés par défaut). Additive seulement.
-- Adresse de la page de paiement du fournisseur : permet de rouvrir un paiement encore en attente.
alter table ika_payments add column if not exists checkout_url text;

-- Alertes hors du site : désactivées par défaut, activées seulement par un choix explicite de la personne
-- (consentement : Loi n° 2013-015 art. 3 et 19). Un fournisseur doit en plus être configuré côté serveur.
create table if not exists ika_notify_prefs (
  user_id text primary key references ika_users (id) on delete cascade,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  consent_at timestamptz,
  updated_at timestamptz not null default now()
);
