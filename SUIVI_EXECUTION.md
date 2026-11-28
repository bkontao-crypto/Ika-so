# SUIVI D’EXÉCUTION — IKA SÔ

- Version : 1.0 — 27 novembre 2026
- Référence audit : branche `main`, commit `734dd2910da9ccce23112bdc09d960b49512a6c0`
- Portée : état du code et des preuves accessibles dans GitHub ; aucune vérification de production n'est revendiquée ici.

## 1. Légende obligatoire

- **TERMINÉ ET VÉRIFIÉ** : implémentation et vérifications adaptées démontrées par des preuves.
- **RÉALISÉ NON VÉRIFIÉ** : éléments présents, mais parcours complet ou conditions réelles non vérifiés.
- **EN COURS** : travail commencé, éléments incomplets.
- **BLOQUÉ** : dépend d'un prérequis, d'un fournisseur, d'une validation ou d'une décision.
- **À FAIRE** : non identifié comme réalisé ou non commencé.

Ne pas attribuer le statut TERMINÉ ET VÉRIFIÉ à partir d'une simple présence de route, d'écran, de migration ou d'un test isolé.

## 2. État de référence

| Élément | Statut | Preuve / limite |
|---|---|---|
| Suite de tests CI du commit de référence | TERMINÉ ET VÉRIFIÉ | GitHub Actions : 565 réussis, 0 échec, 0 ignoré ; PostgreSQL 16 en service de test |
| Installation CI et contrôle Service Worker | TERMINÉ ET VÉRIFIÉ | Étapes correspondantes du workflow du commit |
| Architecture serveur/API et migrations | TERMINÉ ET VÉRIFIÉ | Inspection du dépôt : Express 5, PostgreSQL, 95 migrations, routes et services |
| Market / annonces | RÉALISÉ NON VÉRIFIÉ | Annonces, recherche, filtres, brouillons, photos, favoris, modération, historique des prix et SEO identifiés ; parcours production non vérifié |
| Durées de publication / expirations d'annonces | RÉALISÉ NON VÉRIFIÉ | Branche `feature/expiration-annonces` (non fusionnée) : migration 096, service, tâche, routes, interfaces ; 21 tests ciblés réussis en local, suite complète et PostgreSQL non exécutés (voir journal) |
| Map | RÉALISÉ NON VÉRIFIÉ | Mapbox et solution de secours identifiés ; couverture, quotas et usage réel à valider |
| Trust / vérification | RÉALISÉ NON VÉRIFIÉ | Justificatifs, demandes, historique et signalements présents ; audit complet des parcours et accès à poursuivre |
| Comptes et profils | RÉALISÉ NON VÉRIFIÉ | E-mail/mot de passe, Google, vérification téléphone et demandes annonceurs identifiés ; Facebook/X et connexion autonome par téléphone non confirmés |
| Réseau communautaire | RÉALISÉ NON VÉRIFIÉ | Publications, réactions, commentaires, abonnés/abonnements identifiés ; recette de bout en bout à poursuivre |
| Messagerie interne | RÉALISÉ NON VÉRIFIÉ | Messages texte, conversations, lecture, blocage et signalement ; pièces jointes et vocaux non identifiés |
| Mes alertes | RÉALISÉ NON VÉRIFIÉ | Programmation, dates, pause, prolongation et notifications identifiées ; boost payant indisponible (« Bientôt disponible ») |
| IKA SÔ Pro / CRM | RÉALISÉ NON VÉRIFIÉ | Leads, pipeline, scoring, équipes et statistiques identifiés ; isolation multi-organisation et parcours complets à valider |
| Owner Center | RÉALISÉ NON VÉRIFIÉ | Gestion et tableaux de bord présents ; recette locale récente documentée dans `Important/SUIVI.md`, production non vérifiée |
| Observatoire du site (`#/observatory`) | RÉALISÉ NON VÉRIFIÉ | Lecture seule, Super Administrateur ; recette locale avec données fictives (voir journal) ; production et gros volumes non vérifiés |
| Superadmin / permissions | RÉALISÉ NON VÉRIFIÉ | Gestion des comptes, permissions, délégations et espaces Superadmin identifiés ; contrôle exhaustif des droits à poursuivre |
| MFA | EN COURS | TOTP, codes de secours et canaux e-mail/SMS selon configuration ; récupération Superadmin à finaliser |
| Premium / paiements | EN COURS | Demandes, décisions, remboursements et socle fournisseur identifiés ; fournisseurs et paiements réels non vérifiés |
| Analytics | EN COURS | Événements et tableaux de bord présents ; identifiants visiteurs/sessions nuls et désaccord sur activation par défaut |
| Location / transaction complète | À FAIRE | Demandes de visite présentes ; cycle complet de location/transaction non démontré |
| IKA SÔ Invest | À FAIRE | Module métier dédié non identifié |
| IKA SÔ Intelligence | À FAIRE | Assistant immobilier IA dédié non identifié |
| Production Render / Neon | BLOQUÉ | Accès aux configurations, secrets et journaux de production non disponible dans cet audit |
| Sauvegarde et restauration de production | BLOQUÉ | Procédures décrites, mais exécution réelle et restauration prouvée non disponibles |

