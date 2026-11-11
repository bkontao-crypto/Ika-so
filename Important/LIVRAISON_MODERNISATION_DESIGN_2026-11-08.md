# Livraison — modernisation du design IKA SO (référence : Index_moderne.html)

## Ce qui a été fait
Frontend uniquement (`public/`). Serveur, base de données, migrations, API, rôles et permissions : **inchangés**.

| Fichier | Changement |
|---|---|
| `public/js/components/chrome.js` | Six onglets de la référence, icônes réelles, bouton Publier, thème |
| `public/js/pages/home.js` | Accueil (hero, catégories, sponsorisées, aperçu) + page Annonces (filtres d'origine) |
| `public/js/pages/localisation.js` | Onglet Carte : recherche fonctionnelle + carte publique ; « Mes biens localisés » conservé |
| `public/js/pages/partners.js` (nouveau) | Onglet Partenaires, liens vers les fonctions réelles |
| `public/js/app.js` | Routes `#/annonces`, `#/partenaires` ; recherche rapide vers Annonces |
| `public/css/modern.css`, `public/index.html`, `public/sw.js` | Styles de référence, logo, cache hors connexion |
| `public/media/logo-ika-so.webp` (nouveau) | Logo extrait du HTML de référence |

## Décisions à connaître
- **Annonces sponsorisées** : branchées sur les annonces réellement « mises à la une » (offre payante existante). Sans annonce à la une, un message d'invitation s'affiche ; aucune publication fictive n'est inventée.
- **Campagnes `SPONSORED` (table `ika_campaigns`)** : non affichées — aucune route publique ni activation n'existe dans le projet (création en BROUILLON seulement). À décider avant de les brancher.
- **Espaces publicitaires de la référence** : la section « Partenaires » pointe vers des fonctions réelles (mise à la une, annuaire des agences, espace agence) ; les emplacements de démonstration (tarifs, annonceurs) n'ont pas été reproduits.
- Le bloc de recherche n'est plus sur l'accueil ; il est dans Carte, et les filtres d'origine restent sur Annonces.

## Tests réalisés (Chromium, API simulée) : 35/35
Onglets, ordre sponsorisées → annonces, Carte (filtres bien envoyés à `/listings`), recherche rapide, catégories, utilisateur connecté (badge messages, Mes biens localisés), thème sombre (bascule), absence de débordement horizontal à 390 px, aucune erreur JavaScript.

## Non testé — à vérifier de votre côté
- Avec PostgreSQL et de vraies annonces (mise à la une, favoris, recherche enregistrée).
- Pages non retouchées (publier, profil, messagerie, admin, connexion…) : seul un affichage de contenu a été contrôlé ; leur rendu en **mode sombre** et sur **téléphone réel** n'a pas été vérifié.
- Carte Mapbox (clé requise) ; la carte locale de secours a été vérifiée.
- Suite `npm test` : le dossier `test/` n'est pas dans l'archive reçue, elle n'a donc pas pu être lancée.

## Installation
Inchangée : `npm install`, `.env` selon `.env.example`, `npm run migrate`, `npm start`. Après déploiement, `npm run stamp-sw` si des fichiers publics changent encore.
