-- Retour arrière de la migration 052 (052_categories_commercial_bureau.sql). ATTENTION : la contrainte de catégorie revient aux 4 valeurs d'origine (Terrain, Maison, Appartement, Studio) : l'opération ÉCHOUE (et rien n'est modifié) s'il existe des annonces « Local commercial » ou « Bureau ». Retire aussi les catégories ajoutées par 052 dans ika_categories.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/052_categories_commercial_bureau_down.sql
begin;
alter table if exists ika_listings drop constraint if exists ika_listings_category_check;
alter table if exists ika_listings add constraint ika_listings_category_check check (category in ('Terrain', 'Maison', 'Appartement', 'Studio'));
delete from ika_categories where code in ('Studio', 'Local commercial');
delete from _migrations where name = '052_categories_commercial_bureau.sql';
commit;
