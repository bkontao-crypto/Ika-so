# Procédure de recette réelle du fond Mapbox (lot A confidentialité)

Statut : préparée, **non exécutée** à ce jour (aucun jeton de test disponible dans l'environnement de l'agent).

## Règles de sécurité
- Jamais le jeton de production. Jamais de jeton dans le dépôt, les journaux, une capture d'écran ou un message.
- Jeton de test : public (« pk. »), restreint à `localhost` dans le compte Mapbox, révocable.
- Ne pas modifier les variables Render. Tout le test se fait sur un poste local.

## Prérequis
1. Base de test locale (PostgreSQL), non production. Une annonce **publiée** et **géolocalisée** (point ou contour) en base.
2. Serveur local lancé avec `MAPBOX_TOKEN=<jeton de test>` (variable d'environnement uniquement).
3. Playwright installé (`npm i -D playwright && npx playwright install chromium`).

## Lancement
```
MAPBOX_TEST_TOKEN=<jeton de test> RECETTE_BASE_URL=http://localhost:3000 RECETTE_LISTING_ID=<id> node scripts/recette/mapbox-consentement.mjs
```
Le script affiche un résumé JSON (sans jeton) et sort avec le code 1 si un contrôle échoue.

## Contrôles automatisés (script)
1. Première visite sans consentement : aucune requête vers mapbox.com ni `/api/config/map`.
1b. Aucune clé `mapbox*` dans le stockage du navigateur.
2. Acceptation de « Cartes et services externes » enregistrée.
3. Après acceptation : le serveur fournit le jeton (oui/non), la requête est faite, la bibliothèque Mapbox est présente, des requêtes de tuiles sont émises.
4. L'annonce géolocalisée est affichée.
5. Retrait du consentement, puis effacement des clés `mapbox*`.
6. Retour à la carte locale après retrait.
7. Aucune requête Mapbox après retrait.
Plus : aucune erreur JavaScript.

## Contrôles à faire à la main (non automatisés)
- Affichage visuel du fond satellite / rues et des repères sur mobile et ordinateur.
- Comportement hors connexion.
- Facturation et quotas du compte Mapbox (à surveiller, hors code).
- Restriction du jeton aux domaines du site (réglage dans le compte Mapbox).

## Contrôles impossibles dans l'environnement de l'agent
- Rendu réel du fond Mapbox : aucun jeton de test disponible ; `api.mapbox.com` et `events.mapbox.com` injoignables depuis l'environnement (code 000).
- Télémétrie réelle envoyée à Mapbox : idem.
- Vérification du jeton de production : interdit par consigne, et aucun accès à Render.
- Restriction du jeton dans le compte Mapbox : accès réservé au propriétaire.

## Résultat attendu
Les 7 contrôles et « Aucune erreur JavaScript » sont verts. Le résultat est consigné dans `Important/IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx` (feuille « Suivi confidentialité »), sans valeur de jeton.
