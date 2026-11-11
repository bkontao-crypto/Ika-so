-- Catégories actives et journal des tendances.
create table if not exists ika_categories (
  code text primary key,
  label text not null,
  active boolean not null default true
);
insert into ika_categories (code, label) values
  ('Maison', 'Maison'),
  ('Appartement', 'Appartement'),
  ('Terrain', 'Terrain'),
  ('Local', 'Local commercial'),
  ('Bureau', 'Bureau')
on conflict do nothing;
