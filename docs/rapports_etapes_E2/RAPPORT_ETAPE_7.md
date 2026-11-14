# RAPPORT D'ÉTAPE 7 — Documentation modération et finitions confiance (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.8 (en développement)  
**Base :** V0.7 (confiance E06 avancée)

## 1. Objectif
Documenter le workflow de modération pour l'équipe et consolider les éléments de confiance déjà livrés.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Workflow de modération | `docs/etape-7/WORKFLOW_MODERATION.md` | Créé |
| Rappel des règles badges | Intégré dans le document | Fait |
| Statuts réclamations | Documentés et déjà affichés en UI | Cohérent |

## 3. Contenu du document
- Principes (vérification humaine, traçabilité).
- Sources d'entrée (signalements, réclamations).
- Cycle de vie des réclamations.
- Actions possibles sur comptes et annonces.
- Règles d'attribution des trois badges.
- Bonnes pratiques pour l'équipe.
- Points ouverts.

## 4. Cohérence avec le code existant
- Pastilles de statut déjà présentes dans `complaints.js`.
- Badges courts et explicites sur `listing-card.js` et profil annonceur.
- Page `#/confiance` restructurée en E06.
- Aucune modification de schéma requise pour ce lot.

## 5. Prochaines actions proposées
- [ ] Ajouter un journal d'audit simple des actions de modération.
- [ ] Brancher les onglets restants du compte unifié (Favoris, Messages, Documents).
- [ ] Tests de non-régression sur les règles de confiance.
- [ ] Préparer la checklist de clôture E02–E06 pour la revue propriétaire (DEC-002).

## 6. Migrations
Aucune.

**E07 — avancement** : workflow de modération documenté.
