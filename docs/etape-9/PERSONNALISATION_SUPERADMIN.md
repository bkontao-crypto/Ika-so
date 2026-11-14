# Personnalisation Superadmin (E09)

## Existant
- `homepageSettings` : réglages de la page d'accueil (`GET /homepage-settings`, `PUT /staff/homepage-settings`).
- Owner Center : journal de sécurité, délégations.
- Nombreux endpoints `/staff/*` pour la modération, les offres, les comptes, etc.

## Axes de personnalisation proposés
1. **Textes et messages** : titres, slogans, messages d'accueil, textes de confiance.
2. **Apparence** : couleurs d'accent (déjà partiellement via jetons CSS), logo, favicon.
3. **Fonctionnalités** : activation/désactivation de modules (CRM, carte, Premium, etc.).
4. **Contenu** : partenaires, bannières, sections de la homepage.

## Premier lot
- Esquisse d'une table `ika_superadmin_settings` (clé/valeur JSON).
- Endpoint staff pour lire/écrire des réglages génériques.
- Page simple de consultation/édition.

**Statut** : cadrage prêt.
