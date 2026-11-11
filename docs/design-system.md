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
