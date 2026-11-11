# PLAN — Rôles, permissions, deux Superadmin, MFA (migrations 025, 041 et 042 (026 = profil public, 027 = consentement aux statistiques, 028 à 040 = Owner Control et réclamations))

Établi le 4 novembre 2026 (livraison 9). **Plan seulement : aucun code ni migration n'est écrit ni appliqué.** Choix du propriétaire : option 1 (rôles/permissions, deux emplacements Superadmin, MFA). Base : `SPECIFICATION_SUPERADMIN.md` § 3 et § 86 ; décisions D-4 et « une semaine de délai ».

## 1. État réel du code (relevé dans l'archive)
- Rôles dans `ika_profiles.staff_role` (USER, MODERATOR, ADMIN, SUPERADMIN) ; contrôle par rang (`requireStaff(userId, minimum)` dans `server/services/accounts.js`), appelé côté serveur dans paiements, confiance, modération.
- Changement de rôle : SUPERADMIN seulement, sérialisé, garde-fou « au moins un SUPERADMIN actif » (`moderation.js`). Aucun Admin ne peut promouvoir un Superadmin : déjà vrai, à conserver.
- Manquent : permissions individuelles, refus par défaut par permission, deux emplacements, MFA, délégations Premium (10 comptes), isolation fine des agences.

## 2. Principes
Migrations additives et rétrocompatibles ; comportement identique tant que rien n'est activé ; sauvegarde avant chaque migration ; retour arrière écrit pour chacune ; aucune suppression de colonne ni de donnée ; aucun changement de rôle sans votre confirmation sur la liste réelle.

## 3. Étapes
| Étape | Contenu | Risque | Retour arrière |
|---|---|---|---|
| 025 `permissions` | Tables `ika_permissions`, `ika_role_permissions`, `ika_user_permissions` (qui a accordé, quand). Amorçage = équivalent exact des rangs actuels. Refus par défaut. Un Admin ne peut ni s'accorder une permission ni en accorder une qu'il n'a pas. | Faible | `025_down` (supprime les 3 tables) |
| Code A | Service `permissions` ; `requireStaff` devient une façade au-dessus (aucun appelant modifié d'un coup) ; migration progressive des appels vers des permissions nommées. | Moyen | Revenir à la façade seule |
| 041 `superadmin_slots` | Colonne `superadmin_slot` (PRIMARY/SECONDARY, nulle par défaut), index uniques partiels, plafond de deux. **Aucune attribution automatique.** Attribution par script que vous confirmez sur la liste réelle ; les autres SUPERADMIN passent ADMIN avec droits conservés. | Élevé (risque de verrouillage) | `026_down` ; script de réattribution |
| 042 `mfa` | TOTP (algorithme RFC 6238 avec le module `crypto` de Node, aucune dépendance), secrets chiffrés (clé en variable d'environnement), codes de récupération à usage unique hachés, limitation des tentatives. SMS en secours reporté (⛔ fournisseur non choisi). | Élevé (verrouillage du personnel) | `027_down` ; désactivation de l'obligation par réglage |
| Activation | MFA exigée selon l'option choisie ; récupération du principal par le secondaire avec délai d'une semaine. | Élevé | Réglage `mfa_required` |

## 4. Tests prévus
Utilisateur ordinaire refusé sur toute API `/staff/*` ; Admin ne peut ni créer un Superadmin ni s'octroyer une permission ; troisième emplacement Superadmin refusé ; course entre deux changements de rôle ; refus par défaut d'une permission inconnue ; MFA : bon code, mauvais code, code rejoué, codes de récupération, limitation ; anciens comptes sans régression (suite existante 340/340).

## 5. Limites connues
Sans PostgreSQL ni réseau dans cette session, les tests base ne pourront être lancés que si un PostgreSQL est disponible ; sinon ils restent « non exécutés » et seront à lancer chez vous. La liste réelle des SUPERADMIN n'est pas visible depuis l'archive.

## 6. Question ouverte
Mode d'obligation de la MFA (voir réponse de la livraison 9).
