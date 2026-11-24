# Livraison — MFA, étape 1/3 : fondations (24 novembre 2026)

Branche : `feature/mfa-fondations` (depuis `main` au commit 8eee53a). Non fusionnée.

## À réaliser
Implémenter la MFA par appli d'authentification (TOTP) + codes de secours à usage unique (décision du propriétaire, 24 nov. 2026), SMS plus tard. Découpage : 1/3 fondations, 2/3 service + routes + connexion en deux temps, 3/3 emplacements Superadmin + activation.

## Réalisé (écrit, non exécuté)
- `server/lib/totp.js` : TOTP RFC 6238 (module `crypto`, aucune dépendance), secret chiffré AES-256-GCM, codes de secours (10, hachés), rejeu refusé (`lastStep`).
- `migrations/091_mfa.sql` (additive : `ika_mfa_secrets`, `ika_mfa_backup_codes`, `ika_mfa_attempts`) et `scripts/rollback/091_mfa_down.sql`.
- `test/totp.test.js` : vecteurs officiels RFC 6238, base32, tolérance d'un pas, rejeu, chiffrement, codes de secours.

## Vérifié
Rien n'a été exécuté : aucun accès à Node ni à PostgreSQL depuis cette session. `npm test` et l'application de la migration 091 sur une base de développement restent à faire.

## Risque
Nul pour la production à ce stade : aucune ligne existante n'est modifiée, rien n'est branché sur la connexion, aucune exigence MFA n'est activée.

## À faire
- 2/3 : service `mfa` (enrôlement, confirmation, désactivation, régénération des codes), routes, connexion en deux temps pour les comptes qui l'ont activée, limitation en base, variable `MFA_ENCRYPTION_KEY` (à ajouter à `.env.example` et à Render avant l'activation), interface du profil.
- 3/3 : migration des emplacements Superadmin (principal / secondaire, plafond de deux, aucune attribution automatique), récupération par le secondaire après 7 jours avec alerte aux deux comptes, obligation MFA par réglage (Superadmin dès l'activation, Admin et Modérateurs après 14 jours).
- Fusionner `Important/SUIVI.md` (369 Ko, trop volumineux pour une édition à distance) avec cette fiche.
