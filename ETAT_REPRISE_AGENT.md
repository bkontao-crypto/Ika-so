# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 27 novembre 2026 (UTC)
- Référence de départ : `main` — `734dd2910da9ccce23112bdc09d960b49512a6c0`
- Branche documentaire : `docs/referentiels-projet-ika-so`
- Statut : référentiels créés sur branche dédiée ; aucune modification de `main`, du code métier, de la base ou de la production.

## Dernière intervention

Création des quatre documents de référence à la racine :
- `CAHIER_DES_CHARGES.md`
- `ARCHITECTURE_TECHNIQUE.md`
- `SUIVI_EXECUTION.md`
- `ETAT_REPRISE_AGENT.md`

Cette intervention est documentaire uniquement. Elle reprend les éléments de l'ordonnance, des documents existants et de l'audit du dépôt. Les statuts fonctionnels restent distincts des exigences.

## Vérifications

- Branche dédiée créée depuis le commit de référence.
- Les quatre fichiers ont été ajoutés sur cette branche.
- Aucun changement de code, migration, base de données ou déploiement.
- Les tests applicatifs n'ont pas été relancés : aucun code applicatif n'a été modifié.
- La revue finale des fichiers et des commits reste à effectuer après leur création.

## Points ouverts prioritaires

1. Harmoniser le comportement Analytics avec la règle « désactivé par défaut » avant toute activation.
2. Corriger le nettoyage de fichiers du test `test/star-badge-pg.test.js`.
3. Finaliser et tester la récupération MFA Superadmin.
4. Prouver sauvegarde chiffrée hors serveur et restauration sur base jetable.
5. Valider les parcours de paiement et fournisseurs en environnement réel.
6. Recetter la production séparément des tests CI.

## Prochaine tâche exacte

Relire les quatre fichiers sur cette branche, vérifier leur présence et le contenu des commits, puis présenter le diff au propriétaire. Ne pas fusionner la branche dans `main` sans accord explicite.

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
