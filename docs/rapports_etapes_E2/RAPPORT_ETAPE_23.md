# RAPPORT D'ÉTAPE 23 — CSV avec score, auto-lead fiche, stats avancées (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.4 (en développement)  
**Base :** V2.3 (lien + filtres)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Livrer en une fois : export CSV avec score, création auto depuis une fiche annonce, et stats avancées.

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Export CSV avec score | `public/js/pages/crm-leads.js` | Mis à jour |
| Création auto depuis fiche | `server/routes/index.js` (`POST /listings/:id/contact`) | Ajoutée |
| Stats avancées | `server/services/crm.js` (`stats`) | Enrichies |
| Affichage stats | `public/js/pages/crm-leads.js` | Mis à jour |

## 3. Détails
- **CSV** : colonnes Nom, Score, Statut, Source, Téléphone, Email, Notes.
- **Auto-lead fiche** : contact WhatsApp/Call sur une annonce crée un lead pour le propriétaire, lié à l'annonce, source WHATSAPP/CALL.
- **Stats avancées** :
  - Taux de conversion (WON / total).
  - Évolution : nombre de leads créés par semaine (4 dernières semaines).
- Affichage sur la page leads : taux + évolution.

## 4. Prochaines actions proposées
- [ ] Graphique simple de l'évolution.
- [ ] Notification des leads chauds.
- [ ] Enrichissement optionnel du lead (coordonnées du contacteur si consentement).
- [ ] Tests de non-régression sur les routes de contact.

## 5. Migrations
Aucune.

**E07 lot 9 — avancement** : CSV avec score + auto-lead fiche + stats avancées.
