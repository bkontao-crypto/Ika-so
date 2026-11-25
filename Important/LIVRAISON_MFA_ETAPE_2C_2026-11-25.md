# Livraison MFA — étape 2c : interface (25 novembre 2026)

Branche : `feature/mfa-interface` (à fusionner dans `main` par le propriétaire après vérification sur le site).

**À réaliser** : écran de saisie du code après connexion, carte « Double authentification » dans le profil, `MFA_ENCRYPTION_KEY` dans `.env.example`.

**Réalisé**
- `public/js/pages/mfa-login.js` : route `#/verification` (GET `/api/mfa/pending`, POST `/api/mfa/login`, bouton Abandonner → `/api/mfa/cancel`).
- `public/js/app.js` : route `/verification` ; une vérification unique par chargement de page demande le code si une session est en attente (couvre Google et ticket d'application, qui rechargent la page).
- `public/js/pages/login.js` : après le mot de passe, redirection vers `#/verification` si le compte exige le code.
- `public/js/components/mfa-security.js`, branchée dans `account.js` (Mon profil → Paramètres) : activation (clé à saisir + lien « Ouvrir dans mon application », pas de QR code : aucune bibliothèque tierce), codes de secours affichés une seule fois, renouvellement, désactivation.
- `.env.example` : `MFA_ENCRYPTION_KEY`. `public/sw.js` : version recalculée (`npm run stamp-sw`).
- Plan du site (S45) ; `test/api-links.test.js` couvre maintenant `server/routes/mfa.js`.

**Vérifié** : `npm test` en local : 512 réussis, 0 échec, 19 ignorés (dont les tests PostgreSQL, faute de `DATABASE_URL_TEST`) ; `stamp-sw:check` à jour ; contrôle de syntaxe des 5 fichiers JS. **Non vérifié** : rendu réel et parcours complet (activation, connexion avec code, abandon, codes de secours) dans un navigateur, sur ordinateur et mobile ; CI GitHub.

**À faire** : recette manuelle ; ne poser `MFA_ENCRYPTION_KEY` sur Render qu'après cette recette et la fusion ; QR code éventuel plus tard ; étape 3 (emplacements Superadmin, MFA obligatoire).

**Risques** : sans `MFA_ENCRYPTION_KEY`, « Activer » répond 503 (message affiché). Une fois des comptes activés, ne jamais changer la clé. Retour arrière : `git revert -m 1 <commit de fusion>` (aucune migration dans cette étape).
