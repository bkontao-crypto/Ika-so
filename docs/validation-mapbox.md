# Validation technique de l'intégration Mapbox — rapport du 4 novembre 2026

Environnement de cette validation : conteneur sans réseau, sans PostgreSQL, sans Render, sans la bibliothèque Mapbox GL JS, avec le substitut d'Express du projet (`scripts/verification/fake-express`, copie jetable non livrée). **Aucun point ci-dessous n'est marqué « Validé » s'il n'a pas été exécuté avec les vrais composants.**

| # | Exigence | Statut | Résultat réel |
|---|---|---|---|
| 1 | Dépendances dans un environnement propre | **Non exécuté** | `npm install` impossible (réseau coupé). `express` et `pg` jamais installés ici. |
| 2 | Les 181 tests, six échecs résolus | **Partiel** | Les 6 échecs étaient « paquet express introuvable » (environnement). Avec le substitut d'Express : 210 tests, 209 réussis, 0 échec, 1 ignoré. Pas une preuve avec le vrai `express`. Les tests qui exigent `DATABASE_URL_TEST` (`geo-db`, `securite`, etc.) n'ont pas tourné. |
| 3 | `GET /api/config/map` sans secret | **Réussi avec le substitut** | `test/config-map.test.js` 3/3 : sans jeton `{ "mapbox": null }` ; jeton `pk.` → exactement `{ "mapbox": { "token" } }` ; `sk.`, `tk.`, jeton court ou texte quelconque → `null` et jamais renvoyé ; aucun des 7 secrets de configuration injectés (base, SMS, e-mail, paiements, e-mail administrateur) n'apparaît dans le corps ni les en-têtes ; `Cache-Control: no-store`. **Défaut trouvé et corrigé** : la route plantait (500, « config is not defined »), `buildRoutes` ne recevait pas `config`. À reconfirmer avec le vrai Express. |
| 4 | CSP avec Mapbox réellement chargé | **Non exécuté** | Seulement : texte de la CSP testé (sans jeton = d'origine ; avec jeton = `api.mapbox.com`, `events.mapbox.com`, `blob:`) et comportement contre un faux Mapbox. Tuiles, styles, images, workers réels : jamais observés. |
| 5 | Render et local | **Non exécuté** | Aucun accès à Render ni à une pile réelle. |
| 6 | Carte réelle, classique et satellite | **Non exécuté** | Bibliothèque absente. Bascule testée uniquement contre le faux Mapbox. |
| 7 | Marqueur GPS sur une propriété | **Non exécuté** | Pas de vrai GPS ni de vraie carte. Repère testé contre le faux Mapbox et sur le plan local (composant seul). |
| 8 | Terrain à 4 sommets, modification, enregistrement | **Partiel** | Dessin, sélection, suppression et glissement de sommets : Chromium, plan local (14/14) et faux Mapbox (23/23). Enregistrement réel : non exécuté (pas de base). |
| 9 | Persistance après reconnexion | **Non exécuté** | `test/geo-db.test.js` écrit, jamais lancé. |
| 10 | Permissions et isolation entre deux comptes | **Non exécuté sur base réelle** | Logique d'accès testée avec une base **simulée** (`geo-service.test.js`). Isolation SQL A/B : non exécutée. |
| 11 | Erreurs de jeton, refus GPS, connexion | **Partiel** | Jeton invalide ou secret : rejet côté serveur testé ; repli sur le plan local testé contre le faux Mapbox (jeton refusé, bibliothèque absente). Refus GPS et coupure réseau réels : non testés. |
| 12 | `SUIVI.md` | Fait | Voir l'entrée du 4 novembre 2026. |

## Ce que vous demandez de voir avant validation définitive
Une carte réelle de Bamako, un marqueur sur un terrain, un polygone autour d'une parcelle, une superficie calculée, une sauvegarde effective dans PostgreSQL, la parcelle retrouvée après reconnexion : **rien de cela n'a pu être produit ici**. Le calcul de superficie est la seule partie démontrée (serveur, contre une intégration numérique indépendante, écart < 1 ppm ; carré de 100 m = 10 000 m²).

⚠ **PostGIS** : l'implémentation stocke le polygone en GeoJSON `jsonb` (décision par défaut de l'étape 1). PostGIS n'est pas utilisé ; le script facultatif `scripts/postgis-optionnel.sql` est non testé. Si « PostgreSQL/PostGIS » est une exigence, c'est une décision à confirmer.

## À exécuter chez vous, dans l'ordre
1. `npm install` ; générer `package-lock.json`.
2. Base jetable : `DATABASE_URL_TEST=postgresql://… npm test` → noter chaque échec (priorité : `geo-db`, `securite`).
3. `npm run migrate` sur une copie ; poser `MAPBOX_TOKEN` (jeton `pk.` restreint à l'adresse du site) ; déposer `mapbox-gl.js` et `.css` dans `public/vendor/` (voir `public/vendor/LISEZMOI.md`).
4. `curl -s http://localhost:8080/api/config/map` → seulement le jeton `pk.`.
5. Ouvrir la console du navigateur sur `#/localiser/<id>` : aucune erreur CSP ; onglet Réseau : seules les adresses du site, `api.mapbox.com`, `events.mapbox.com`.
6. Dérouler `docs/recette-cartographie.md` (sections 1, 2, 3, 3 bis) avec deux comptes, en joignant captures et sorties.
7. Répéter sur Render avec les mêmes scénarios.

## Anomalies et réserves restantes
- **Corrigée** : route `GET /api/config/map` en erreur 500 (périmètre `config`). Les archives livrées plus tôt dans cette conversation (`…mapbox_serveur.zip`, `…mapbox_fournisseur.zip`) contiennent ce défaut ; utiliser l'archive de ce rapport.
- Vrai `express` et vrai `pg` : jamais exécutés. SQL de la cartographie et migration 020 : jamais exécutés.
- Bibliothèque Mapbox GL JS absente ; `mapbox.js` écrit d'après l'API documentée, vérifié seulement contre une fausse bibliothèque.
- Jeton Mapbox transmis dans une conversation : à restreindre par adresse (ou à remplacer).
- Mention obligatoire de la fiche à valider ; choix page imprimable ou PDF serveur ; licence et coûts Mapbox ; PostGIS en production ; filtre par zone (règle de confidentialité) : décisions du propriétaire.
