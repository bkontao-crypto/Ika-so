-- Retour arrière de la migration 090 : supprime les favoris de publications Découvrir (les favoris d'annonces ne sont pas touchés ; sauvegarder d'abord : branche Neon).
begin;
drop table if exists ika_publication_favorites;
delete from _migrations where name = '090_publication_favoris.sql';
commit;
