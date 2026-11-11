# Réglage des couleurs de la bannière — Ika So

Ajout du réglage des couleurs de la bannière d’accueil depuis l’administration.

## Nouveaux champs (stockés dans `ika_homepage_settings.config`)

| Champ            | Défaut     | Description                              |
|------------------|------------|------------------------------------------|
| `overlayColor`   | `#091f19`  | Couleur de l’overlay (dégradé gauche→droite) |
| `overlayOpacity` | `0.75`     | Opacité de l’overlay (0 à 1)             |
| `accentColor`    | `#C9EF75`  | Couleur d’accent (titre em, badge, points) |
| `textColor`      | `#ffffff`  | Couleur du texte principal               |

## Fichiers modifiés

- `server/services/homepage-settings.js` : DEFAULTS, LIMITS, validation hex + opacité.
- `public/css/ika.css` : règles utilisant les variables CSS `--hero-overlay`, `--hero-overlay-opacity`, `--hero-accent`, `--hero-text`.
- `public/js/pages/home.js` : application des variables sur la bannière publique.
- `public/js/admin.js` : champs de saisie (color picker + slider opacité) + aperçu en direct.

## Utilisation

Dans l’onglet **Page d’accueil** du centre de contrôle :

1. Choisir les couleurs avec les sélecteurs.
2. Régler l’opacité avec le curseur.
3. L’aperçu se met à jour immédiatement.
4. Cliquer sur **Enregistrer les modifications**.

Les valeurs par défaut respectent la palette forêt / lime / sable.

## Bouton de prévisualisation

Ajout dans l’onglet **Page d’accueil** :

- **Prévisualiser la page d’accueil** : ouvre la version publique actuelle dans un nouvel onglet.
- **Voir l’aperçu du brouillon** : fait défiler jusqu’à l’aperçu en direct des modifications non encore enregistrées.

Les deux boutons sont placés à côté de « Enregistrer » et « Annuler ».
