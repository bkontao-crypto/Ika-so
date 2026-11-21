-- Retour arrière de la migration 079 : supprime les liens vidéo des publications (les publications restent).
begin;
alter table ika_publications drop column if exists video_provider, drop column if exists video_url;
delete from _migrations where name = '079_decouvrir_liens_video.sql';
commit;
