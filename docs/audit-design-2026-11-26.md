# Audit de cohérence du design — 26 novembre 2026

Baba KONTAO dit Mister

**Version auditée :** `main` au commit `c873fb7` (après les couleurs lot B3 et la double authentification).
**Méthode :** vrai serveur et vraie base PostgreSQL en local, compte superadmin, 5 annonces de test. Chromium a parcouru 47 écrans : 28 écrans du site, 12 modules de la console propriétaire, 5 pages SEO, Mes leads et le Journal d'audit. Chaque écran a été mesuré à 1280 px (thème clair, puis préférence système sombre) et à 390 px (mobile). Les styles calculés relevés sont : boutons, champs, titres, cartes, polices et débordement horizontal.
**Hors périmètre :** les vrais téléphones, le thème sombre activé par le bouton du site, les états interactifs (survol, focus, chargement) et les fenêtres modales.

## Ce qui est cohérent

- **Mobile :** aucun débordement horizontal à 390 px sur les 47 écrans.
- **Site public et espace connecté :** une seule paire de polices (Plus Jakarta Sans pour le texte, Outfit pour les titres) et des couleurs de bouton communes (vert `btn-primary`, or `btn-gold`, contour `btn-outline`).
- **Console propriétaire :** cohérente avec elle-même (même police, mêmes boutons et mêmes cartes sur les 12 modules).

## Écarts constatés (par priorité)

### P1 — Défauts visibles
1. **Le bouton `btn-dark` ne s'affiche pas en sombre.** `components.css`, chargé en dernier, réécrit le fond de `.btn` et annule `.btn-dark` (défini dans `refonte.css`). Les boutons « Appeler » (fiche annonce), « Recevoir le code » (Publier) et « Supprimer définitivement » (Paramètres) sont donc blancs comme des boutons secondaires. 7 fichiers JS utilisent cette classe.
2. **Pages SEO** (`/quartiers`, `/quartier/…`, `/guides`, `/agences`, `/conditions`) : elles ont leur propre identité, avec la feuille `ika.css`, les polices DM Sans et Manrope, l'en-tête « ika so. », un bouton vert citron (`btn-lime`) et des cartes à 24 px. Le lot B3 a aligné les couleurs, mais les polices, l'en-tête et la forme des boutons restent différents du site.
3. **Mes leads et Journal d'audit :** les boutons sont en Arial, car ces pages n'héritent pas de la police (`button { font: inherit }` manque).

### P2 — Plusieurs « familles » de boutons pour un même rôle
4. **Deux formes dans le même écran.** Les boutons normaux sont des rectangles arrondis à 14 px ; les `btn-small` sont des pilules à 999 px. Par exemple, la fiche annonce montre à la fois des boutons de 50 px à 14 px et des pilules de 36 px.
5. **Hauteurs variables :** 44, 50, 52 et 54 px (une `btn-small` atteint 54 px sur la fiche quand son texte passe à la ligne).
6. **Familles parallèles avec leurs propres réglages :**

| Famille | Écran | Rayon | Hauteur | Police |
|---|---|---|---|---|
| `pc-btn` (sans bordure, graisse 800) | Agence, Centre, Mes annonces, Premium | 999 px | 44 px | site |
| `sc-btn` (sans bordure) | Fiche annonce | 10 px | 37 px | site |
| `wa-btn` | WhatsApp | 999 px | 34 px | site |
| `bx-btn`, onglets et filtres | Boîte | 12 px / 9999 px | 30 à 40 px | **Inter** |
| `mp-btn` (alias de `.btn`) | Profil | 14 px / 999 px | 36 à 44 px | site |

7. Le **rayon de 14 px** des boutons ne fait pas partie de l'échelle de `docs/design-system.md` (12, 20, 28 px).

### P2 — Champs de saisie
8. **Deux styles de champ sur le site :**
   - recherche, filtres, Publier, Devenir annonceur, Réclamations et Paramètres : 47 px de haut, rayon 10 px, **texte en 12 px** ;
   - connexion, Profil, Centre et fiche : 48 px, rayon 14 px, texte en 16 px.

   Sur iPhone, un champ en 12 px fait **zoomer la page** à la saisie.
9. **Boîte :** encore un troisième style (35 à 42 px, rayon 12 px, texte en 12 à 14 px).

### P3 — Typographie et cartes
10. **Taille des titres de page (H1) :** 27,2 px, 28 px, 29 px, 30 px (Boîte, en Plus Jakarta et non en Outfit) ou 32 px selon l'écran. Les écrans « Réclamations » et « Profil annonceur » n'ont pas de H1.
11. **Rayon des cartes :** 20 px (majorité), mais 28 px (Annonces, Carte), 18 px (Premium), 16 px, 12 px (Confiance) et 24 px (SEO).
12. **Console propriétaire :** autre système (police Inter, boutons à 10 px de rayon et 36 à 39 px de haut, cartes à 14 px, champs en 11 px). Ce choix peut être volontaire pour un outil interne ; c'est au propriétaire de trancher.
13. **Thème sombre :** seul le bouton du site l'active. La préférence sombre du téléphone n'est pas suivie (aucun écran testé n'est passé en sombre). À confirmer : est-ce voulu ?

## Corrections proposées (non appliquées)

- **Lot 1, sans risque :** rétablir `btn-dark` dans `components.css` ; ajouter `button { font: inherit }` à Mes leads et au Journal d'audit ; passer les champs à 16 px sur mobile.
- **Lot 2 :** une seule forme de bouton (décision : pilule partout ou rectangle à 12 px partout), deux hauteurs (44 px et petite à 36 px) ; rattacher `pc-btn`, `sc-btn`, `wa-btn` et `bx-btn` à `.btn` et ses variantes.
- **Lot 3 :** un seul style de champ ; une seule taille de H1 et un seul rayon de carte ; polices Inter retirées de la Boîte.
- **Lot 4, décision du propriétaire :** aligner ou non les pages SEO (polices, en-tête) et la console propriétaire sur le site.
