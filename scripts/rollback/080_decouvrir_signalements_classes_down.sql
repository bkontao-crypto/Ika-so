-- Retour arrière de la migration 080 : les signalements classés sans suite redeviennent indistincts (aucun n'est supprimé).
begin;
drop index if exists ika_publication_reports_open_idx;
alter table ika_publication_reports drop column if exists dismissed_by, drop column if exists dismissed_at;
delete from _migrations where name = '080_decouvrir_signalements_classes.sql';
commit;
