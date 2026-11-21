-- 079 : lien vidéo (YouTube ou Facebook) facultatif sur une publication « Découvrir ». Aucun fichier vidéo n'est stocké chez nous.
alter table ika_publications add column if not exists video_url text check (video_url is null or char_length(video_url) <= 300);
alter table ika_publications add column if not exists video_provider text check (video_provider is null or video_provider in ('youtube', 'facebook'));
