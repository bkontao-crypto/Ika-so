# Rapport technique — fusion IKA SO ÉTAPE 1 + ÉTAPE 2 (14 novembre 2026)

## Constat
- ÉTAPE 1 : projet complet (339 fichiers, package v0.2.0, migrations 001 à 058).
- ÉTAPE 2 : livraison partielle (41 fichiers de code, migrations 059 à 064, 32 rapports) construite sur l'ÉTAPE 1. 9 fichiers existent dans les deux archives ; le routeur de l'ÉTAPE 2 conserve les 249 routes d'origine et en ajoute 23.
- Méthode : base ÉTAPE 1 + fichiers ÉTAPE 2 par-dessus, après relecture des différences. Les archives d'origine servent de version de référence.

## Corrections faites pendant la fusion
Voir IKA_SO_Fusion_Suivi.xlsx (FUS-01 à FUS-08). Les plus importantes :
1. Migrations 059–064 : types uuid incompatibles avec ika_users/ika_listings (text).
2. createOwnerDelegations appelé sans accounts.
3. db.query renvoie un tableau : les 4 nouveaux services lisaient `{ rows }`.
4. Routes /staff/superadmin-settings et /staff/moderation-audit sans contrôle de rôle.
5. Matrice des droits Owner Center complétée (test etape1-docs).
6. components.css lié dans index/admin/owner ; cache hors-ligne recalculé.

## Second passage : anomalies A-02 à A-05 (FUS-09 à FUS-12)
- A-02 : cause réelle = route en double ajoutée par l'ÉTAPE 2 devant la route ÉTAPE 1 qui fonctionnait ; doublon supprimé.
- A-03 : signature HMAC du webhook WhatsApp (401 si invalide, 503 sans WHATSAPP_APP_SECRET), jeton GET non vide exigé, configuration WHATSAPP_* ajoutée (config.js, .env.example).
- A-05 : réglages publics en liste blanche (titre, sous-titre, modules, couleurs hexadécimales).
- A-04 : faux test supprimé, 7 vrais tests ajoutés. Suite : 135 tests, 132 réussis, 0 échec, 3 ignorés.
- A-08 (routes non testées) : 8 tests de routes ajoutés avec un mini routeur de test (test/helpers/express-stub.mjs). Essai de régression : en retirant une garde, 2 tests échouent. Suite : 143 tests, 140 réussis, 0 échec, 3 ignorés. Ce n'est pas le vrai Express : à rejouer après `npm install`.

## Tests
Exécuté : syntaxe, imports, comparaison des routes, suite complète (140 réussis, 0 échec, 3 ignorés), cache hors-ligne.
Non exécuté : migrations sur PostgreSQL, démarrage serveur, intégration PG, navigateur, Mapbox, WhatsApp, paiements réels.

## Anomalies restantes
A-01, A-06 et A-07 dans le fichier Excel (feuille « Anomalies restantes »), dont la délégation ADMIN encore bloquée.

## Déploiement et vérification
1. Sauvegarder la base et garder les deux archives d'origine.
2. Sur une copie : `npm install`, renseigner `.env` (pas de secret dans le code ; WhatsApp : WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET), `npm run migrate` ; vérifier que 059 à 064 s'appliquent.
3. `npm test` puis `npm run test:integration` avec une base PostgreSQL de test.
4. `npm start`, ouvrir http://localhost:8080 ; vérifier avec un SUPERADMIN, un ADMIN et un utilisateur : /staff/superadmin-settings, /staff/moderation-audit, /me/crm/leads, /me/properties.
5. Contrôle visuel des pages accueil, annonceur, admin-settings, admin-audit, crm-leads (desktop, tablette, mobile).
6. Retour arrière des migrations : docs/FUSION/ANNULATION_MIGRATIONS_059_064.sql.
