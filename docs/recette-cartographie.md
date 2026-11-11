# Recette du module « Cartographie » — étape 6 (à dérouler chez vous)

Version du 4 novembre 2026. Chaque ligne a un résultat attendu vérifiable. Statuts à inscrire : Validé / Échec / Non testé (avec la raison). Ne rien marquer « Validé » sans l'avoir fait.

## 0. Préparation (base jetable, jamais la production)
| # | Action | Attendu | Résultat |
|---|---|---|---|
| 0.1 | `npm install` | Aucune erreur ; `express` et `pg` installés | |
| 0.2 | `DATABASE_URL_TEST=postgresql://… npm test` | 0 échec. Si `geo-db.test.js` ou `securite.test.js` échoue : défaut à corriger avant la suite | |
| 0.3 | `npm run migrate` sur une copie de la base | Migration 020 appliquée ; table `ika_listing_geo` créée ; relancer = aucun changement | |
| 0.4 | Sauvegarde, puis `scripts/rollback/020_listing_geo_down.sql`, puis `npm run migrate` | Table supprimée puis recréée ; annonces intactes | |
| 0.5 | `npm run stamp-sw -- --check` | « version à jour » | |

## 1. Ordinateur (Chrome et Firefox)
| # | Scénario | Attendu |
|---|---|---|
| 1.1 | Compte A, annonce de type Terrain, menu « Mes annonces » → « Localiser » | Écran `#/localiser/:id` ; plan avec « Carreaux : … m » |
| 1.2 | 4 appuis en carré d'environ 100 m, « Enregistrer » | Message « Localisation enregistrée » ; mesure serveur ≈ 10 000 m² (1 ha), périmètre ≈ 400 m ; mention « mesure indicative, ni bornage ni titre foncier » |
| 1.3 | Recharger la page | Le contour revient à l'identique |
| 1.4 | Appui sur un sommet, « Supprimer le point choisi » | Le sommet disparaît ; l'aperçu se met à jour ; bouton grisé sans sommet choisi |
| 1.5 | Faire croiser le contour (nœud papillon) | Message « Le contour se croise » ; enregistrement refusé |
| 1.6 | Moins de 3 points, « Enregistrer » | Refus avec message clair |
| 1.7 | Saisie à la main de coordonnées valides, puis invalides (« abc », 95, 200) | Valides ajoutées ; invalides refusées avec message |
| 1.8 | « Fiche imprimable (PDF) », puis Imprimer / enregistrer en PDF | Une page A4 ; mention obligatoire, plan numéroté, échelle, nord, superficie du serveur, date |
| 1.9 | Menu « Ma carte » (`#/carte`) | Biens localisés, indicateurs (biens localisés, terrains délimités, maisons, superficie cumulée), filtre par type |
| 1.10 | Supprimer la localisation (confirmation demandée) | Retour à « Mes annonces » ; la fiche répond 404 ensuite |

## 2. Confidentialité et droits (le plus important)
| # | Scénario | Attendu |
|---|---|---|
| 2.1 | Annonce publiée, position NON publique : visiteur déconnecté ouvre l'annonce et `GET /api/listings/:id/geo` | Aucun bloc « Localisation » ; réponse `{ "geo": null }` |
| 2.2 | Cocher « Afficher la position exacte », enregistrer | Le bloc « Localisation » apparaît sur l'annonce publique |
| 2.3 | Repasser l'annonce en brouillon ou non publiée, position publique | Visiteur : `{ "geo": null }` |
| 2.4 | Compte B (autre compte) : `GET/POST /api/me/listings/<id de A>/geo`, `/geo/delete`, `/fiche` | 404 dans les trois cas ; rien modifié |
| 2.5 | Compte restreint : POST géo | Refusé |
| 2.6 | Personnel (modération) : `GET /api/staff/listings/:id/geo` | Lecture seule ; POST impossible |
| 2.7 | Envoyer une `areaM2` truquée dans le corps | Ignorée ; mesure recalculée par le serveur |
| 2.8 | 61 enregistrements en moins d'une heure | Le 61e est refusé (limite 60/heure) |
| 2.9 | Journal d'audit | `GEO_SAVE` et `GEO_DELETE` présents avec le bon compte |
| 2.10 | Export des données et suppression de compte (droits) | Export contient les localisations ; suppression efface aussi celles des annonces archivées |
| 2.11 | En-têtes : `Permissions-Policy: geolocation=(self)` ; CSP inchangée | Aucune ressource externe chargée (onglet Réseau) |

