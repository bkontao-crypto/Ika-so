# Checklist de clôture — Étapes E02 à E06 (IKA SO)

**Date :** 14 novembre 2026  
**Objectif :** préparer la revue propriétaire (DEC-002) et valider les critères d’acceptation.

## E02 — Socle visuel et navigation
- [ ] Vérifier contrastes clair/sombre sur boutons, cartes, pastilles (captures).
- [ ] Contrôler responsive (mobile 360 px, tablette, desktop).
- [ ] Confirmer absence de styles en ligne sur les pages principales.
- [ ] Valider cibles tactiles ≥ 44 px et focus visible.
- [ ] `prefers-reduced-motion` respecté.

## E03 — Compte unifié et Owner Center
- [ ] Onglets contextuels selon rôles (Aperçu, Annonces, Favoris, Messages, Documents, Biens, Abonnement, Pro, Réglages).
- [ ] Boutons Console / Owner Center visibles uniquement pour les rôles autorisés.
- [ ] Entité « bien » : création, liste, liaison optionnelle aux annonces.
- [ ] Matrice Owner Center (29 modules délégables / 11 réservés) documentée et appliquée.
- [ ] Tests d’accès par rôle (pas d’élévation de privilège côté client).

## E04 — Marketplace
- [ ] Recherche : état vide, recherches sauvegardées, filtres actifs.
- [ ] Fiche annonce : bloc confiance visible.
- [ ] Cartes résultats cohérentes avec le socle visuel.

## E05 — Carte et localisation
- [ ] Légende et état vide de la carte.
- [ ] Synchronisation liste ↔ carte (clic marqueur → surbrillance + scroll).
- [ ] Superficie claire dans l’éditeur de polygone (temps réel).
- [ ] Secours local (SVG) fonctionnel sans Mapbox.
- [ ] Documenter déploiement du jeton Mapbox restreint.

## E06 — Confiance et modération
- [ ] Page Confiance restructurée (cartes badges + conseil sécurité).
- [ ] Suivi réclamations : pastilles de statut (Ouverte / En cours / Résolue / Fermée).
- [ ] Badges courts et explicites sur cartes résultats et profil annonceur.
- [ ] Workflow de modération documenté (voir docs/etape-7).

## Points transverses
- [ ] Aucune migration destructive.
- [ ] Retours arrière documentés.
- [ ] Captures « Non testé » marquées jusqu’à exécution réelle (DEC-002).
- [ ] Revue des contrastes et accessibilité de base.

**Statut global :** code livré, validation visuelle et tests réels en attente chez le propriétaire.
