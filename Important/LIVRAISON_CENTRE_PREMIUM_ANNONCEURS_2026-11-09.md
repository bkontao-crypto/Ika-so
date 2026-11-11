# Livraison — Centre de contrôle Premium + onglet « Annonceurs » (09/11/2026)

## 1. Centre de contrôle Premium (`#/centre`)
Réservé aux annonceurs **Premium en cours ET certifiés** (agence vérifiée, ou au moins une annonce en ligne avec titre foncier contrôlé). La décision est prise par le serveur ; sans accès, la page explique ce qui manque.
- Barre latérale, bannière, 4 indicateurs, statistiques Vues/Contacts (7, 14, 30, 90 jours, variation vs période précédente), annonces récentes, messages, alertes, notifications, échéances, demandes de visite, assistance rapide.
- **Carte masquée par défaut** : « Afficher la carte » charge les repères (`GET /api/me/center/map`) puis la carte dans un petit cadre (Mapbox si configuré, sinon plan local). Masquer/réafficher ne recharge rien.
- Entrée : carte « Centre de contrôle Premium » dans `#/profil`.
- Les vues ne sont comptées que si la collecte de statistiques est active (message affiché sinon) ; les contacts (appels, WhatsApp, messages, demandes de visite) le sont déjà.

## 2. Onglet « Annonceurs » (`#/annonceurs`)
- Boostés (annonce à la une en cours) **toujours en tête**, puis score /100 : confiance 40 %, visibilité 20 %, fidélité 20 %, réactivité 20 % (`server/lib/advertiser-ranking.js`).
- Ligne : photo (ou initiales), nom, rôle, quartier, nombre d'annonces, note, taux de réponse, badges. Un appui ouvre `#/annonceur/:id`.
- Recherche (sans accents) et filtres : Boostés, Certifiés, Agences, Particuliers, Démarcheurs. Aucune donnée de contact dans l'annuaire ; photo masquée par la modération jamais affichée.

## 3. Octroi Premium
Aucune offre « Premium » n'existait. Ajout : `ika_profiles.premium_until` + historique `ika_premium_grants`.
`POST /api/staff/premium/:id { days, reason }` — super administrateur, motif obligatoire, tracé (audit `PREMIUM_GRANT`). Bouton « Accorder Premium » dans Owner Control Center. Le branchement sur un vrai paiement d'abonnement reste à décider.

## Fichiers
Nouveaux : `migrations/043_premium_annonceurs.sql` (+ rollback), `server/lib/advertiser-ranking.js`, `server/services/advertiser-center.js`, `public/js/pages/{annonceurs,centre}.js`, `public/js/components/espace.js`, `public/css/espace.css`, `test/advertiser-center.test.js`.
Modifiés : routes, services/index, app.js (routes), chrome.js (onglet), account.js, advertiser.js (retour), admin.js, sw.js, modern.css (en-tête à 7 onglets).

## Contrôles
`node --test test/advertiser-center.test.js test/owner-center.test.js` : 22/22. Fumée navigateur (Chromium, API simulée, bureau + mobile) : liste, clic vers profil, carte non demandée à l'ouverture puis une seule fois au clic, pas de défilement horizontal. **Non testé** : requêtes SQL sur PostgreSQL réel (aucune base ici) — à lancer `npm run migrate` puis recette.

## 4. Carte « Passez Premium » et page des avantages (`#/premium`)
- Carte (couronne, texte, bouton doré) affichée à **tous les annonceurs** : `#/mes-annonces`, `#/profil`, `#/agence`, centre de contrôle (colonne droite) et pied de la page des avantages. Pour un Premium actif elle devient « Votre Premium est actif » avec la date d'expiration (rappel de renouvellement à 30 jours).
- Page `#/premium` : bandeau, 4 avantages clés, tableau **Standard / Premium certifié** (10 lignes), « Comment l'obtenir » en 3 étapes personnalisées (cochées selon l'état du compte), questions fréquentes. Entrée aussi depuis la page Partenaires.
- Texte de la carte volontairement adapté (« Pilotez vos annonces… » au lieu de « Boostez la visibilité… ») : le Premium ne change pas le classement ; la mise à la une reste une option payante distincte (dit explicitement sur la page).
- Alertes du centre : pastilles colorées (rouge / bleu / vert) comme sur la maquette.
- Le bouton « Demander le Premium » mène aux réclamations (« Contacter un conseiller ») : aucun paiement en ligne n'existe encore pour le Premium.
