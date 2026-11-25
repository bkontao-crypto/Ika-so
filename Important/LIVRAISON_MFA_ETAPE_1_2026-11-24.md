# Livraison — MFA, étapes 1/3 et 2a (24-25 novembre 2026)

Branche : `feature/mfa-fondations` (depuis `main` au commit 8eee53a). PR n°5. Non fusionnée.

## À réaliser
Implémenter la MFA par appli d'authentification (TOTP) + codes de secours à usage unique (décision du propriétaire, 24 nov. 2026), SMS plus tard. Découpage : 1/3 fondations, 2/3 service + routes + connexion en deux temps (2a service, 2b routes et connexion), 3/3 emplacements Superadmin + activation.

## Réalisé
Étape 1/3 (vérifiée : CI verte après correction du script de retour arrière) :
- `server/lib/totp.js` : TOTP RFC 6238 (module `crypto`, aucune dépendance), secret chiffré AES-256-GCM, codes de secours (10, hachés), rejeu refusé (`lastStep`).
- `migrations/091_mfa.sql` (additive : `ika_mfa_secrets`, `ika_mfa_backup_codes`, `ika_mfa_attempts`) et `scripts/rollback/091_mfa_down.sql` (transaction + ligne `_migrations`, exigés par `test/rollback-scripts.test.js`).
- `test/totp.test.js` : vecteurs officiels RFC 6238, base32, tolérance d'un pas, rejeu, chiffrement, codes de secours.

Étape 2a/3 (écrit ; vérification = CI de la PR, à confirmer) :
- `server/services/mfa.js` : `begin`, `confirm`, `verify`, `regenerateBackupCodes`, `disable`, `status`. Blocage 15 min après 5 échecs (en base), un code ne sert qu'une fois, journal d'audit `MFA_ENABLED` / `MFA_BACKUP_REGENERATED` / `MFA_DISABLED`. Sans clé de chiffrement : refus 503, rien stocké.
- `test/mfa-db.test.js` : parcours complet sur PostgreSQL (ignoré sans `DATABASE_URL_TEST`).

## Risque
Nul pour la production à ce stade : aucune ligne existante modifiée, le service n'est appelé nulle part, aucune exigence MFA activée. La migration 091 est additive.

## À faire
- 2b : routes (`/api/mfa/...`), connexion en deux temps pour les comptes qui l'ont activée (mot de passe, Google, ticket d'application), `mfaEncryptionKey` dans `config.js` et `.env.example`, `MFA_ENCRYPTION_KEY` sur Render **avant** toute activation, interface du profil.
- 3/3 : migration des emplacements Superadmin (principal / secondaire, plafond de deux, aucune attribution automatique), récupération par le secondaire après 7 jours avec alerte aux deux comptes, obligation MFA par réglage (Superadmin dès l'activation, Admin et Modérateurs après 14 jours), interdiction de désactiver la MFA quand elle est obligatoire.
- Fusionner `Important/SUIVI.md` (369 Ko, trop volumineux pour une édition à distance) avec cette fiche.
- Anomalie hors MFA vue dans le journal CI : requête de nettoyage sur `stored_files.content_type` (colonne inexistante). Non traitée.
