-- Premium payant : l'abonnement Premium s'achète par le même circuit que la mise à la une (fournisseur, webhook signé, facture).
-- Additive. Retour arrière : scripts/rollback/044_premium_paiement_down.sql
-- Aucun tarif n'est fixé ici : les formules Premium démarrent inactives, à prix 0 (décision du propriétaire, comme pour la mise à la une).
alter table ika_offers add column if not exists kind text not null default 'BOOST';
alter table ika_offers drop constraint if exists ika_offers_kind_check;
alter table ika_offers add constraint ika_offers_kind_check check (kind in ('BOOST', 'PREMIUM'));

-- Un paiement Premium ne concerne aucune annonce.
alter table ika_payments alter column listing_id drop not null;
alter table ika_payments add column if not exists kind text not null default 'BOOST';
alter table ika_payments drop constraint if exists ika_payments_kind_check;
alter table ika_payments add constraint ika_payments_kind_check check (kind in ('BOOST', 'PREMIUM'));

-- L'historique des abonnements garde le lien avec le paiement qui l'a donné (NULL = octroi manuel d'un super administrateur).
alter table ika_premium_grants add column if not exists payment_id text references ika_payments (id) on delete set null;
create unique index if not exists ika_premium_grants_payment_idx on ika_premium_grants (payment_id) where payment_id is not null;

insert into ika_offers (code, label, days, kind) values
  ('PREMIUM_30', 'Premium, 30 jours', 30, 'PREMIUM'),
  ('PREMIUM_90', 'Premium, 90 jours', 90, 'PREMIUM'),
  ('PREMIUM_365', 'Premium, 1 an', 365, 'PREMIUM')
on conflict do nothing;