## 3. Anomalies et risques à traiter

| Priorité | Constat | Action attendue |
|---|---|---|
| Critique avant activation Analytics | Valeur par défaut de collecte possiblement différente entre code et documentation | Comparer le code actuel, corriger l'interrupteur et aligner consentement/documents avant activation |
| Haute | Récupération MFA Superadmin inachevée | Définir et tester récupération, codes de secours, verrouillage et journalisation |
| Haute | Sauvegardes hors serveur/restauration non prouvées | Exécuter sauvegarde chiffrée et restauration sur base jetable ; consigner les preuves |
| Haute (avant fusion des expirations) | Contrôle Service Worker : des fichiers de `public/` ont changé sans `npm run stamp-sw` ; `server/lib/retention.js` purge encore les annonces expirées/archivées après 12 mois | Lancer `npm run stamp-sw` ; décider du sort de `retention.js` (décision du propriétaire) |
| Moyenne | Test de nettoyage `stored_files` : `content_type` au lieu de `mime_type`, erreur absorbée | Corriger le nettoyage et ajouter une assertion garantissant l'absence de fichiers résiduels |
| Moyenne | Documents historiques périmés ou contradictoires | Conserver les historiques, dater les en-têtes et pointer vers les référentiels canoniques |
| Moyenne | Facebook/X et pièces jointes/vocaux de messagerie non confirmés | Confirmer exigences, puis implémenter/tester seulement si validé |
| Moyenne | Visiteurs uniques et sessions indisponibles tant que les identifiants sont nuls | Ne pas afficher ces indicateurs comme réels ; valider juridiquement le dispositif |
| Moyenne | Boost d'alerte non disponible | Garder masqué ou clairement indisponible jusqu'à parcours de paiement complet |

## 4. Tests et vérifications connus

### Vérifiés dans CI au commit de référence
- 565 tests réussis ;
- 0 échec ;
- 0 test ignoré ;
- durée d'environ 42 secondes ;
- installation `npm ci` réussie ;
- contrôle Service Worker réussi ;
- PostgreSQL 16 utilisé pour les tests.

