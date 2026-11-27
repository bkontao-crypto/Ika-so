# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 27 novembre 2026 (UTC) — audit de la collecte d’audience
- Branche : `docs/audit-analytics`, depuis `main` `36ac9f8` (NON fusionnée)
- Statut : audit terminé ; décisions du propriétaire attendues

## Déclaration du propriétaire
> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

Texte de référence : `CAHIER_DES_CHARGES.md`. Ce n’est ni une validation juridique ni une preuve que les fonctionnalités sont éteintes.

## Dernière intervention
Audit en lecture seule : `docs/audit/AUDIT_ANALYTICS_2026-11-27.md`. Documents mis à jour. Aucun code modifié ; suite complète 570/570 sur la branche d’audit. Observatoire déjà fusionné (570 tests réussis lors de cette fusion) ; production non vérifiée.

## Points ouverts prioritaires
1. Collecte active par défaut (contraire au principe 8) : décision attendue.
2. Consentement à l’inscription sans refus distinct : à traiter avec le juriste avant lancement.
3. Écarts 3 à 7 de l’audit (portée du choix « Statistiques », chemins, purge, chiffres gonflables, documents périmés).
4. Corriger le nettoyage de fichiers du test `test/star-badge-pg.test.js`.
5. Finaliser et tester la récupération MFA Superadmin.
6. Prouver sauvegarde chiffrée hors serveur et restauration sur base jetable.
7. Valider les paiements et fournisseurs en réel ; recetter la production.

## Prochaine tâche exacte
Obtenir la décision sur l’écart 1. Si « éteindre par défaut » : sur une branche dédiée, inverser le défaut (configuration et réglage en base), adapter les tests, sans toucher à la production.

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
