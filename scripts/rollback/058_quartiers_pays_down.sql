-- Retour arrière de 058 : les annonces gardent leur quartier en texte ; seules la colonne « pays » et la table des quartiers disparaissent.
alter table ika_listings drop column if exists country_code;
drop table if exists ika_zones;
