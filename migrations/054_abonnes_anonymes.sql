-- Abonnés : chaque abonnement peut être anonyme (l'annonceur voit « Abonné anonyme », sans identité).
-- Réglage par défaut au niveau du compte. Additive.
alter table ika_follows add column if not exists anonymous boolean not null default false;
alter table ika_users add column if not exists follow_anonymous_default boolean not null default false;
