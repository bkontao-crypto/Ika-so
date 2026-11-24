# Livraison — Onglets de « Mon profil » façon Facebook (24 novembre 2026)

Branche : `feat/profil-onglets`.

## À réaliser
Sur `#/profil` : onglets qui ne débordent plus, créer les onglets manquants (À propos, Photos, Vidéos), menu « Plus ▾ », et menu « ••• » des actions du profil (modèle : capture Facebook du propriétaire).

## Réalisé
- Nouveau composant `public/js/components/profile-tabs.js` : barre d'onglets sans défilement horizontal. Les onglets qui ne tiennent pas dans la largeur passent automatiquement dans « Plus ▾ » (recalcul au redimensionnement). Échap, clic extérieur et flèches haut / bas gérés.
- Menu « ••• » en trois rubriques, branché uniquement sur des pages et actions qui existent déjà : Mon profil (profil public, modifier mes informations, vérification et badges), Outils professionnels (`#/publier`, `#/mes-annonces`, `#/alertes`, `#/premium`), Contenu du profil (mes publications, export des données).
- `public/js/pages/mon-profil.js` : 9 onglets au lieu de 6 — Publications · À propos · Vidéos (n) · Photos (n) · Mes annonces (n) · Avis (n) · Abonnés (n) · Équipe · Paramètres & Confidentialité. « À propos » reprend les cartes À propos, Services proposés et Score de confiance. Photos et Vidéos n'affichent que les publications réelles du compte.
- `public/css/profil-onglets.css` (nouveau, chargé par le composant) ; l'en-tête passe en `overflow: visible` (classe `mp-header-pop`) pour que les menus ne soient pas coupés.
- `#/profil?tab=apropos|videos|photos` fonctionnent.

## Vérifié
- Syntaxe JavaScript de `profile-tabs.js` (`node --check`) : OK.
- **Non exécuté** : `npm test`, `npm run stamp-sw`, essai navigateur (320 / 390 / 1100 px, mode sombre).

## En cours
Contrôle visuel par le propriétaire sur le site après déploiement.

## À faire
1. `npm run stamp-sw` (`mon-profil.js` est dans le `SHELL` de `public/sw.js` : la version du cache hors connexion est périmée tant qu'elle n'est pas recalculée ; `stamp-sw:check` échouera).
2. `npm test`.
3. Mettre à jour `Important/SUIVI.md` (non modifié ici : l'outil de dépôt oblige à renvoyer tout le fichier).

## Risques
- Mise en page non testée en navigateur ; le calcul de largeur de « Plus » dépend des polices (recalcul prévu au chargement des polices).
- Les navigateurs ayant déjà le cache hors connexion peuvent garder l'ancien `mon-profil.js` jusqu'au prochain `stamp-sw`.
- Le profil public d'un annonceur (`advertiser.js`) n'est pas modifié.
- Retour arrière : `git revert` du commit de fusion.
