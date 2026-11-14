# RAPPORT D'ÉTAPE 9 — Journal d'audit et détail des biens (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.0 (en développement)  
**Base :** V0.9 (checklist et esquisse E08)

## 1. Objectif
Implémenter le journal d'audit de modération (esquisse E08) et finaliser l'affichage du détail d'un bien dans le compte unifié.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Migration journal d'audit | `migrations/061_moderation_audit.sql` | Créée |
| Service `moderation-audit` | `server/services/moderation-audit.js` | Créé |
| Câblage service | `server/services/index.js` | Ajouté |
| Route staff lecture | `GET /staff/moderation-audit` dans `server/routes/index.js` | Ajoutée |
| Détail d'un bien | `public/js/pages/compte-unifie.js` (onglet Mes biens) | Implémenté |

## 3. Détails
- Table `ika_moderation_audit` additive, append-only, indexée sur cible et acteur.
- Service : `log(actorId, {action, targetType, targetId, details})` et `list(...)`.
- Route staff protégée (même niveau que les autres endpoints `/staff`).
- Dans le compte unifié : `#/profil?tab=biens&id=...` affiche désormais le détail (infos + annonces liées) avec bouton retour.

## 4. Prochaines actions proposées
- [ ] Appeler `moderationAudit.log(...)` depuis les actions sensibles de `moderation.js` (badges, restrictions, masquage, résolution de réclamations).
- [ ] Vue simple de consultation dans le centre d'administration.
- [ ] Tests d'intégration sur la création/lecture du journal.
- [ ] Liaison optionnelle annonce ↔ bien lors de la publication.

## 5. Migrations
`061_moderation_audit.sql` (additive).

## 6. Retour arrière
Supprimer la route, retirer le service du `createServices`, et dropper la table si nécessaire.

**E09 — avancement** : journal d'audit opérationnel (lecture) + détail des biens.
