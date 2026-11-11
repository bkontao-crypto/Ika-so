# Phase 0 — mise en service de l'existant (rapport)

Date : 1er novembre 2026. Pile : Node.js 22 + Express + PostgreSQL + CSS (conforme à l'ordonnance, art. 3).

## Fait
- Reprise complète sur la pile de l'ordonnance ; React, Tailwind, TanStack, Better Auth et toute marque tierce retirés.
- Un seul mode de connexion en production : e-mail + mot de passe (scrypt), session opaque en cookie HttpOnly.
- Numéro vérifié par code SMS ; badge « vérifié » uniquement pour un vrai SMS (le mode démonstration n'en donne pas).
- Parcours : publier → modérer → carte → contacter (compté) → commenter → signaler → bloquer.
- Centre de contrôle `/admin.html` (file, signalements, annonces en ligne, journal, comptes).
- Aucune IP stockée ; aucun secret dans le code (`.env.example`).

## Testé, et comment
- Migrations 001–004 sur un vrai PostgreSQL 16 : appliquées sans erreur.
- `npm test` : 36/36 (règles, sécurité HTTP, services sur PostgreSQL réel via l'adaptateur `scripts/verification/psql-adapter.mjs`).
- Parcours complet dans un vrai Chromium (Playwright, `scripts/verification/e2e-browser.mjs`) : 23/24 ; le 24e point est une erreur 403 attendue du compte banni. Aucune violation CSP.
- Contrôles CSRF à la main (origine étrangère refusée en 403).

## NON vérifié (à ne pas considérer comme fait)
- Les vrais paquets `express` et `pg` : le registre npm était bloqué ici. Les tests ont utilisé un substitut d'Express et `psql`. Premier `npm install && npm test` chez vous = vérification obligatoire.
- SMS réel (Twilio) : jamais envoyé. Le chemin existe, il n'a pas été exécuté.
- Photos : stockées en base (450 Ko max chacune) ; pas de stockage objet.
- Service worker / mode hors ligne : seul le manifeste existe. Carte : repères CSS, pas de fond cartographique. Police Inter non hébergée (pile système). Pas de rendu serveur pour le référencement. Pas de bambara.
- Textes juridiques (confidentialité, conditions) : non rédigés par un juriste.
- Une partie du socle (`package.json`, `config.js`, `db.js`, `migrate.js`) a été reconstruite ; relisez-la.

## Risques
Limiteur de débit en mémoire (une seule instance) ; photos en base alourdissent PostgreSQL ; aucun antivirus ni contrôle de contenu des images.

## Décisions attendues
Voir `docs/decisions.md`.
