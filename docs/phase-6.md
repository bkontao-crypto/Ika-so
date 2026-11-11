# Phase 6 — Croissance

## Fait
Pages SEO rendues par le serveur, sitemap/robots, données structurées, repères de prix, 3 guides, annuaire des agences vérifiées, import CSV, espace agence.

## Testé et comment
- `test/seo.test.js` : 15 tests + modèle CSV (base PostgreSQL réelle via l'adaptateur psql).
- Navigateur réel (Chromium) : 42/42, dont page quartier sans JavaScript, JSON-LD valide, aucun téléphone en public, import à blanc puis réel, refus d'un doublon de titre.

## Non vérifié
Vrai express/pg, vitesse réelle, contenu des guides (relecture professionnelle), volumes réels pour les repères de prix.

## Risques
Information juridique des guides ; repères de prix trompeurs si peu de données (seuil de 3 comparables).

## Décisions attendues
Domaine (`PUBLIC_URL`), relecteur des guides, quartiers prioritaires.
