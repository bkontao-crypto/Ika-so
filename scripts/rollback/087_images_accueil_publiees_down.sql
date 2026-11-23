-- Retour arrière de la migration 087 : supprime la liste des images publiées (la prochaine publication de l'accueil la recrée).
begin;
delete from ika_settings where key = 'home_published_images';
delete from _migrations where name = '087_images_accueil_publiees.sql';
commit;
