# Livraison — MFA, étape 2b/3 : connexion en deux temps (25 novembre 2026)

Branche : `feature/mfa-connexion` (depuis `main` après la PR n°6). Non fusionnée.

## Principe
Un seul point de contrôle, `server/app.js` : pour un compte qui a activé la MFA, une session non vérifiée n'est pas connectée (`req.user = null`). Cela couvre d'un coup mot de passe, Google et ticket d'application, sans modifier `routes/index.js` ni `accounts.js`. Sans l'objet `mfa` passé à `createApp`, le comportement est exactement celui d'avant.

## Réalisé (écrit ; vérification = CI de la PR)
- `migrations/092_mfa_sessions.sql` (une colonne nullable `ika_sessions.mfa_verified_at`) et `scripts/rollback/092_mfa_sessions_down.sql`.
- `server/services/mfa-session.js` : état et validation d'une session.
- `server/routes/mfa.js` : `GET /api/mfa/pending`, `POST /api/mfa/login`, `POST /api/mfa/cancel` (session en attente) ; `GET /status`, `POST /begin`, `/confirm`, `/backup-codes`, `/disable` (session vérifiée). Réponses `Cache-Control: no-store`, limitation 30 requêtes par minute et par adresse.
- `server/app.js` : contrôle MFA des sessions et montage des routes. `server/index.js` : lit `MFA_ENCRYPTION_KEY` (absente : activation refusée 503 ; invalide : démarrage refusé).
- `test/mfa-http.test.js` : serveur HTTP réel sur PostgreSQL (session en attente, mauvais code, code appli, code de secours, abandon, désactivation).

## Risque
Faible. Aucune MFA n'est activable sur le site tant que `MFA_ENCRYPTION_KEY` n'est pas posée sur Render, et aucun écran ne permet encore de l'activer (étape 2c). Le seul changement actif pour tous est une requête de plus par appel authentifié (indexée).

## À faire
- 2c : écran « Sécurité » du profil (QR code, codes de secours) et écran de saisie du code après la connexion. Sans lui, ne PAS poser `MFA_ENCRYPTION_KEY` sur Render.
- 3/3 : emplacements Superadmin, récupération par le secondaire, obligation MFA par réglage, interdiction de désactiver quand elle est obligatoire.
- Ajouter `MFA_ENCRYPTION_KEY` à `.env.example` (non fait : fichier non lu dans cette étape).
