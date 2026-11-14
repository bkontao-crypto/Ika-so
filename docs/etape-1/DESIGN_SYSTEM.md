# Système de design — Étape 1 (v0.2)

Relevé **automatique** des feuilles de style (`public/css/*.css`) et des composants utilisés dans `public/js`. Il décrit l'existant ; l'étape 2 l'unifie.

## 1. Jetons (variables CSS)

66 variables définies. Principales :

| Variable | Valeur |
|---|---|
| `--forest` | `#102c25` |
| `--leaf` | `#1e6b50` |
| `--lime` | `#c9ef75` |
| `--ink` | `#17231e` |
| `--muted` | `#56625b` |
| `--paper` | `#f6f5ef` |
| `--card` | `#fff` |
| `--line` | `#e7e5dc` |
| `--danger` | `#9f1d1d` |
| `--gold` | `#c9ef75` |
| `--gold-soft` | `#eef8d2` |
| `--gold-text` | `#3d5a0c` |
| `--green-text` | `#1e6b50` |
| `--radius` | `24px` |
| `--radius-sm` | `12px` |
| `--shadow` | `0 18px 55px rgba(16,44,37,.10)` |
| `--font` | `"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif` |
| `--display` | `Manrope,"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif` |
| `--wrap` | `1280px` |

Autres familles : `--ika-*` (échelle de verts), `--s-*` (surfaces de pages), `--bn-*` (barre basse mobile, zone sûre).

## 2. Thèmes
Clair et sombre par l'attribut `data-theme` sur `<html>` (`light` par défaut, basculé par `js/seo-theme.js`) ; des règles sombres existent dans 7 feuilles. **Contraste, lisibilité et captures des deux thèmes : non vérifiés (pas de navigateur) → étape 2.**

## 3. Points d'arrêt responsive
`max-width:900px` (7), `min-width:640px` (6), `max-width: 560px` (4), `max-width: 900px` (4), `min-width:1024px` (4), `max-width: 1100px` (3), `min-width: 1101px` (3), `max-width: 640px` (3).

## 4. Composants réellement utilisés (fréquence dans le code)

| Classe | Usages |
|---|---|
| `.btn` | 245 |
| `.muted` | 178 |
| `.small` | 160 |
| `.card` | 129 |
| `.pad` | 108 |
| `.stack` | 106 |
| `.btn-small` | 96 |
| `.row` | 76 |
| `.input` | 75 |
| `.pill` | 43 |
| `.btn-primary` | 37 |
| `.sm` | 30 |
| `.primary` | 29 |
| `.pa-muted` | 27 |
| `.title` | 26 |
| `.grow` | 24 |
| `.field` | 22 |
| `.pa-btn` | 22 |
| `.mp-btn` | 20 |
| `.notice` | 19 |
| `.btn-quiet` | 17 |
| `.mp-card` | 17 |
| `.btn-gold` | 14 |
| `.row-between` | 14 |
| `.pill-gold` | 13 |
| `.list-item` | 12 |
| `.text-link` | 12 |
| `.mp-col` | 12 |
| `.grid` | 11 |
| `.pill-green` | 11 |

## 5. Constats (à traiter à l'étape 2)
- **Fragmentation** : quatre familles de boutons coexistent (`.btn`, `.pa-btn` profil annonceur, `.mp-btn` mon profil, et des variantes dans `owner.css`/`refonte.css`), idem pour les cartes (`.card`, `.mp-card`, `.pa-card`). Même fonction, styles différents : risque d'incohérence visuelle.
- **Une feuille par écran** : 10 fichiers CSS (`ika`, `modern`, `refonte`, `espace`, `fiche`, `mon-profil`, `profil`, `publier`, `owner`, `seo`) sans ordre de priorité documenté.
- **Styles en ligne** : 3 occurrences bloquées par la politique de sécurité (BUG-001).
- États vides, erreurs et chargement : traités page par page (classes `.notice`, `.muted`), sans composant commun.

## 6. Règles pour le design system cible (étape 2)
1. Un seul jeu de composants (bouton, carte, pastille, onglets, champ, alerte, état vide) piloté par les jetons ci-dessus.
2. Mobile d'abord ; cibles tactiles d'au moins 44 px ; `:focus-visible` partout ; `prefers-reduced-motion` respecté (déjà présent).
3. Contraste vérifié dans les deux thèmes (script `scripts/verification/seo-contrast.py` à étendre).
4. Aucun style en ligne ; aucune ressource externe ; images optimisées.
5. Chaque composant documenté avec ses états : normal, survol, focus, désactivé, chargement, vide, erreur.
