-- Retour arrière de la migration 028 (réglages page d'accueil).
drop table if exists ika_homepage_settings;
delete from _migrations where name = '028_homepage_settings.sql'; -- ajouté (BUG-002) : permet de rejouer la migration après le retour arrière
