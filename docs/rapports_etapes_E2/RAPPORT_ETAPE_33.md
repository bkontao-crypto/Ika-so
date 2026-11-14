# RAPPORT D'ÉTAPE 33 — Similar, insights CRM, affichage fiche (E10) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 3.4 (en développement)  
**Étape officielle :** E10 — Intelligence et différenciation

## 1. Objectif
Implémenter les recommandations similaires, les insights CRM et l'affichage sur la fiche.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| `GET /listings/:id/similar` | `server/routes/index.js` | Ajouté |
| `GET /me/crm/insights` | `server/routes/index.js` | Ajouté |
| Affichage « Annonces similaires » | `public/js/pages/listing.js` | Déjà présent et branché |

## 3. Détails
- **Similar** : recherche par catégorie + quartier, exclut l'annonce courante, limite à 6.
- **Insights** : stats existantes + taux de conversion par source + liste des leads à relancer (score ≥ 50, statut NEW/CONTACTED).
- **Fiche** : la page annonce charge déjà `/listings/:id/similar` et affiche la section si des résultats existent.

## 4. Prochaines actions proposées
- [ ] Afficher les insights dans le centre professionnel / page leads.
- [ ] Améliorer la similarité (prix, surface, géolocalisation).
- [ ] Alertes intelligentes (baisse de prix, nouvelle annonce dans une zone).
- [ ] Tests des nouveaux endpoints.

## 5. Migrations
Aucune.

**E10 lot 1 — avancement** : similar + insights + affichage fiche.
