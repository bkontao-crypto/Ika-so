# Ika So — livraison mise à jour

Date : 7 novembre 2026

Cette livraison reprend le dernier paquet technique disponible et regroupe les correctifs déjà présents dans le code.

## Inclus dans cette livraison

- Référentiel analytique avec les 22 types d'événements autorisés et validation par liste blanche.
- Émissions serveur déjà raccordées pour les pages vues, consultations d'annonces, clics de contact, demandes de contact et paiements (selon les parcours raccordés dans les routes/services).
- Classification des appareils, robots et sources de trafic.
- Protection DNT / Global Privacy Control.
- Consentement statistique individuel, possibilité de retrait et anonymisation de l'identifiant de compte sur les événements antérieurs.
- Migrations SQL pour événements, sessions, visiteurs journaliers et consentement statistique.
- Tests automatisés ciblés sur les événements, migrations, consentement et droits.
- Palette documentaire et suivi du projet mis à jour selon la direction forêt / lime / sable.

## État à ne pas confondre avec une activation en production

Les colonnes et tables de sessions/visiteurs sont préparées, mais `visitor_id` et `session_id` restent volontairement à `null` dans le générateur d'événements. Le comptage des visiteurs uniques et des sessions n'est donc pas activé par cette livraison.

Le tableau de bord analytique administrateur avec filtres et export Excel n'est pas raccordé comme fonctionnalité achevée dans cette version. Le dossier juridique prévoit une validation préalable du texte de consentement et du dispositif de mesure au regard des obligations applicables au Mali (notamment APDP).

Ne pas activer la collecte nominative ou les identifiants persistants en production avant validation juridique, configuration serveur et exécution des migrations.

## Déploiement

1. Sauvegarder la base et les fichiers.
2. Installer les dépendances avec `npm install` (Node.js 22 ou supérieur).
3. Vérifier les variables d'environnement avec `npm run check-env`.
4. Appliquer les migrations avec `npm run migrate` après validation de la sauvegarde.
5. Exécuter `npm test`.
6. Garder `ANALYTICS_ENABLED` désactivé tant que le texte et le dispositif de consentement ne sont pas validés.

## Limite de vérification

Cette archive est une livraison du code présent dans le paquet source mis à jour. Elle ne constitue pas une preuve de déploiement sur un serveur réel ni de validation PostgreSQL en production. Les tests nécessitent les dépendances et, pour les tests d'intégration concernés, un environnement de base de données compatible.

## Mise à jour — correctifs après vérification (2e livraison du 7 novembre)

Voir la section « Correctifs de la page d'accueil et des événements » de `SUIVI.md`. Points à retenir : l'import de photo d'accueil produit désormais une photo en attente, publiée seulement par « Enregistrer » ; les adresses de photo externes sont refusées ; les 9 événements sont affichés dans les statistiques. Toujours non livrés : visiteurs uniques, sessions, tableau de bord complet, export Excel, réglage des couleurs de la bannière.
