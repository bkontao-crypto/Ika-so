# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 27 novembre 2026 (UTC) — Observatoire fusionné
- Branche : `main` (commit de fusion de `feature/observatoire` `f688d9e` sur `3e7a5fa`)
- Statut : fusionné ; production non vérifiée

## Dernière intervention

Observatoire du site (`/owner.html#/observatory`, Super Administrateur) : agrégats comparés, tendances, filtres de dates, derniers gestes. Lecture seule, sans migration ni collecte nouvelle. La PR documentaire n° 15 est déjà fusionnée.

## Vérifications

- `npm test` sur le code fusionné : 570 réussis, 0 échec ; contrôle Service Worker réussi.
- Recette navigateur faite sur la branche avant fusion, en local avec données fictives (voir `Important/SUIVI.md`).
- Non vérifié : production, performance sur gros volumes, vrais téléphones. Détail dans `SUIVI_EXECUTION.md`.

## Points ouverts prioritaires

1. Harmoniser le comportement Analytics avec la règle « désactivé par défaut » avant toute activation.
2. Corriger le nettoyage de fichiers du test `test/star-badge-pg.test.js`.
3. Finaliser et tester la récupération MFA Superadmin.
4. Prouver sauvegarde chiffrée hors serveur et restauration sur base jetable.
5. Valider les parcours de paiement et fournisseurs en environnement réel.
6. Recetter la production séparément des tests CI.

## Prochaine tâche exacte

Contrôler en ligne (si la fusion est déployée) : ouvrir l'Observatoire, changer de période, comparer un chiffre à son module d'origine, mesurer le temps de réponse. L'audit Analytics (point ouvert 1) précède toute activation de la collecte et toute mesure d'impressions.

## Ordre de lecture à la reprise

1. `ETAT_REPRISE_AGENT.md`
2. `SUIVI_EXECUTION.md`
3. `CAHIER_DES_CHARGES.md`
4. `ARCHITECTURE_TECHNIQUE.md`
5. Seulement ensuite, les fichiers techniques du périmètre demandé.

## Consignes permanentes

- Répondre en français, de façon concise et orientée exécution.
- Économiser les tokens : lectures ciblées, pas de relecture globale inutile.
- Ne jamais affirmer une action ou un test non effectué.
- Ne pas modifier une exigence métier validée sans arbitrage explicite.
- Ne pas ajouter de dépendance, migration ou refonte sans justification et autorisation.
- Avant toute écriture : préciser périmètre, branche et risques.
- Aucune modification de `main`, base ou production sans autorisation explicite.
- Après chaque intervention significative, mettre à jour `SUIVI_EXECUTION.md` et cette fiche.
