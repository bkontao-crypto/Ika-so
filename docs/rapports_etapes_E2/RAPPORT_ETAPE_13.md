# RAPPORT D'ÉTAPE 13 — Journalisation des badges (grant / revoke) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.4 (en développement)  
**Base :** V1.3 (export CSV E12)

## 1. Objectif
Brancher la journalisation d'audit sur les actions de badges (attribution et révocation).

## 2. Travaux réalisés
| Action | Route | Entrée d'audit |
|--------|-------|----------------|
| Décision sur une preuve (ACCEPT / rejet) | `POST /staff/proofs/:id/decision` | `badge_grant` ou `badge_reject` |
| Révocation de badge | `POST /staff/badges/revoke` | `badge_revoke` |

- Appels non bloquants via `moderationAudit.log(...)`.
- Détails enregistrés : proofId, note, ownerId, listingId, raison, etc.
- Cible : listing si disponible, sinon user.
- Modifié uniquement dans `server/routes/index.js`.

## 3. Cohérence
- Réutilise le service et la table livrés en E09.
- Visible dans la vue `/admin-audit.html` et l'export CSV (E11/E12).

## 4. Prochaines actions proposées
- [ ] Liaison optionnelle annonce ↔ bien à la publication.
- [ ] Filtres supplémentaires sur la vue audit (acteur, dates).
- [ ] Tests de non-régression sur les routes de badges.
- [ ] Vérification que les badges affichés (listing-card, profil) reflètent bien les décisions journalisées.

## 5. Migrations
Aucune.

**E13 — avancement** : journalisation des actions de badges opérationnelle.
