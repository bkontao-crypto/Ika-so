# IKA SO — Refonte « nouvelle génération » : audit, état d'avancement et feuille de route

Mise à jour : 11 novembre 2026 · Version : refonte étape 1 + décisions (catégories, polices, thème)

**Environnement de travail** : PostgreSQL 18, Node.js ≥ 22, exécution en local (`localhost`) ; pas de GitHub ni de Render pour le moment.

## 1. Audit (Phase 1) — constats

| Sujet | Constat |
|---|---|
| Architecture | Node/Express 5 + PostgreSQL, front SPA en modules ES (`public/js`), routeur par hash (`#/…`), 24 routes front, 51 migrations, 3 dépendances npm. |
| Sécurité front | CSP stricte (`style-src 'self'`, `font-src 'self'`, pas de scripts/styles inline) : le design doit rester 100 % fichiers locaux. Aucune police Google possible sans auto-hébergement. |
| Design existant | 3 couches CSS empilées (`ika.css` → `modern.css` → `espace.css`/`profil.css`/`owner.css`), deux familles de variables (`--paper/--card/--leaf…` et `--page/--surface/--green…`), mode sombre par `data-theme` ET par `prefers-color-scheme`. |
| Maquettes fournies | 10 maquettes HTML, thème sombre vert profond `#07160F` / surface `#0E2A1E` / vert `#1E9E68` / or `#F0B429`, polices Outfit + Plus Jakarta Sans. |
| Modèle de données | 4 catégories à l'origine (Terrain, Maison, Appartement, Studio), **portées à 6** avec « Local commercial » et « Bureau » (voir §4) ; 2 transactions (Vente, Location). |
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

## 2 bis. Page « Mon profil » (`#/profil`) — faite d'après la maquette `Profil_compte_connecté`

- Couverture, photo de profil, nom, « Membre depuis… · ville », badges, boutons **Modifier la photo** et **Gérer mon compte**, quatre onglets : Publications · Mes annonces (n) · Avis (n) · Paramètres & Confidentialité (`public/js/pages/mon-profil.js`, `public/css/mon-profil.css`).
- **Modifiable sur place** : photo et couverture (envoi / retrait), nom, ville, présentation (et zones, année, adresse, horaires selon le type de compte), publications (ajout / suppression), interrupteurs « Afficher mon numéro », « WhatsApp » et « Statistiques d'annonces ».
- Données réelles uniquement : score de confiance (même calcul que l'annuaire : 40 / 20 / 20 / 20), annonces avec filtres En ligne / En attente / Refusées, avis reçus, justificatifs.
- Nouveautés serveur : `PUT /me/identity` (nom affiché), `GET /me/score`, champ `city` (migration `053_profil_ville.sql`).
- L'ancienne page « Mon profil unique » est conservée dans l'onglet Paramètres (« Autres réglages du compte ») : rôles, accès staff / Premium, alertes, newsletter, devenir annonceur, export et suppression du compte.

## 3. Tests réalisés (serveur simulé, sans PostgreSQL)

- `npm test` : 91/91 réussis (dont 3 nouveaux tests sur les catégories), 3 ignorés, 0 échec.
- Parcours navigateur Chromium : **25 routes × visiteur/connecté × clair/sombre × bureau 1280 px/mobile 390 px = 200 affichages, 0 erreur JavaScript, 0 débordement horizontal**.
- 30 contrôles d'interaction : recherche du héros → filtres reçus par l'API, vues grille/liste/carte, tiroir, thème, onglet actif, favoris (POST), menu profil, barre mobile.

**Non testé** (à faire de votre côté sur la vraie base) : paiements, SMS, Mapbox avec clé, envoi de fichiers, rôles admin/owner réels, appareils physiques Android/iPhone. Les pages `/annonce/…` et `/annonceur/…` n'ont pas pu être validées avec le serveur simulé (données de démonstration incomplètes).

## 4. Décisions prises (11 novembre 2026)

1. **Immobilier commercial et bureaux : ajoutés.** Deux nouvelles catégories, « Local commercial » et « Bureau » (migration `052_categories_commercial_bureau.sql`). Elles n'ont ni chambres ni salles de bain ; la superficie en m² et le document (bail, titre…) sont obligatoires. Prises en compte dans la validation serveur, l'import CSV, les brouillons, le formulaire de publication, les filtres de recherche, la fiche annonce, la page Localisation et l'accueil (6 tuiles de catégories). À lancer : `npm run migrate`.
2. **Polices auto-hébergées.** `@font-face` déclaré dans `refonte.css` ; déposer `Outfit-Variable.woff2` et `PlusJakartaSans-Variable.woff2` dans `public/fonts/` (instructions dans `public/fonts/LISEZMOI.txt`), puis `npm run stamp-sw`. Sans ces fichiers, polices du système.
3. **Thème par défaut : clair.** Désormais garanti même sur un appareil en mode sombre : `data-theme="light"` posé dans les trois pages HTML, et les règles sombres des anciennes feuilles CSS ne s'activent plus que si l'utilisateur choisit le mode sombre (bascule mémorisée).

## 5. Reste à faire (Phase 3 suite)

| Priorité | Chantier |
|---|---|
| 1 | Fiche annonce : galerie immersive, bloc vendeur, annonces similaires (`pages/listing.js`, `fiche.css`) |
| 2 | Espace particulier : tableau de bord, favoris, recherches, réclamations (maquette `tableau_de_board`). **Profil (`Profil_compte_connecté`) : fait**, voir §2 bis |
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
