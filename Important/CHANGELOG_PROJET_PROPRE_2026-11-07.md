# Ika So — Projet propre et prêt à l’emploi (07/11/2026)

## Corrections appliquées

### Palette visuelle
- Suppression de l’override bleu/or dans `public/css/ika.css`.
- Alignement sur la charte **forêt / lime / sable** (`#102C25`, `#1E6B50`, `#C9EF75`, `#F6F5EF`).
- Règles dynamiques de la bannière conservées (variables CSS `--hero-overlay`, `--hero-overlay-opacity`, `--hero-accent`, `--hero-text`).

### Personnalisation de la bannière
- Réglage des couleurs (overlay, opacité, accent, texte) opérationnel.
- Normalisation hex (`#RGB` → `#RRGGBB`) côté serveur et admin.
- Boutons de prévisualisation : « Prévisualiser la page d’accueil » et « Voir l’aperçu du brouillon ».
- `pending_image` explicitement retiré après enregistrement.

### Migrations & tests
- Ajout de `scripts/rollback/028_homepage_settings_down.sql`.
- Tests étendus pour les couleurs et l’opacité (16/16 OK).

### Documentation
- Note de palette officielle ajoutée dans `SUIVI.md`.

## État
Projet prêt pour installation, migration et recette.  
Les identifiants visiteurs/sessions restent désactivés par défaut (conformité).
