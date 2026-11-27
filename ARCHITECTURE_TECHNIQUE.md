# ARCHITECTURE TECHNIQUE — IKA SÔ

- Version : 1.0 — 27 novembre 2026
- Référence de code : branche `main`, commit `734dd2910da9ccce23112bdc09d960b49512a6c0`
- Nature : description documentaire de l'architecture observée dans le dépôt, complétée par les principes de cible explicitement documentés. Les constats de code ne valent pas validation fonctionnelle de bout en bout.
- Niveau de preuve : inventaire et lecture statique du dépôt ; CI consultée pour le commit de référence. Aucune recette de production n'est revendiquée.
- Attention : ce document ne prouve pas la configuration ni le fonctionnement de l'environnement Render/Neon en production.

## 1. Socle constaté

| Couche | Technologie / constat |
|---|---|
| Runtime | Node.js `>=22` |
| Langage | JavaScript natif, modules ES (`type: module`) |
| Serveur HTTP | Express 5.1.0 |
| Base de données | PostgreSQL, client `pg` 8.16.3 |
| Cartographie | Mapbox GL JS 3.33.0, avec mode de secours documenté |
| Frontend | JavaScript natif et CSS ; pages publiques et espaces séparés |
| Tests | Node.js Test Runner, exécution séquentielle via `npm test` |
| Déploiement cible documenté | Service web Render et PostgreSQL Neon |
| CI | GitHub Actions |

Les versions ci-dessus proviennent du `package.json` du commit de référence.

## 2. Organisation du dépôt

Répertoires et fichiers importants observés :
- `server/` : serveur, routes, services métier, bibliothèques et intégrations ;
- `public/` : pages, scripts frontend, styles et ressources publiques ;
- `migrations/` : migrations PostgreSQL versionnées ;
- `test/` : tests unitaires et d'intégration ;
- `scripts/` : contrôles, maintenance, sauvegarde et vérification ;
- `docs/` : exploitation, ordonnance, audit et documentation ;
- `Important/` : documents de suivi et spécifications historiques ;
- `Dossier_Suivi/` : ancienne fiche de reprise.

Au moment de l'audit du 27 novembre : 777 fichiers, 111 fichiers serveur, 44 services métier, 380 déclarations de routes dans le routeur principal, 95 migrations, 94 fichiers de tests et 79 scripts de retour arrière. Ces nombres sont un instantané d'audit, pas des invariants de l'architecture.

## 3. Architecture logique

Flux logique général observé :

```
Navigateur / PWA
      │
      ▼
Pages et scripts public/
      │ requêtes HTTP / API
      ▼
Express 5 — server/
      ├── Routes et contrôles d'accès
      ├── Services métier
      ├── Bibliothèques et validations
      ├── Intégrations externes
      └── Tâches et opérations de maintenance
      │
      ▼
PostgreSQL — migrations/
      │
      └── stockage des métadonnées et données métier

Services externes configurables : cartographie, e-mail, SMS,
messagerie WhatsApp et fournisseurs de paiement.
```

Ce schéma est une vue de haut niveau issue de l'inspection du dépôt. Il décrit les composants repérés, pas la preuve que chaque parcours fonctionne en conditions réelles. Pour toute évolution, confirmer le chemin exact dans les routes, services et schémas concernés avant d'intervenir.

## 4. Données et migrations

