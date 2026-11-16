-- Connexion avec Google : identifiant Google (sub) lié au compte. Les comptes créés par Google reçoivent un mot de passe
-- aléatoire inutilisable (ils ne peuvent se connecter que par Google). Aucune donnée existante n'est modifiée.
alter table ika_users add column if not exists google_sub text;
create unique index if not exists ika_users_google_sub_uidx on ika_users (google_sub) where google_sub is not null;
