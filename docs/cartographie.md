# Module « Cartographie immobilière » — état au 4 novembre 2026 (étapes 4 partielle et 5)

Cahier des charges : v1.1 du 4 novembre 2026. Ce document dit **ce qui est fait, ce qui est prouvé, ce qui reste** (étapes 1 à 3 sur 6 ; étape 4 faite sans fond de carte, étape 5 faite, voir plus bas).

## Décisions prises par défaut (à confirmer ou corriger)
Les cinq questions posées n'ont pas reçu de réponse précise ; l'ordre « commencez selon la règle du métier » a été appliqué avec les choix les plus prudents :
1. **Aucune dépendance ajoutée** (le projet n'a que `express` et `pg`). Le calcul géométrique est écrit dans `server/lib/geo.js`.
2. **PostGIS non requis.** Le polygone est un GeoJSON en `jsonb`. Un script facultatif et NON TESTÉ ajoute PostGIS : `scripts/postgis-optionnel.sql`.
3. **Droits = ceux de l'existant** : le propriétaire de l'annonce gère la localisation de ses annonces ; le personnel peut lire ; aucun système de droits parallèle.
4. **Position exacte privée par défaut.** Aujourd'hui l'annonce publique n'affiche que le centre du quartier ; une position exacte n'est visible que si l'annonceur la rend publique ET que l'annonce est publiée et visible.
5. **Mapbox, CSP, PDF : pas encore touchés** (étapes 4 et 5). La CSP « aucune ressource externe » et ses deux tests sont intacts.

## Fichiers créés
| Fichier | Rôle |
|---|---|
| `migrations/020_listing_geo.sql` | Table `ika_listing_geo` (1 ligne par annonce, supprimée avec elle). Additive : rien d'existant n'est modifié. |
| `scripts/rollback/020_listing_geo_down.sql` | Retour arrière (supprime la table et son enregistrement dans `_migrations`). Sauvegarde d'abord. |
| `scripts/postgis-optionnel.sql` | Option PostGIS + requête de contrôle croisé des superficies. Non testé. |
| `server/lib/geo.js` | Validation et calcul (superficie, périmètre, centre). Méthode documentée en tête du fichier. |
| `server/services/geo.js` | Accès, enregistrement, suppression, indicateurs. |
| `test/geo.test.js`, `test/geo-service.test.js`, `test/geo-db.test.js` | Tests (voir plus bas). |

## Fichiers modifiés (justification)
| Fichier | Modification |
|---|---|
| `server/services/index.js` | Branche le service `geo`. |
| `server/routes/index.js` | Ajoute 6 routes (ci-dessous), rien d'existant changé. |
| `server/services/rights.js` | Suppression de compte : efface aussi les positions des annonces archivées pour la comptabilité ; export des données : inclut les localisations. |
| `test/securite.test.js` | `GET /listings/:id/geo` ajoutée à la liste des routes publiques (elle répond `{ geo: null }` sauf choix de l'annonceur). |

## Routes et règles
| Route | Qui | Règle |
|---|---|---|
| `GET /api/listings/:id/geo` | tout le monde | `{ geo: null }` sauf position publique d'une annonce publiée et visible |
| `GET /api/me/geo?category=` | connecté | ses biens localisés + indicateurs (biens localisés, terrains délimités, maisons, superficie cumulée) |
| `GET /api/me/listings/:id/geo` | propriétaire | 404 si l'annonce n'est pas à lui |
| `POST /api/me/listings/:id/geo` | propriétaire, compte non restreint | corps `{ point?, polygon?, isPublic? }` ; 60 écritures par heure |
| `POST /api/me/listings/:id/geo/delete` | propriétaire | corps `{ confirm: true }` obligatoire |
| `GET /api/staff/listings/:id/geo` | modération et plus | lecture seule |

Corps d'écriture : `point = { lat, lng }` (WGS84), `polygon` = GeoJSON `Polygon` (un seul contour, `[lng, lat]`). Au moins l'un des deux ; sans point, le centre du polygone sert de repère. **La superficie et le périmètre envoyés par le navigateur sont ignorés** : ils sont toujours recalculés par le serveur. Chaque écriture et suppression est inscrite au journal (`GEO_SAVE`, `GEO_DELETE`), dans la même transaction.

## Validation de la géométrie
Refusés (400, message en français) : moins de 3 sommets distincts, sommets consécutifs identiques, sommets alignés (surface nulle), contour qui se croise ou pointe, trou ou contours multiples, coordonnées hors bornes ou non numériques, plus de 500 sommets, contour de plus de 0,5° d'étendue, point (0, 0). Un contour non fermé est fermé automatiquement ; le contour enregistré est antihoraire (RFC 7946) et arrondi à 7 décimales (≈ 1 cm).

## Méthode de calcul
Superficie : projection équivalente sur l'ellipsoïde WGS84 (latitude authalique), formule du lacet ; périmètre : côtés avec rayons de courbure locaux. Aucun pixel d'écran. Résultats en m², hectares (m² ÷ 10 000) et mètres, arrondis à 2 décimales (hectares : 4). Précision attendue pour une parcelle : bien meilleure que 0,01 %, vérifiée ci-dessous. Détails : en-tête de `server/lib/geo.js`.

## Rapport de tests (4 novembre 2026)
| Contrôle | Résultat | Preuve |
|---|---|---|
| Superficie contre intégration numérique indépendante (cellule 1° × 1° et 0,01° à Bamako) | PASS | `test/geo.test.js`, écart < 1 ppm |
| Carré de 100 m construit en mètres : 10 000 m², 400 m, 1 ha | PASS | écart < 0,01 % |
| Invariance sens de parcours, point de départ, passage du méridien ±180° | PASS | `test/geo.test.js` |
| Rejets : <3 sommets, doublons, alignés, croisé, pointe, trou, hors bornes, NaN, 600 sommets, trop étendu | PASS | `test/geo.test.js` |
| Logique d'accès, validation avant base, mesures recalculées côté serveur, journal, confirmation de suppression (base **simulée**) | PASS | `test/geo-service.test.js` |
| Suite existante (routes, web, règles, budget « aucun CDN ») avec le substitut d'Express du projet | PASS (61/61) | exécutée sur copie temporaire |
| **SQL réel, persistance, isolation entre comptes A/B, confidentialité publique, cascade** | **NON EXÉCUTÉ** | `test/geo-db.test.js` écrit mais jamais lancé : aucun PostgreSQL dans l'environnement de livraison |
| Audit de sécurité des routes (`test/securite.test.js`, base requise) | **NON EXÉCUTÉ** | idem |
| Migration 020 sur base réelle | **NON EXÉCUTÉ** | idem |

À faire chez vous, avant toute suite : `DATABASE_URL_TEST=postgresql://… npm test` (base jetable). Si `geo-db.test.js` ou `securite.test.js` échoue, ce sont les premiers défauts à corriger.

## Étape 4 (partielle) — interface sans fond de carte externe
**Choix : aucune ressource externe, CSP inchangée.** Mapbox n'est pas branché : le jeton, la décision CSP et les fichiers à héberger manquent encore. À la place, un plan métrique intégré (grille en SVG, « Carreaux : 50 m ») permet déjà de localiser et de délimiter un bien, y compris sans réseau mobile fiable.

| Élément | Rôle |
|---|---|
| `public/js/map/provider.js` | **Seul point de choix du fournisseur** (`createMap`). Les pages ne connaissent pas le fournisseur. Mapbox s'ajoutera ici, avec le même contrat que `local.js`. |
| `public/js/map/local.js` | Fournisseur « local » : appui = sommet, appui sur un sommet = le choisir puis « Supprimer le point choisi », glisser un sommet = le corriger, glisser le fond = déplacer le plan, boutons +/−, recadrage automatique. |
| `public/js/map/geometry.js` | Projection WGS84 locale, aperçu de superficie/périmètre, détection d'un contour qui se croise. Sans DOM, testé sous Node. |
| `public/js/pages/localisation.js` | Écran `#/localiser/:id` (propriétaire) et `#/carte` (mes biens localisés, indicateurs, filtre par type). |
| Modifs | `app.js` (2 routes), `chrome.js` (menu « Ma carte », pas dans la barre du bas), `account.js` (bouton « Localiser »), `listing.js` (bloc « Localisation » **seulement** si l'annonceur a rendu la position publique), `sw.js` (fichiers préchargés), `ika.css` (styles du plan). |
| `server/lib/web.js` | `Permissions-Policy` : `geolocation=()` devenait `geolocation=(self)`, sinon le bouton « Ma position GPS » est bloqué par le navigateur. Seul notre site y a accès ; la CSP n'a pas bougé. |

Règles respectées : la superficie affichée pendant le dessin est un **aperçu**, la mesure officielle est celle du serveur (affichée après l'enregistrement) ; mention « mesure indicative, ni bornage ni titre foncier » à l'écran ; position privée par défaut (case à cocher pour la rendre publique) ; l'API de position n'est jamais mise en mémoire hors connexion.

Preuves (4 novembre 2026) :
| Contrôle | Résultat | Preuve |
|---|---|---|
| Aperçu navigateur contre calcul serveur (carré de 100 m) | PASS, écart < 0,1 % | `test/geo-ui.test.js` |
| Contour croisé détecté, polygone envoyé fermé en [lng, lat], relu à l'identique, serveur accepte et ignore une superficie imposée | PASS | idem |
| Routes, préchargement, `provider.js` seul point d'accès, GPS limité au site, CSP et absence d'adresse externe | PASS | idem |
| Suite complète avec le substitut d'Express | PASS (192 réussis, 0 échec, 1 ignoré) | `npm test` sur copie temporaire |
| Budget de poids (CSS, pages ≤ 8 Ko compressés, chargement initial) | PASS | `test/budget.test.js` |
| Écran de localisation dans un vrai navigateur (Chromium, format téléphone, **API simulée**) : 4 appuis, glissement d'un sommet, annulation, position GPS simulée, enregistrement, carte d'ensemble, aucune erreur JavaScript | PASS | script jetable, non livré |
| Bloc public « Localisation » sur l'annonce | **NON VÉRIFIÉ dans un navigateur** (syntaxe seulement) | — |
| Écran avec le vrai serveur et la vraie base ; vrai GPS ; vrai téléphone, TalkBack | **NON EXÉCUTÉ** | étape 6 |

Limites connues : pas de fond de carte (ni rues, ni satellite) ; pas encore de filtre de recherche par zone de carte ; l'écran n'a pas été revu sur un petit téléphone réel.

## Étape 5 — fiche imprimable (PDF par le navigateur)
**Décision par défaut : page serveur sans dépendance** (aucune bibliothèque PDF ajoutée). L'utilisateur ouvre la fiche puis « Imprimer ou enregistrer en PDF » depuis son navigateur. Si vous préférez un vrai fichier PDF généré côté serveur, c'est un choix à reprendre (ajout d'une bibliothèque).

| Élément | Rôle |
|---|---|
| `GET /api/me/listings/:id/fiche` | Propriétaire seulement, annonce localisée seulement (404 sinon), `Cache-Control: no-store`, non indexée. Bouton « Fiche imprimable (PDF) » dans l'écran de localisation. |
| `server/lib/fiche.js` | Génère la page : mention obligatoire, plan SVG numéroté avec échelle et nord, superficie/périmètre **du serveur**, superficie déclarée, repère GPS, liste des sommets, date. Tout texte est échappé. |
| `public/css/fiche.css`, `public/js/fiche.js` | Styles (dont impression A4 sur une page) et bouton « Imprimer » : la CSP interdit styles et scripts en ligne. |
| `server/services/geo.js` | `fiche()` : contrôle d'appartenance en SQL, comme les autres méthodes. |

⛔ **Texte de la mention obligatoire à valider** : le cahier des charges v1.1 n'était pas dans l'archive, j'ai rédigé la mention (constante `MENTION_OBLIGATOIRE`, `server/lib/fiche.js`) dans l'esprit de `docs/juridique/`. Remplacez-la par le texte exact exigé.

Preuves (4 novembre 2026) : `test/fiche.test.js` (rendu, échappement, CSP, plan dans son cadre, accès propriétaire/autre compte/non localisée, route avec session et `no-store`) PASS ; suite complète 200 réussis, 0 échec, 1 ignoré ; fiche ouverte dans Chromium (aucune erreur CSP), bouton Imprimer actif, export PDF = 1 page A4. **Non exécuté** : la route avec le vrai serveur et la vraie base (`securite.test.js` l'auditera automatiquement avec une base), impression papier réelle, lecture du PDF sur téléphone.

## Reste à faire
- **Étape 4 bis (fond de carte classique et satellite)** : le serveur est prêt (variable `MAPBOX_TOKEN` de type « pk. », CSP ouverte seulement avec un jeton valide, route `GET /api/config/map`) ; le fournisseur `public/js/map/mapbox.js` et le repli automatique sont écrits et testés contre une fausse bibliothèque ; manquent les fichiers Mapbox dans `public/vendor/` (voir `public/vendor/LISEZMOI.md`) et la vérification avec la vraie bibliothèque.
  Reste d'origine : le fournisseur est isolé (`provider.js`), reste à brancher Mapbox. Bloquée par : jeton Mapbox à vous, décision CSP (ouvrir à Mapbox et adapter `web.test.js` et `budget.test.js`), fichiers Mapbox GL JS et Draw à héberger dans `public/vendor/` (réseau indisponible ici).
- **Étape 6** : recette complète sur ordinateur et mobile, jeton absent/invalide, régression. Liste prête : `docs/recette-cartographie.md` (rien n'est encore exécuté).
- Licence et coûts Mapbox à confirmer par écrit avant la production ; jeton à restreindre par domaine ; PostGIS à confirmer sur la base de production.
- Filtres de recherche avancés (zone de carte) : prévus avec l'étape 4.
