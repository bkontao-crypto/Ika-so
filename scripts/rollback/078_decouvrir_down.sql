-- Retour arrière de la migration 078. ATTENTION : supprime les publications « Découvrir » de type demande/information, leurs photos, signalements
-- et les conversations ouvertes depuis une publication. Les publications simples de profil (Actualité) et les annonces restent.
begin;
delete from ika_threads where listing_id is null;
drop index if exists ika_threads_publication_visitor_uniq;
alter table ika_threads drop constraint if exists ika_threads_subject_chk;
alter table ika_threads drop column if exists publication_id;
alter table ika_threads alter column listing_id set not null;
drop table if exists ika_publication_reports;
drop table if exists ika_publication_photos;
delete from ika_publications where kind <> 'ACTUALITE';
drop index if exists ika_publications_feed_idx;
alter table ika_publications drop column if exists hidden_reason, drop column if exists hidden_at, drop column if exists hidden_by,
  drop column if exists status, drop column if exists zone, drop column if exists category, drop column if exists kind;
delete from _migrations where name = '078_decouvrir.sql';
commit;
