# RAPPORT D'ÉTAPE 10 — Journalisation des actions de modération (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.1 (en développement)  
**Base :** V1.0 (journal d'audit E09)

## 1. Objectif
Brancher les appels `moderationAudit.log(...)` sur les actions sensibles du centre d'administration.

## 2. Travaux réalisés
| Action staff | Route | Journalisation |
|--------------|-------|----------------|
| Décision annonce (approve / reject / etc.) | `POST /staff/listings/:id/decision` | `listing_<action>` |
| Mise en avant | `POST /staff/listings/:id/feature` | `listing_feature` / `listing_unfeature` |
| Rejet de signalement | `POST /staff/reports/:id/dismiss` | `report_dismiss` |
| Masquage de commentaire | `POST /staff/comments/:id/hide` | `comment_hide` |
| Changement de statut de compte | `POST /staff/accounts/:id/status` | `account_status` |
| Changement de rôle staff | `POST /staff/accounts/:id/role` | `account_role` |

- Les appels sont non bloquants (`.catch(() => {})`).
- Détails (raison, statut, rôle) enregistrés quand disponibles.
- Aucune modification du service `moderation.js` (non fourni dans le lot) : journalisation effectuée au niveau des routes.

## 3. Cohérence
- Utilise le service et la table livrés en E09.
- Compatible avec la route de lecture `GET /staff/moderation-audit`.

## 4. Prochaines actions proposées
- [ ] Vue de consultation du journal dans le centre d'administration.
- [ ] Journaliser également les actions de badges (grant / revoke) dès que les endpoints sont identifiés.
- [ ] Tests de non-régression sur les routes staff.
- [ ] Liaison optionnelle annonce ↔ bien à la publication.

## 5. Migrations
Aucune nouvelle (réutilise 061).

**E10 — avancement** : journalisation active sur les principales actions de modération.
