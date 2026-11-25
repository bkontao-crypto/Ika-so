# Livraison étape 3 — emplacements Superadmin et MFA obligatoire (25 novembre 2026)

Branche : `feature/superadmin-mfa-obligatoire` (issue de `main`, indépendante de `feature/mfa-interface`). Fusion dans `main` par le propriétaire après vérification.

**À réaliser** : deux emplacements Superadmin, MFA obligatoire (réglage, délai 14 jours, désactivation interdite), tests d'interdiction.

**Audit préalable** : seul un Superadmin pouvait déjà promouvoir (`moderation.setStaffRole`, verrou 727003) ; aucun Admin. Le bootstrap (`ika_bootstrap`) ne produit qu'un seul Superadmin. Il manquait le plafond de deux et la notion d'emplacement.

**Réalisé**
- Migration `093` (additive) + retour arrière : colonne `ika_profiles.superadmin_slot` (PRINCIPAL/SECONDARY), index unique par emplacement, contrainte « emplacement seulement pour un Superadmin », réglage `mfa_required = false`. Les Superadmin existants reçoivent principal puis secondaire (par ancienneté) ; un éventuel surplus reste sans emplacement, jamais supprimé.
- `setStaffRole` : maximum deux Superadmin (403 au troisième, banni compris), l'emplacement libre est attribué, rétrograder le libère. Le bootstrap prend l'emplacement principal.
- MFA obligatoire : `GET/PUT /api/mfa/required` (Superadmin seulement). L'activer exige que l'auteur ait déjà sa propre MFA. Superadmin sans MFA bloqué dès l'activation, Admin et Modérateurs après 14 jours (porte unique dans `requireStaff` et `requirePermission`). Désactivation refusée au personnel tant que l'obligation est active. Sans `MFA_ENCRYPTION_KEY`, aucun blocage (personne ne pourrait s'inscrire).
- Tests : `test/superadmin-mfa-db.test.js`, `test/interdictions-http.test.js` (utilisateur et Admin refusés sur promotion, auto-octroi de permission, réglage MFA).

**Vérifié** : `npm test` en local sur PostgreSQL 16 : 534 réussis, 0 échec, 0 ignoré. Retour arrière 093 exécuté puis migration rejouée sur PostgreSQL. **Non vérifié** : CI GitHub, comportement sur le site réel.

**Non fait / à décider**
- Récupération d'un Superadmin par l'autre après 7 jours avec alerte aux deux comptes : la décision ne dit pas ce qui est récupéré (accès perdu, MFA perdue, rôle ?) ni comment la demande est faite. Question posée au propriétaire.
- Aucun écran pour le réglage « MFA obligatoire » ni l'affichage des emplacements (API seulement) : à prévoir dans l'Owner Center.
- Un Superadmin peut encore en rétrograder un autre (règle existante, inchangée) : à trancher avec la récupération.

**Risques** : l'activation de l'obligation bloque les Superadmin sans MFA, d'où la règle « l'auteur doit d'abord l'activer ». Ne poser `MFA_ENCRYPTION_KEY` qu'après la recette de l'étape 2c. Retour arrière : script `093` puis `git revert -m 1 <fusion>`.
