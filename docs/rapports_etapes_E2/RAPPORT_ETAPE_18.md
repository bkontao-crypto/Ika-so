# RAPPORT D'ÉTAPE 18 — Stats CRM et page de consultation des leads (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.9 (en développement)  
**Base :** V1.8 (création auto de lead)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Ajouter des statistiques simples et une page de consultation/gestion basique des leads.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Méthode `stats` | `server/services/crm.js` | Ajoutée |
| Route stats | `GET /me/crm/stats` | Ajoutée |
| Page de consultation | `public/js/pages/crm-leads.js` | Créée |
| Point d'entrée | `public/crm-leads.html` | Créé |

## 3. Fonctionnalités
- Stats : total + compteurs par statut et par source.
- Page `/crm-leads.html` :
  - Affiche les stats en pastilles.
  - Liste les leads (nom, source, téléphone, email, notes, statut).
  - Boutons rapides pour changer le statut (NEW → CONTACTED → VISIT, etc.).
- Mise à jour non bloquante via `PUT /me/crm/leads/:id`.

## 4. Prochaines actions proposées
- [ ] Intégrer le lien vers `/crm-leads.html` dans le centre professionnel.
- [ ] Formulaire de création manuelle de lead.
- [ ] Export CSV des leads.
- [ ] Implémentation du scoring (proposé précédemment).

## 5. Migrations
Aucune.

**E07 lot 4 — avancement** : stats + page de consultation des leads opérationnelles.
