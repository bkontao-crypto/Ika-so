-- Deux méthodes de connexion par compte : mot de passe et/ou Google. has_password = faux pour un compte créé par Google (mot de passe aléatoire, inconnu).
-- Additive : aucune donnée supprimée. Les comptes déjà liés à Google (migration 066) passent à « sans mot de passe ».
alter table ika_users add column if not exists has_password boolean not null default true;
update ika_users set has_password = false where google_sub is not null;