Workflow : [GitHub Actions — exécution 45983243122](https://github.com/bkontao-crypto/Ika-so/actions/runs/45983243122).

### Vérifications locales documentées dans le suivi existant
`Important/SUIVI.md` rapporte notamment :
- recette de l'Owner Center sur environnement local avec Chromium et PostgreSQL ;
- contrôles clair/sombre et responsive sur les écrans concernés ;
- tests de régression 565/565 pour la fusion Owner Center du 27 novembre ;
- tests de régression et contrôles visuels sur les lots de design précédents.

Ces preuves sont des comptes rendus consignés dans le dépôt ; elles ne remplacent pas une recette indépendante de la production.

### Non vérifiés dans le présent audit
- site Render réellement accessible et stable ;
- variables et secrets de production ;
- appels réels SMS, e-mail, WhatsApp, paiements et Mapbox ;
- persistance des fichiers après redémarrage ;
- restauration réelle de sauvegarde ;
- parcours réels sur appareils mobiles ;
- conformité juridique finale et validation APDP.

## 5. Référentiels et historique

- Ordonnance détaillée : `docs/ordonnance/IKA_SO_CAHIER_ORDONNANCE_TRANSFORMATION_AGENT_IA.txt`.
- Ancien suivi détaillé : `Important/SUIVI.md` (historique conservé ; son en-tête doit être harmonisé avec les entrées récentes).
- Architecture Analytics : `Important/ARCHITECTURE_ANALYTICS.md`.
- Exploitation : `docs/exploitation.md`.
- Expirations d'annonces : `docs/EXPIRATIONS_ANNONCES.md` (périmètre, décisions, retour arrière, tests).
- Ancienne fiche de reprise : `Dossier_Suivi/ETAT_REPRISE_AGENT.md`.

Ne pas supprimer les historiques. Les référentiels à la racine deviennent les documents actifs de pilotage.

## 6. Prochaines tâches recommandées

1. **VALIDER** les expirations d'annonces : lancer `npm run stamp-sw`, `npm test` (CI avec PostgreSQL 16), puis recette locale (voir `docs/EXPIRATIONS_ANNONCES.md` §7), avant toute fusion.
2. **AUDITER** le code Analytics ciblé : variable d'activation, middleware, routes, consentement et tests. Aucun changement avant rapport et autorisation.
3. **CORRIGER** le test de nettoyage des fichiers, après confirmation du schéma exact et sur branche dédiée.
4. **VALIDER** le parcours MFA Superadmin et documenter le mécanisme de récupération.
5. **VALIDER** la sauvegarde chiffrée hors serveur et une restauration sur base jetable.
6. **RECETTER** les parcours prioritaires de bout en bout sur un environnement de préproduction.
7. **PRÉPARER** la vérification Render/Neon avec le propriétaire, sans exposer de secrets dans les documents.

## 7. Journal des mises à jour documentaires

- 28 novembre 2026 : **RÉALISÉ, NON VÉRIFIÉ (suite complète, PostgreSQL, navigateur)** — durées de publication et expirations d'annonces, sur la branche `feature/expiration-annonces` (non fusionnée, autorisation de développement donnée par le propriétaire le 28/11). Migration `096_expiration_annonces.sql` (additive : `starts_at`, `expired_at`, `archived_at`, `archived_mode`, statut `SCHEDULED`, tables `ika_listing_events` et `ika_expiry_warnings`) ; `server/lib/expiry.js`, `server/services/listing-expiry.js`, `server/routes/expirations.js` (montées dans `server/app.js`), tâche chaque minute dans `server/index.js` ; `moderation.js` (début programmé, date de fin conservée) ; `listings.js` (favoris et commentaires refusent une annonce échue) ; interfaces : `public/js/components/expiry-alert.js`, `public/js/pages/account.js`, `public/js/pages/publish.js`, `public/js/app.js`, `public/js/owner/v-expirations.js`, `public/js/owner/main.js`. Tests exécutés en local : `test/expiry-rules.test.js` 10/10 sur le fichier exact ; `test/listing-expiry.test.js` 11/11 sur une copie allégée du service (SQL abrégé, même logique), non rejoué sur le fichier exact. Non exécutés : `npm test` complet, `npm run stamp-sw:check`, migration sur PostgreSQL, parcours navigateur mobile/ordinateur, redémarrage serveur réel. Risques : voir `docs/EXPIRATIONS_ANNONCES.md` §6. `CAHIER_DES_CHARGES.md` et `ARCHITECTURE_TECHNIQUE.md` pas encore mis à jour.
- 27 novembre 2026 : revue finale des quatre référentiels sur la branche `docs/referentiels-projet-ika-so`. Correction de la règle métier des alertes à portée globale lorsque la zone est vide ; clarification du niveau de preuve de l'architecture ; actualisation de la fiche de reprise. Modifications documentaires uniquement. Aucun test applicatif relancé, aucun code métier, migration, base de données ou déploiement modifié.
- 27 novembre 2026 (soir) : **RÉALISÉ, NON VÉRIFIÉ EN PRODUCTION** — refonte de la fiche annonce selon la maquette fournie (galerie mosaïque + signet favori, onglets Détails / Localisation / Galerie, tuiles de caractéristiques, barre fixe « Prix / Programmer une visite »). Fichiers : `public/js/pages/listing.js`, `public/css/fiche-annonce.css` (nouveau), `public/index.html`, `public/sw.js`, `public/js/app.js`. Bouton « Retour » de la maquette volontairement omis (décision du 16/11). Vérifs : `npm test` 540 réussis / 0 échec ; captures Playwright mobile 390 px et bureau 1280 px avec API simulée, aucune erreur JS. Reste : contrôle visuel sur https://ika-so.onrender.com.

- 27 novembre 2026 : fusion de `feature/observatoire` (`f688d9e`) dans `main` (base `3e7a5fa`), sur accord du propriétaire, sans conflit ni migration. Fichiers : `server/services/observatory.js`, `public/js/owner/v-observatory.js`, `public/css/owner-observatory.css`, `test/observatory.test.js`, routes, services, menu, matrice des droits (45 segments). `npm test` : 570 réussis, 0 échec sur le code fusionné ; contrôle Service Worker réussi. Recette Chromium sur la branche (données fictives) : détail dans `Important/SUIVI.md`. Non vérifiés : production, performance sur gros volumes, vrais téléphones. Aucun réglage de collecte modifié. Retour arrière : `git revert -m 1 <commit de fusion>`.

## 8. Règles de mise à jour

À chaque intervention significative :
- ajouter date, périmètre, branche et commit ;
- indiquer fichiers modifiés et migrations éventuelles ;
- inscrire commandes exactes et résultats ;
- séparer réussis, échoués et non exécutés ;
- citer les preuves disponibles ;
- mettre à jour `ETAT_REPRISE_AGENT.md` ;
- ne jamais transformer une hypothèse en fait vérifié.
