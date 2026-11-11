# IKA SO — Owner Control Center v2 — livraison du 8 novembre 2026

## Environnement (à conserver dans les documents de suivi)
PostgreSQL 18 · Node.js 22 · pas de GitHub ni de Render · exécution en localhost pour le moment.

## Mise en route (localhost)
1. Sauvegarder la base.
2. `npm install` puis `npm run migrate` (applique la **042**).
3. `npm start`, ouvrir `http://localhost:<port>/owner` avec un compte SUPERADMIN.
4. `npm test` (le fichier `test/owner-center.test.js` n'a pas besoin de PostgreSQL).

## Feuille de route
**Fait** : tableau de bord conforme à la maquette ; journal unifié ; dossiers de traçage ; journal d'audit ; export ; journal de connexions ; 21 modules câblés ; thème sombre ; tests du moteur.
**Reste à faire (vérifications que je n'ai pas pu mener)** : exécuter la 042 et ouvrir `/owner` sur votre PostgreSQL 18 (les requêtes SQL n'ont été vérifiées que par fausse base) ; essai visuel sur navigateur ; relancer toute votre suite de tests.
**Ensuite** : brancher la purge à 12 mois de `ika_security_log` dans `lib/retention.js` ; validation juridique/APDP du journal de connexions ; visiteurs uniques et sessions (toujours conditionnés à la validation juridique) ; alertes en temps réel (SSE) ; traduction des modules « langues / catégories » vers le site public.

## Limites connues
- Historique : les connexions ne sont journalisées qu'à partir de la 042 ; la fréquentation (pages vues) n'apparaît que si `ANALYTICS_ENABLED` est actif.
- Retraits de favoris et suppressions ne laissent pas de trace dans les tables : ils n'apparaissent pas.
- « Prioritaire » = réclamation ouverte depuis plus de 72 h ; « disponibilité » = durée de fonctionnement depuis le dernier démarrage, pas un taux.
- Le contrôle des pièces justificatives, le rapprochement et les remboursements restent dans `/admin` (documents sensibles).
