# Design system IKA SO v3

Fichier : `public/css/refonte.css` (chargé après `ika.css` et `modern.css`).

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#f7f4ec` | `#07160f` |
| Surface (cartes) | `#fffdf8` | `#0e2a1e` |
| Texte / secondaire | `#14201a` / `#5c6a62` | `#fbf8f1` / `#a0b0a6` |
| Vert d'action (`--leaf`) | `#12734b` | `#1e9e68` |
| Or discret (`--gold`, `--lime`) | `#e8b23a` | `#f0b429` |
| Vert profond (`--forest`) | `#0b2a1d` | `#04100a` |

Règles : l'or est réservé aux actions principales et au premium ; le vert porte l'identité ; les statuts utilisent `--danger`, `--warn`, `--ok`, `--info`. Rayons 12 / 20 / 28 px. Typographie : `--display` (Outfit si installée) pour titres et prix, `--font` pour le texte ; chiffres tabulaires. Les variables historiques (`--paper`, `--card`, `--leaf`, `--page`, `--surface`…) sont toutes redéfinies : une page ancienne suit automatiquement le thème.

Composants : `.btn(-primary|-gold|-outline|-quiet)`, `.input`, `.card`, `.pill(-green|-gold|-warn)`, `.listing`, `.rx-tabs`, `.rx-viewbar`, `.rx-drawer`, `.skeleton`, `.empty-state`, `.table`, `dialog`, `.toast`. Animations : `.rx-reveal` (apparition), respect de `prefers-reduced-motion`.
Contraintes : aucun style inline ni police externe (CSP `style-src 'self'`, `font-src 'self'`).

## Règles d'harmonisation (audit du 26/11/2026, lots 1 à 4)

Décisions du propriétaire, appliquées sur le site, les pages isolées et les pages SEO (la console propriétaire garde son propre style) :

- **Boutons :** rectangle arrondi partout, rayon 12 px (`--btn-radius`), jamais de pilule. Deux hauteurs : normale 44 px, petite 36 px (`btn-small`). Les boutons-icônes ronds, onglets, puces de filtre et badges ne sont pas des boutons d'action et gardent leur forme.
- **Bouton sombre :** `btn-dark` (vert forêt), défini dans `components.css`.
- **Champs :** 44 px de haut, rayon 12 px, texte 15 px ; 16 px sur mobile et écrans tactiles (évite le zoom de l'iPhone).
- **Titre de page (H1) :** Outfit 800, 28 px (24 px sur mobile). Les bandeaux d'accueil, Premium et Centre gardent leur grande taille.
- **Cartes :** rayon 20 px ; le grand panneau de recherche garde le grand rayon (28 px).
- **Polices :** Plus Jakarta Sans (texte) et Outfit (titres) partout, y compris la Boîte, Mes leads, le Journal d'audit et les pages SEO.
- Code : blocs « Lot 2 » et « Lot 3 » en fin de `public/css/components.css`, bloc « Lot 4 » en fin de `public/css/seo.css`.
