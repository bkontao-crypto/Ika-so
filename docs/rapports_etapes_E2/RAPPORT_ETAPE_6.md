# RAPPORT D'ÉTAPE 6 — Confiance et modération (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.7 (en développement)  
**Base :** V0.6 (carte E05 avancée)

## 1. Objectif
Renforcer la confiance (badges, documents, profils annonceurs), les signalements, les réclamations et les workflows de modération.

## 2. État existant
- Page `#/confiance` (explications des badges).
- Page `#/reclamations` (dépôt et suivi).
- Profil annonceur avec avis et signalement.
- Centre d'administration (`/admin`) pour la modération.
- Services `trust.js`, `moderation.js`, `reviews.js`.

## 3. Améliorations de ce lot
- Page Confiance restructurée :
  - cartes dédiées pour chaque badge (Titre foncier, Agence, SMS),
  - bloc conseil de sécurité mis en avant,
  - lien direct vers les réclamations.
- Cohérence visuelle avec le socle E02.

## 4. Prochaines actions proposées
- [ ] Améliorer le suivi des réclamations (statuts plus visibles).
- [ ] Renforcer l'affichage des badges sur les fiches et profils.
- [ ] Documenter le workflow de modération pour l'équipe.
- [ ] Tests sur les règles de confiance.

## 5. Migrations
Aucune.

## 6. Suivi des réclamations amélioré
- Statuts affichés sous forme de pastilles colorées :
  - Ouverte
  - En cours (or)
  - Résolue (vert)
  - Fermée
- Date formatée en français.
- Bouton « Voir / commenter » plus clair.
- État vide unifié (carte + icône).

**Prochaine amélioration proposée** : renforcement des badges sur les fiches et profils.

## 7. Badges renforcés et unifiés
- Cartes résultats (`listing-card.js`) :
  - pastilles plus courtes et explicites (« ✓ Titre contrôlé », « ✓ Agence », « ✓ SMS »),
  - attribut `title` pour le détail au survol.
- Profil annonceur :
  - chips alignées sur les classes `.pill` / `.pill-green` du socle visuel.
- Cohérence visuelle accrue entre fiche, résultats et profil.

**E06 — avancement** : page confiance, suivi réclamations, badges unifiés.
