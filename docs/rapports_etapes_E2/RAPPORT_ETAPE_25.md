# RAPPORT D'ÉTAPE 25 — Bouton WhatsApp, association entrante, templates (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.6 (en développement)  
**Base :** V2.5 (WhatsApp Business)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Livrer en une fois : bouton d'envoi, association automatique des messages entrants, et support des templates.

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Bouton « Envoyer WhatsApp » | `public/js/pages/crm-leads.js` | Ajouté (si téléphone présent) |
| Association message entrant → lead | `server/routes/index.js` (webhook) | Ajoutée |
| Liste des templates | `GET /me/whatsapp/templates` | Ajoutée |
| Envoi de template | `POST /me/crm/leads/:id/whatsapp-template` | Ajoutée |
| Méthode `listTemplates` | `server/services/whatsapp.js` | Ajoutée |

## 3. Détails
- **Bouton** : prompt pour le texte → `POST /me/crm/leads/:id/whatsapp`.
- **Association entrante** : recherche d'un lead par numéro normalisé, ajout d'une note et passage en statut `CONTACTED`.
- **Templates** : liste via WABA + envoi avec nom de template + langue + components optionnels.
- Note automatique ajoutée sur le lead après envoi.

## 4. Configuration supplémentaire
- `whatsapp.wabaId` (ou `businessAccountId`) pour lister les templates.

## 5. Prochaines actions proposées
- [ ] Sélecteur de templates dans l'interface leads.
- [ ] Exposition sécurisée de `db` pour le webhook (ou service dédié).
- [ ] Gestion de la fenêtre 24 h et des médias.
- [ ] Journalisation des envois WhatsApp dans l'audit.

## 6. Migrations
Aucune.

**E07 lot 11 — avancement** : bouton, association entrante et templates WhatsApp.