## 3. Téléphone réel (Android, connexion mobile faible)
| # | Scénario | Attendu |
|---|---|---|
| 3.1 | « Ma position GPS » à l'air libre | Autorisation demandée une seule fois ; point ajouté ; précision affichée |
| 3.2 | Précision > 25 m | Avertissement d'attendre et de recommencer |
| 3.3 | GPS refusé dans le navigateur | Message d'erreur clair ; saisie manuelle possible |
| 3.4 | Poser 4 points en marchant autour d'une parcelle connue | Superficie cohérente avec la réalité à la précision du GPS près |
| 3.5 | Appui, glissement d'un sommet, sélection puis suppression au doigt | Cibles assez grandes ; pas de déplacement involontaire du plan |
| 3.6 | Mode avion après chargement | Écran et plan s'ouvrent ; l'API de position n'est PAS servie depuis le cache hors connexion |
| 3.7 | Lecteur d'écran (TalkBack) sur l'écran de localisation | Boutons nommés ; informations lues (aria-live) ; le plan SVG a un libellé |
| 3.8 | Fiche ouverte puis « Enregistrer en PDF » | Lisible sur téléphone |

## 3 bis. Fond de carte Mapbox (seulement après dépôt des fichiers dans `public/vendor/` et `MAPBOX_TOKEN` posé)
| # | Scénario | Attendu |
|---|---|---|
| 3b.1 | Sans `MAPBOX_TOKEN` : ouvrir l'écran de localisation | Plan métrique local ; CSP d'origine (aucune adresse externe) |
| 3b.2 | Avec jeton valide et fichiers présents | Fond « rues » ; couches (contour, sommets numérotés) visibles ; aucune erreur CSP dans la console |
| 3b.3 | Bascule satellite | Le fond change ; le contour et les sommets restent affichés |
| 3b.4 | Poser, choisir, supprimer, glisser un sommet à la souris puis au doigt | Mêmes résultats qu'au plan local ; le fond ne bouge pas pendant qu'on glisse un sommet |
| 3b.5 | Jeton invalide, ou jeton restreint à une autre adresse | Repli automatique sur le plan local, sans message d'erreur bloquant |
| 3b.6 | Retirer un des deux fichiers de `public/vendor/` | Repli automatique sur le plan local |
| 3b.7 | Mode avion | Plan local (le fond Mapbox n'est pas gardé hors connexion) |
| 3b.8 | Superficie après enregistrement | Identique à celle du plan local pour les mêmes points (mesure du serveur) |
| 3b.9 | Onglet Réseau | Seules les adresses `api.mapbox.com` et `events.mapbox.com` sont contactées, en plus du site |
| 3b.10 | `npm run check-env` avec un jeton `sk.` | Bloquant `MAPBOX_JETON` |

## 4. Régression
| # | Scénario | Attendu |
|---|---|---|
| 4.1 | Parcours existant : inscription → publier → approuver → voir → commenter → bloquer | Identique à avant |
| 4.2 | Recherche, filtres, alertes, messagerie | Inchangés |
| 4.3 | Budget de poids et accessibilité automatique (`scripts/verification/a11y.mjs`) | Aucun dépassement ; 0 problème, mode clair et sombre |

## 5. À consigner pour chaque ligne
Date, environnement (navigateur, téléphone, version), résultat réel, preuve (capture, sortie de commande). Les défauts vont dans le suivi, section anomalies.

## 6. Bloquants hors recette (décisions du propriétaire)
- Texte exact de la mention obligatoire de la fiche (`MENTION_OBLIGATOIRE`, `server/lib/fiche.js`).
- Page imprimable actuelle ou PDF généré côté serveur.
- Mapbox (étape 4 bis) : jeton, CSP, fichiers dans `public/vendor/`, licence et coûts.
- PostGIS en production.
- Filtre de recherche par zone de carte : règle de confidentialité à fixer (voir `SUIVI.md`).
