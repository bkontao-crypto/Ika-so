-- Retour arrière de la migration 088 : SUPPRIME les demandes de badge Étoile et leurs pièces (références et fichiers stockés). Sauvegarder d'abord (branche Neon).
begin;
create temp table _star_files on commit drop as select file_id from ika_star_documents;
drop table if exists ika_star_documents;
drop table if exists ika_star_requests;
delete from stored_files where id in (select file_id from _star_files);
delete from _migrations where name = '088_badge_etoile.sql';
commit;
