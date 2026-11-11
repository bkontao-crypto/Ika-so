-- Retour arrière de la migration 040. ATTENTION : après le retour, la lecture côté plaignant doit être revue (sinon elle dépend de la colonne supprimée).
begin;
alter table ika_complaint_comments drop column if exists visible_to_complainant;
delete from _migrations where name = '040_complaint_comment_visibility.sql';
commit;