- PostgreSQL est la base relationnelle.
- Les migrations sont numérotées et présentes dans `migrations/`.
- Le mécanisme de migration utilise un verrou PostgreSQL et une transaction par migration (constat de l'audit).
- Toute nouvelle migration doit respecter la séquence existante ; ne jamais choisir un numéro arbitraire.
- Préférer les changements additifs et compatibles avec la version précédente.
- Avant migration réelle : sauvegarde, répétition sur copie, tests, vérification des contraintes et plan de rollback.
- Ne jamais lancer une migration ou une restauration de production sans autorisation explicite.

## 5. Fichiers et stockage

Le guide `docs/exploitation.md` décrit :
- le stockage de fichiers et le contrôle de persistance ;
- le risque de perte des fichiers sur disque éphémère ;
- les sauvegardes PostgreSQL et la copie chiffrée hors serveur via `age` et `rclone` ;
- le test de restauration sur base jetable.

Le guide précise que ces procédures doivent être exécutées et validées par l'exploitant. La présence des scripts ne prouve pas qu'une sauvegarde de production a été réalisée ou restaurée. Vérifier le stockage persistant et les variables d'environnement de l'hébergeur avant mise en service.

## 6. Authentification, autorisations et sécurité

Éléments identifiés :
- services et tables de permissions, rôles et délégations ;
- sessions et mécanismes d'authentification ;
- service MFA avec TOTP et codes de secours, e-mail/SMS selon configuration ;
- journalisation et contrôles pour les actions sensibles ;
- fichiers privés et justificatifs soumis à autorisation.

Points à maintenir :
- autorisation côté serveur pour chaque opération ;
- principe du moindre privilège ;
- aucune confiance dans les seules protections frontend ;
- secrets fournis par variables d'environnement, jamais stockés dans le dépôt ;
- récupération MFA privilégiée à finaliser et tester ;
- contrôle des variables obligatoires avant déploiement.

## 7. Analytics et vie privée

Architecture décrite dans `Important/ARCHITECTURE_ANALYTICS.md` :
- événements d'exposition distincts des tables métier ;
- source de vérité unique par indicateur ;
- émission des événements en meilleur effort ;
- minimisation des données et absence de stockage d'adresse IP dans le modèle décrit ;
- `visitor_id` et `session_id` maintenus nuls tant que validation juridique/APDP et mécanisme de consentement ne sont pas approuvés.

**Écart à résoudre :** la spécification Analytics indique une collecte désactivée par défaut, alors que l'audit du code a relevé un comportement d'activation par défaut lorsque l'interrupteur est absent. Harmoniser code, variables d'environnement, documentation et consentement avant toute activation en production.

## 8. Scripts et commandes utiles

Extraits du `package.json` :
- `npm start` : démarrer le serveur ;
- `npm run dev` : développement avec rechargement ;
- `npm run migrate` : appliquer les migrations ;
- `npm run check-env` : contrôler la configuration ;
- `npm test` : suite complète de tests ;
- `npm run test:rules` : tests de règles ;
- `npm run test:integration` : tests d'intégration PostgreSQL ;
- `npm run stamp-sw:check` : vérifier la version du Service Worker ;
- `npm run check-seo-contrast` : contrôle du contraste des pages SEO.

Exécuter les commandes dans un environnement contrôlé avec les dépendances installées. Ne pas exécuter `npm run migrate` contre la production sans autorisation.

## 9. CI et limites de preuve

Pour le commit de référence :
- CI GitHub Actions : 565 tests réussis, 0 échec, 0 test ignoré ;
- installation des dépendances réussie ;
- contrôle Service Worker réussi ;
- PostgreSQL 16 utilisé comme service de test.

Ces résultats démontrent le passage de la suite dans l'environnement CI correspondant. Ils ne prouvent pas :
- la disponibilité du site déployé ;
- la validité des secrets ou variables Render/Neon ;
- l'envoi réel de SMS/e-mails/WhatsApp ;
- le fonctionnement des paiements en production ;
- la persistance réelle des fichiers ;
- une restauration réelle de sauvegarde de production.

## 10. Déploiement et exploitation

Le guide de référence est `docs/exploitation.md`. Il décrit Render, Neon, le contrôle d'environnement, le démarrage, la santé du service, les sauvegardes et les incidents.

Règles :
1. vérifier la CI et le contrôle d'environnement ;
2. confirmer une base persistante et le stockage des fichiers ;
3. sauvegarder et tester la restauration sur une base jetable ;
4. déployer uniquement après autorisation ;
5. contrôler `/api/health`, les journaux et un parcours fonctionnel ;
6. documenter le retour arrière.

## 11. Dette et risques techniques connus

- incohérence entre spécification et valeur par défaut de l'interrupteur Analytics ;
- tests de nettoyage de fichiers dans `test/star-badge-pg.test.js` utilisant `content_type` alors que `stored_files` utilise `mime_type` ; erreur absorbée par `.catch()`, pouvant laisser des données de test ;
- récupération MFA Superadmin à finaliser ;
- procédure de sauvegarde hors serveur et restauration réelle à prouver ;
- variables et intégrations tierces non vérifiables depuis le seul dépôt.

## 12. Règles de modification pour les agents

- lire d'abord `ETAT_REPRISE_AGENT.md`, puis `SUIVI_EXECUTION.md`, le cahier des charges et ce document ;
- identifier précisément routes, services, tables, tests et permissions du périmètre ;
- limiter les lectures et changements aux fichiers nécessaires ;
- pas de dépendance, migration, refonte ou changement de fournisseur sans justification et autorisation ;
- ne jamais modifier `main`, la base ou la production sans accord explicite ;
- mettre à jour le suivi et la fiche de reprise après toute intervention significative.
