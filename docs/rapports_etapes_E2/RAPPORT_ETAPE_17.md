# RAPPORT D'ÉTAPE 17 — Création automatique de lead depuis un contact profil (E07) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.8 (en développement)  
**Base :** V1.7 (CRM leads)  
**Étape officielle :** E07 — Professionnels et CRM

## 1. Objectif
Créer automatiquement un lead CRM lorsqu'un utilisateur contacte un annonceur depuis son profil public (WhatsApp ou Call).

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Création auto de lead | `server/routes/index.js` | Ajoutée dans `POST /advertisers/:id/contact` |

## 3. Comportement
- Après `advertiserProfiles.recordContact`, un lead est créé pour l'annonceur ciblé (`id(req)`).
- Source : `WHATSAPP` ou `CALL`.
- Statut initial : `NEW`.
- Note : « Contact depuis le profil public (SOURCE) ».
- Appel non bloquant (`.catch(() => {})`).
- Aucune donnée personnelle du contacteur n'est stockée (nom/téléphone/email restent vides).

## 4. Cohérence
- Utilise le service `crm` livré en E16.
- Visible immédiatement dans `GET /me/crm/leads` de l'annonceur.
- Compatible avec le scoring proposé (source WhatsApp/Call = 20 points).

## 5. Prochaines actions proposées
- [ ] Section « Leads » dans le centre professionnel (frontend).
- [ ] Enrichissement optionnel du lead (si l'utilisateur est connecté et accepte de partager son contact).
- [ ] Stats simples (compteurs par statut / source).
- [ ] Export CSV des leads.

## 6. Migrations
Aucune.

**E07 lot 3 — avancement** : création automatique de lead depuis un contact profil opérationnelle.
