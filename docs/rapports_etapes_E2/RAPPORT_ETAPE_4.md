# RAPPORT D'ÉTAPE 4 — Marketplace et recherche (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.5 (en développement)  
**Base :** V0.4 (compte unifié E03 avancé)

## 1. Objectif (selon le suivi)
Améliorer la recherche, les filtres, les résultats, les fiches, les favoris, la publication et la gestion des annonces.

## 2. État existant (déjà solide)
- Endpoint `GET /listings` avec filtres : transaction, catégorie, zone, prix min/max, surface, chambres, texte, tri, pagination.
- Page `#/annonces` avec modes de vue (grille / liste / carte), filtres avancés, sauvegarde de recherche.
- Fiche annonce complète (`#/annonce/:id`) avec similaires, commentaires, géo, contact.
- Favoris et recherches sauvegardées déjà présents.

## 3. Améliorations de ce lot
- État vide des résultats amélioré (carte + icône + appel à enregistrer la recherche si connecté).
- Cohérence visuelle avec le socle E02 (classes `.card`, `.empty-state`, `.btn`).

## 4. Prochaines actions proposées pour E04
- [ ] Afficher les recherches sauvegardées directement dans la page résultats.
- [ ] Améliorer le tri et les pastilles de filtres actifs.
- [ ] Renforcer la fiche annonce (bloc confiance annonceur plus visible).
- [ ] Tests de non-régression sur `lib/search.js`.
- [ ] Vérification visuelle (DEC-002).

## 5. Migrations
Aucune pour l'instant.

## 6. Recherches sauvegardées dans la page résultats
- Si l'utilisateur est connecté, la page `#/annonces` charge `/me/searches`.
- Affichage d'une carte « Mes recherches enregistrées » avec jusqu'à 6 pastilles cliquables.
- Un clic réapplique les filtres et relance la recherche.
- Lien « Voir toutes » vers la boîte si plus de 6 recherches.
- Masqué automatiquement si aucune recherche ou si non connecté.

**Prochaine amélioration proposée** : pastilles de filtres actifs + renforcement du bloc confiance sur la fiche.

## 7. Pastilles de filtres actifs
- Affichage dynamique des filtres actuellement appliqués (transaction, catégorie, zone, texte, prix, surface, chambres).
- Chaque pastille est cliquable et retire uniquement ce filtre.
- Bouton « Tout effacer » pour réinitialiser.
- Masqué automatiquement quand aucun filtre n’est actif.
- Mis à jour via `sync()`.

**Prochaine amélioration proposée** : renforcement du bloc confiance sur la fiche annonce.

## 8. Bloc confiance renforcé sur la fiche annonce
- Le résumé annonceur est maintenant une **carte** dédiée.
- Affiche :
  - nom de l'annonceur,
  - pastille note (si avis),
  - pastille niveau de confiance,
  - pastille « Agence vérifiée » si applicable,
  - détail de confiance (si fourni),
  - bouton « Voir le profil ».
- Gestion propre du chargement et de l'erreur.

**E04 — avancement** : recherche (état vide, recherches sauvegardées, filtres actifs) + fiche (bloc confiance).
