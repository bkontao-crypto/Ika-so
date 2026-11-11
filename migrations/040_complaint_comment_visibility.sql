-- Commentaires de réclamation : note interne de l'équipe (défaut) ou réponse visible par le plaignant. Additif.
-- Les commentaires existants écrits par l'équipe passent en « note interne » : c'est le choix le plus sûr.
-- Retour arrière : scripts/rollback/040_complaint_comment_visibility_down.sql
alter table ika_complaint_comments add column if not exists visible_to_complainant boolean not null default false;
