# RAPPORT D'ÉTAPE 22 — Lien dans le centre pro et filtres leads (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.3 (en développement)  
**Base :** V2.2 (seuils visuels)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Ajouter le lien vers la page Leads dans l'espace professionnel et les filtres sur la page.

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Lien « Ouvrir mes leads » | `public/js/pages/compte-unifie.js` (onglet Pro) | Ajouté |
| Filtre par statut | `public/js/pages/crm-leads.js` | Ajouté |
| Filtre par score minimum | `public/js/pages/crm-leads.js` | Ajouté (≥ 50, ≥ 80) |

## 3. Détails
- Dans l'onglet **Pro** du compte unifié : carte « CRM et leads » avec bouton vers `/crm-leads.html`.
- Sur la page leads :
  - Sélecteur de statut (Tous / NEW / CONTACTED / …).
  - Sélecteur de score min (Tous / ≥ 50 tiède+ / ≥ 80 chaud).
  - Filtrage côté client + tri par score conservé.
  - Message si aucun lead ne correspond.

## 4. Prochaines actions proposées
- [ ] Export CSV incluant le score.
- [ ] Mise en avant visuelle renforcée des leads chauds.
- [ ] Création automatique de lead aussi depuis un contact sur une fiche annonce.
- [ ] Stats avancées (évolution, taux de conversion).

## 5. Migrations
Aucune.

**E07 lot 8 — avancement** : lien dans le centre pro + filtres statut/score.
