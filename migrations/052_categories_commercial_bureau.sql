-- Nouvelles catégories d'annonces : « Local commercial » et « Bureau ».
-- La contrainte d'origine (migration 002) n'est pas nommée explicitement : on retrouve son nom dans le catalogue.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'ika_listings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%' and pg_get_constraintdef(oid) ilike '%Terrain%'
  loop
    execute format('alter table ika_listings drop constraint %I', c.conname);
  end loop;
end $$;

alter table ika_listings
  add constraint ika_listings_category_check
  check (category in ('Terrain', 'Maison', 'Appartement', 'Studio', 'Local commercial', 'Bureau'));

-- Table des catégories actives (035) : alignée sur les valeurs réellement stockées dans les annonces.
insert into ika_categories (code, label) values
  ('Studio', 'Studio'),
  ('Local commercial', 'Local commercial'),
  ('Bureau', 'Bureau')
on conflict (code) do nothing;
