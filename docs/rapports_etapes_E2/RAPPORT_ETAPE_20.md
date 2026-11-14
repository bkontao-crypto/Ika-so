# RAPPORT D'ÉTAPE 20 — Scoring des leads (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.1 (en développement)  
**Base :** V2.0 (formulaire + CSV)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Implémenter le scoring automatique des leads (0–100).

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Colonne `score` | `migrations/063_crm_leads_score.sql` | Créée |
| Fonction `computeScore` | `server/services/crm.js` | Ajoutée |
| Calcul à la création et mise à jour | `server/services/crm.js` | Branché |
| Affichage du score | `public/js/pages/crm-leads.js` | Ajouté (pastille) |

## 3. Règles de scoring (0–100)
| Critère | Points |
|---------|--------|
| Source WhatsApp/Call | 20 |
| Source form | 15 |
| Source manual | 5 |
| Téléphone | +10 |
| Email | +5 |
| Nom | +5 |
| Lien à une annonce | +15 |
| Statut NEW / CONTACTED / VISIT / NEGOTIATION / WON / LOST | 5 / 10 / 20 / 25 / 30 / 0 |
| Fraîcheur ≤ 24 h / 7 j / 30 j | 15 / 10 / 5 |
| Notes non vides | +5 |

- Score plafonné à 100.
- Recalculé automatiquement à chaque création et mise à jour.
- Indexé pour tri futur par priorité.

## 4. Prochaines actions proposées
- [ ] Tri par score sur la page leads.
- [ ] Seuils visuels (chaud / tiède / froid).
- [ ] Intégration du lien dans le centre professionnel.
- [ ] Filtres par score minimum.

## 5. Migrations
`063_crm_leads_score.sql` (additive).

**E07 lot 6 — avancement** : scoring des leads opérationnel.
