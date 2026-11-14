# RAPPORT D'ÉTAPE 5 — Carte et localisation (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.6 (en développement)  
**Base :** V0.5 (marketplace E04 avancée)

## 1. Objectif
Améliorer la carte publique (`#/carte`), la localisation des biens (`#/localiser/:id`), le géocodage et le secours local.

## 2. État existant
- Page `#/carte` avec recherche + vue carte + résultats.
- Éditeur de localisation (`#/localiser/:id`) pour point ou polygone.
- Fournisseur local (SVG métrique) en secours sans Mapbox.
- Intégration Mapbox présente mais **non validée** en conditions réelles (voir `docs/validation-mapbox.md`).

## 3. Améliorations de ce lot
- État vide de la carte amélioré (carte unifiée + message explicite).
- Légende ajoutée sous la carte : explication des marqueurs et du secours local.

## 4. Limites connues (DEC-002)
- Pas de navigateur ni de vrai Mapbox dans l'environnement d'audit.
- Validation visuelle et géocodage réel à faire chez le propriétaire.

## 5. Prochaines actions proposées
- [ ] Améliorer la synchronisation liste ↔ carte (clic marqueur → surbrillance résultat).
- [ ] Afficher la superficie calculée plus clairement dans l'éditeur.
- [ ] Documenter le déploiement du jeton Mapbox restreint.
- [ ] Tests de non-régression sur `geometry.js`.

## 6. Migrations
Aucune.

## 7. Synchronisation liste ↔ carte
- `mapView` accepte désormais un callback `onSelect`.
- Clic sur un marqueur (ou cluster) :
  - met en surbrillance la carte résultat correspondante (classe `.is-highlighted`),
  - fait défiler la liste jusqu’à elle.
- Les cartes résultats portent `data-listing-id`.
- Style de surbrillance ajouté dans `components.css` (contour leaf).

**Prochaine amélioration proposée** : affichage plus clair de la superficie dans l’éditeur de localisation.

## 8. Affichage de la superficie dans l'éditeur
- Badge dédié ajouté dans `#/localiser/:id`.
- S'affiche dès que le polygone a au moins 3 points et ne se croise pas.
- Montre en grand la superficie (m²) et en dessous les hectares + périmètre.
- Mis à jour en temps réel pendant le dessin.
- La mesure officielle du serveur reste affichée séparément après enregistrement.

**E05 — avancement** : légende, état vide, synchronisation liste/carte, superficie claire.
