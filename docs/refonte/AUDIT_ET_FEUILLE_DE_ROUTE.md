# IKA SO — Refonte « nouvelle génération » : audit, état d'avancement et feuille de route

Mise à jour : 11 novembre 2026 · Version : refonte étape 1

**Environnement de travail** : PostgreSQL 18, Node.js ≥ 22, exécution en local (`localhost`) ; pas de GitHub ni de Render pour le moment.

## 1. Audit (Phase 1) — constats

| Sujet | Constat |
|---|---|
| Architecture | Node/Express 5 + PostgreSQL, front SPA en modules ES (`public/js`), routeur par hash (`#/…`), 24 routes front, 51 migrations, 3 dépendances npm. |
| Sécurité front | CSP stricte (`style-src 'self'`, `font-src 'self'`, pas de scripts/styles inline) : le design doit rester 100 % fichiers locaux. Aucune police Google possible sans auto-hébergement. |
| Design existant | 3 couches CSS empilées (`ika.css` → `modern.css` → `espace.css`/`profil.css`/`owner.css`), deux familles de variables (`--paper/--card/--leaf…` et `--page/--surface/--green…`), mode sombre par `data-theme` ET par `prefers-color-scheme`. |
| Maquettes fournies | 10 maquettes HTML, thème sombre vert profond `#07160F` / surface `#0E2A1E` / vert `#1E9E68` / or `#F0B429`, polices Outfit + Plus Jakarta Sans. |
| Modèle de données | **4 catégories seulement** (Terrain, Maison, Appartement, Studio) et 2 transactions (Vente, Location). Il n'existe ni « local commercial » ni « bureau » : ces sections du cahier des charges ne sont donc **pas** affichées (voir §4). |
| Recherche | Filtres existants : transaction, catégorie, quartier, prix min/max, surface, chambres, texte, tri. La carte Mapbox exige une clé ; une carte locale de secours existe. |
| Tests existants | 91 tests (`npm test`) : 88 passent, 3 ignorés (intégration PostgreSQL). |

## 2. Ce qui est fait (Phases 2, 3 et 4 partielles)

**Identité et design system** — `public/css/refonte.css` (chargé en dernier)
- Tokens clair (ivoire / vert profond / or discret) et sombre (palette des maquettes), mappés sur les **deux** familles de variables : toutes les pages existantes (profil, centre annonceur, premium, admin, messagerie, fiche…) adoptent la nouvelle identité sans changement de logique.
- Composants harmonisés : boutons, champs, sélecteurs, cartes, badges, onglets, tableaux, modales, toasts, squelettes de chargement, états vides, tiroirs latéraux.
- Animations légères (apparition progressive, survol des cartes, ouverture des menus), désactivées si `prefers-reduced-motion`.
- Focus clavier visible (anneau doré), contrastes revus (texte sombre sur or / sur vert en mode sombre).

**Navigation** — `components/chrome.js`
- Bureau : Accueil · Acheter · Louer · Terrains · Carte · Annonceurs · Partenaires, bouton Publier, messages (avec compteur), thème, menu du profil.
- Mobile : barre du bas à 5 accès (Accueil, Annonces, **Publier** au centre, Carte, Compte) + menu tiroir complet.
- Les 24 routes d'origine restent accessibles.

**Accueil** — `pages/home-sections.js`
- Héros avec photo et textes pilotés par `/homepage-settings` (réglages Owner Control conservés), recherche avancée (Acheter/Louer/Terrains, quartier, type, budget min/max) qui alimente la page Annonces.
- Sections branchées sur les API réelles : biens à la une (campagnes SPONSORED + annonces « à la une »), dernières annonces, terrains, villas et appartements, quartiers, annonceurs recommandés (`/advertisers`), partenaires (campagnes sidebar), guides, comment ça marche, confiance, devenir annonceur. **Une section sans donnée réelle est masquée** ; aucun chiffre, avis ou badge inventé.

**Recherche** — `pages/home.js`
- Trois modes : grille, liste, carte ; tiroir latéral de filtres (Échap / clic extérieur) ; budget minimum ajouté ; filtres lisibles par l'adresse (`minPrice`, `vue`).

**Pied de page** professionnel en 4 colonnes (liens vers routes réelles).

## 3. Tests réalisés (serveur simulé, sans PostgreSQL)

- `npm test` : 88/88 réussis, 3 ignorés, 0 échec.
- Parcours navigateur Chromium : **25 routes × visiteur/connecté × clair/sombre × bureau 1280 px/mobile 390 px = 200 affichages, 0 erreur JavaScript, 0 débordement horizontal**.
- 30 contrôles d'interaction : recherche du héros → filtres reçus par l'API, vues grille/liste/carte, tiroir, thème, onglet actif, favoris (POST), menu profil, barre mobile.

**Non testé** (à faire de votre côté sur la vraie base) : paiements, SMS, Mapbox avec clé, envoi de fichiers, rôles admin/owner réels, appareils physiques Android/iPhone. Les pages `/annonce/…` et `/annonceur/…` n'ont pas pu être validées avec le serveur simulé (données de démonstration incomplètes).

## 4. Décisions à prendre (avant de continuer)

1. **Immobilier commercial et bureaux** : absents du modèle de données. Les ajouter touche la validation serveur, la recherche et le formulaire de publication. Souhaitez-vous ces nouvelles catégories ?
2. **Polices Outfit / Plus Jakarta Sans** : la CSP interdit les polices externes. Pour les obtenir, placer les fichiers `.woff2` dans `public/fonts/` (auto-hébergés) ; sinon la pile de polices système est utilisée.
3. **Thème par défaut** : actuellement clair (ivoire) avec bascule sombre mémorisée. Les maquettes sont sombres : faut-il passer le sombre par défaut ?

## 5. Reste à faire (Phase 3 suite)

| Priorité | Chantier |
|---|---|
| 1 | Fiche annonce : galerie immersive, bloc vendeur, annonces similaires (`pages/listing.js`, `fiche.css`) |
| 2 | Espace particulier : tableau de bord, favoris, recherches, réclamations (maquettes `tableau_de_board`, `Profil_compte_connecté`) |
| 3 | Publication d'annonce en étapes (maquette `Publier_une_annonce`) |
| 4 | Espace annonceur / Premium : statistiques, boost (maquettes `Statistiques`, `Booster_une_annonce`, `Centre_de_contrôle_Premium`) |
| 5 | Admin et Owner Control : relecture des tableaux et menus latéraux avec la nouvelle charte |
| 6 | Page Carte (maquette `Carte_`) et Centre de confiance (maquette `Centre_de_confiance`) |
| 7 | Nettoyage : code mort `isHome` dans `home.js`, fusion progressive de `modern.css` dans `refonte.css` |

## 6. Étape suivante proposée
Fiche annonce + espace particulier (priorités 1 et 2), puis recette sur votre base PostgreSQL 18 locale.

## 7. Lancer le projet
```
npm install
copier .env.example vers .env (base PostgreSQL 18 locale)
npm run migrate
npm start        # http://localhost:<port>
npm run stamp-sw # si des fichiers publics changent
```
