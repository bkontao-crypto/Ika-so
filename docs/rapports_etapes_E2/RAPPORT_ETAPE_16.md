# RAPPORT D'ÉTAPE 16 — Implémentation CRM leads (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.7 (en développement)  
**Base :** V1.6 (esquisse CRM)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Implémenter le CRM leads (migration, service, routes).

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Migration | `migrations/062_crm_leads.sql` | Créée |
| Service | `server/services/crm.js` | Créé |
| Câblage | `server/services/index.js` | Ajouté |
| Routes | `GET/POST /me/crm/leads`, `GET/PUT /me/crm/leads/:id` | Ajoutées dans `server/routes/index.js` |

## 3. Fonctionnalités
- Liste des leads de l'annonceur (filtre optionnel par statut).
- Création manuelle (nom, téléphone, email, source, statut, notes, listingId).
- Mise à jour (statut, notes, contacts, liaison annonce).
- Lecture unitaire.
- Sécurité : uniquement les leads de l'utilisateur connecté.

## 4. Prochaines actions proposées
- [ ] Section « Leads » dans le centre professionnel (frontend).
- [ ] Création automatique d'un lead depuis un contact profil (WhatsApp/Call).
- [ ] Stats simples (compteurs par statut).
- [ ] Export CSV des leads.

## 5. Migrations
`062_crm_leads.sql` (additive).

## 6. Retour arrière
Supprimer les routes, retirer le service, dropper la table si nécessaire.

**E07 lot 2 — avancement** : CRM leads opérationnel côté serveur.
