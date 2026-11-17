-- Une réclamation générale (formulaire « Mes réclamations ») n'est liée à aucune annonce : listing_id doit pouvoir rester vide.
-- Avant : not null → toute réclamation sans annonce échouait (erreur serveur). Aucune donnée existante modifiée ; relançable sans effet.
-- Retour arrière : scripts/rollback/069_reclamations_sans_annonce_down.sql
alter table ika_reports alter column listing_id drop not null;
