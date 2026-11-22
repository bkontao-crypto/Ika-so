-- Retour arrière de la migration 085 : supprime les « j'aime », les commentaires de publications et les republications (annonces et commentaires d'annonces conservés).
begin;
delete from ika_publications where shared_id is not null;
drop index if exists ika_publications_shared_idx;
alter table ika_publications drop column if exists shared_id, drop column if exists shared_type;
delete from ika_comments where listing_id is null;
alter table ika_comments drop constraint if exists ika_comments_one_target;
drop index if exists ika_comments_publication_idx;
alter table ika_comments drop column if exists publication_id;
alter table ika_comments alter column listing_id set not null;
drop table if exists ika_likes;
delete from _migrations where name = '085_reactions_commentaires.sql';
commit;
