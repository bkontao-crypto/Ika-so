# Phase 2 — Cœur de la marketplace (rapport intermédiaire)

Voir `SUIVI.md` pour l'état détaillé. Résumé du 1er novembre 2026.

## Fait
Recherche plein texte française sans accents (migration 005 : `unaccent`, `pg_trgm`, index GIN) · filtres et tris · pagination · détection de doublons · regroupement sur la carte · avertissement à l'annonceur et à la modération.

## Testé, et comment
`test/search.test.js` (règles pures + PostgreSQL réel) ; navigateur : recherche « TERRAIN aci » trouve l'annonce, « zzzzz » ne trouve rien.

## Non vérifié
PostGIS (volontairement non utilisé) · temps de recherche sur gros volume (aucun test de charge) · critère des deux minutes sur téléphone réel · extensions `unaccent`/`pg_trgm` sur votre PostgreSQL (nécessitent le paquet contrib).

## Décision proposée
Pas de PostGIS pour le pilote : un filtre par quartier suffit à Bamako. À rouvrir si la recherche par rayon devient nécessaire.
