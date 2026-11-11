-- OPTIONNEL, NON TESTÉ dans l'environnement de livraison (aucun PostgreSQL disponible) : à essayer d'abord sur une copie.
-- Ajoute PostGIS à ika_listing_geo : colonne géométrique indexée, pour de futures requêtes spatiales.
-- Le module fonctionne sans ce script : les superficies sont calculées par server/lib/geo.js.
-- Nécessite que PostGIS soit installé sur le serveur (verifier : select * from pg_available_extensions where name = 'postgis').
create extension if not exists postgis;
alter table ika_listing_geo add column if not exists geom geometry(Geometry, 4326);
update ika_listing_geo
   set geom = case when polygon is not null then ST_SetSRID(ST_GeomFromGeoJSON(polygon::text), 4326)
                   else ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) end
 where geom is null;
create index if not exists ika_listing_geo_geom_idx on ika_listing_geo using gist (geom);

-- Contrôle indépendant des superficies : l'écart doit rester très faible (< 0,1 % pour une parcelle de quartier).
-- select listing_id, area_m2, ST_Area(geom::geography) as postgis_m2,
--        round((100 * abs(area_m2 - ST_Area(geom::geography)) / nullif(area_m2, 0))::numeric, 4) as ecart_pct
--   from ika_listing_geo where polygon is not null;
