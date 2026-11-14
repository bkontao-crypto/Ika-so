# RAPPORT D'ÉTAPE 19 — Formulaire de création et export CSV des leads (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.0 (en développement)  
**Base :** V1.9 (stats + page leads)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Ajouter la création manuelle de lead et l'export CSV sur la page de consultation.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Formulaire de création | `public/js/pages/crm-leads.js` | Ajouté |
| Bouton « Exporter CSV » | `public/js/pages/crm-leads.js` | Ajouté |

## 3. Fonctionnalités
- Formulaire : nom, téléphone, email, notes → `POST /me/crm/leads` (source = manual).
- Export CSV des leads actuellement affichés (nom, statut, source, téléphone, email, notes).
- Fichier nommé `leads-YYYY-MM-DD.csv`.
- Rafraîchissement automatique après création.

## 4. Prochaines actions proposées
- [ ] Intégrer le lien vers `/crm-leads.html` dans le centre professionnel.
- [ ] Implémentation du scoring des leads.
- [ ] Filtres (statut, source) sur la page.
- [ ] Enrichissement optionnel depuis un contact connecté.

## 5. Migrations
Aucune.

**E07 lot 5 — avancement** : création manuelle + export CSV des leads.
