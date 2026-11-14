# RAPPORT D'ÉTAPE 21 — Tri par score et seuils visuels (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.2 (en développement)  
**Base :** V2.1 (scoring)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Trier les leads par score décroissant et afficher des seuils visuels (chaud / tiède / froid).

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Tri par score | `public/js/pages/crm-leads.js` | Ajouté (desc) |
| Seuils visuels | `public/js/pages/crm-leads.js` | Ajoutés |

## 3. Seuils
- **≥ 80** : Chaud (pastille verte)
- **50–79** : Tiède (pastille or)
- **< 50** : Froid (pastille neutre)

- Les leads sont affichés du plus prioritaire au moins prioritaire.
- Le score reste recalculé côté serveur.

## 4. Prochaines actions proposées
- [ ] Intégrer le lien vers `/crm-leads.html` dans le centre professionnel.
- [ ] Filtre par score minimum ou par seuil.
- [ ] Export CSV incluant le score.
- [ ] Notification ou mise en avant des leads chauds.

## 5. Migrations
Aucune.

**E07 lot 7 — avancement** : tri par score + seuils visuels.
