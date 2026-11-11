# Phase 1 — Fondations (rapport)

Date : 1er novembre 2026.

## Fait
- Frontend découpé : `core/` (état, routeur), `components/`, `pages/` chargées à la demande (`import()`). Chargement initial ≈ 9 Ko compressés (budget 36 Ko), plus grosse page 2,1 Ko.
- Système de design CSS à jetons (déjà en place, conservé). Aucune bibliothèque externe : rien à héberger.
- Journaux JSON sans IP, identifiant de requête, `/api/health`, suivi des erreurs serveur (500 journalisées avec pile courte) et navigateur (`/api/client-error`).
- Arrêt propre, exceptions non gérées journalisées.
- Tests des routes HTTP (`test/routes.test.js`), budget de performance et contrôle « aucun CDN / aucune marque tierce » (`test/budget.test.js`).
- Intégration continue (GitHub Actions + PostgreSQL 16), Dockerfile, `--test-concurrency=1` pour éviter que deux fichiers vident la même base.

## Testé, et comment
- 49 tests passent (règles 16, services 14, web 6, routes 13) sur PostgreSQL 16 réel via `psql`, plus 8 tests de budget et d'absence de CDN, tous verts.
- Parcours navigateur (Chromium) sur le frontend modulaire : 23/24 ; le 24e est un 403 attendu du compte banni.

## NON vérifié
- Le vrai `express` et le vrai `pg` : substitut d'Express utilisé (`scripts/verification/fake-express`). **Premier `npm install && npm test` chez vous = vérification obligatoire.**
- `package-lock.json` absent (npm bloqué ici) : CI et Docker utilisent `npm install`. Générez le fichier puis passez à `npm ci`.
- La CI GitHub et l'image Docker n'ont jamais été exécutées.
- Pas de service externe de suivi d'erreurs : journaux JSON à collecter chez l'hébergeur. Décision à valider.
- Budget mesuré en octets compressés, pas en temps réel sur un téléphone d'entrée de gamme (Lighthouse non lancé).
- Les points « non vérifié » de la phase 0 restent valables (SMS réel, photos, service worker…).

## Risques
Limiteur de débit en mémoire ; le substitut d'Express peut masquer une différence avec le vrai.

## Décisions attendues
Suivi d'erreurs : journaux seuls ou service tiers ? Hébergeur (collecte des journaux, Docker).
