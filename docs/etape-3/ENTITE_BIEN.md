# Esquisse — Entité « bien » (DEC-004)

**Objectif** : distinguer le bien (patrimoine) de l'annonce (publication). Un bien peut avoir plusieurs annonces successives.

## Modèle proposé (migration additive)

```sql
create table ika_properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references ika_users(id),
  title text not null,
  category text,
  address text,
  neighborhood text,
  surface_m2 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ika_listings
  add column property_id uuid references ika_properties(id);
```

## Relations
- Un bien appartient à un propriétaire (`owner_id`).
- Une annonce peut être liée à un bien (`property_id` optionnel → aucune rupture).
- Documents, visites et collaborateurs se rattachent au bien (tables futures ou réutilisation).

## Onglet « Mes biens »
- Liste des biens du compte.
- Pour chaque bien : annonces liées, documents, visites, bouton « Nouvelle annonce liée ».
- Invitation de collaborateur (réutilise le mécanisme d'équipe existant).

## Étapes d'implémentation
1. Migration additive (ci-dessus).
2. Endpoints `GET/POST /me/properties`, `GET /me/properties/:id`.
3. Remplacement du placeholder dans `compte-unifie.js`.
4. Liaison optionnelle lors de la publication d'une annonce.

**Statut** : esquisse prête. Implémentation à valider (DEC-004).
