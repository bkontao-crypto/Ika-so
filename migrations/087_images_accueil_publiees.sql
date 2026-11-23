-- 087 : liste exacte des images des blocs publiés de l'accueil (remplace la recherche dans le texte complet de la mise en page,
-- qui pouvait rendre publique une image privée citée dans un texte libre). Reprise des blocs déjà publiés.
do $$
begin
  insert into ika_settings (key, value)
  select 'home_published_images',
         coalesce((select jsonb_agg(distinct u)::text from (
           select s->'block'->>'imageUrl' as u from jsonb_array_elements(l.j->'sections') s where coalesce(s->>'visible', 'true') <> 'false'
           union all
           select i->>'url' from jsonb_array_elements(l.j->'sections') s, jsonb_array_elements(coalesce(s->'block'->'images', '[]'::jsonb)) i where coalesce(s->>'visible', 'true') <> 'false'
         ) x where u is not null), '[]')
  from (select value::jsonb as j from ika_settings where key = 'home_layout' and value like '{%') l
  on conflict (key) do nothing;
exception when others then
  null; -- valeur illisible : rien à reprendre, la liste se remplira à la prochaine publication
end $$;
