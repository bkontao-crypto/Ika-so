# Phase 7 — Durcissement (début)

## Fait
Sauvegarde et restauration, audit de sécurité automatisé, contrôle d'accessibilité automatique, frein de connexion par compte (5 échecs / 15 min).

## Testé et comment
- `test/limiter.test.js` (5 tests, sans base) ; `test/connexion.test.js` (PostgreSQL + Express, non exécuté dans cet environnement) ; `test/securite.test.js` (8 tests, PostgreSQL) ; `scripts/verification/a11y.mjs` (Chromium, 18 pages, clair et sombre) ; restauration réelle d'une sauvegarde.

## Défauts trouvés et corrigés
Octet nul → 500 ; droits vérifiés après l'existence de la pièce ; contraste or ; champ sans étiquette ; texte vert illisible en mode sombre.

## Non vérifié
Charge, lecteur d'écran, test d'intrusion humain, `npm audit`, vrai `pg`.

## Décisions attendues
Juriste (confidentialité, conditions, suppression de compte, durée de conservation), hébergeur (sauvegardes planifiées et chiffrées).
