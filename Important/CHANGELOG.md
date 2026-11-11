## 2026-11-11 — quartiers et pays gérés par le Superadmin
Migration 058 (`ika_zones`, colonne `country_code` sur les annonces, 10 quartiers d'origine repris). Service `server/services/places.js`, routes `/api/places` (public) et `/api/staff/owner/zones|countries…` (SUPERADMIN), module « Quartiers & pays » dans Owner Control. Les listes sont rechargées en mémoire à chaque changement et chaque minute. Branchés : formulaire d'annonce (Pays puis Quartier), modification, filtres et recherche, carte, pages serveur « Quartiers », importation CSV, position d'une annonce. Le formulaire exige maintenant 20 caractères de description (règle serveur déjà existante, jusque-là signalée seulement après l'envoi). **À faire : `npm run migrate`.**

## 2026-11-11 — nouveau formulaire d'annonce
`public/js/components/listing-form.js` + `public/css/publier.css` : une seule page en 4 sections (type de bien, détails, localisation, photos et documents), étapes cliquables, glisser-déposer des photos, documents en cartes avec rappel de modération, bouton « Publier ». Sert à la publication ET à la modification. Valeurs envoyées au serveur inchangées. Position exacte : toujours placée après l'envoi depuis « Localiser » (pas d'interrupteur factice). `e2e-browser.mjs` mis à jour.

## 2026-11-11 — pages serveur lisibles, contraste, partenaires
Voir SUIVI.md (section « Pages illisibles et partenaires »).

# CHANGELOG — évolutions selon les ordonnances consolidées v1.0

## Corrections de l'audit du 11 nov. 2026 (COR-001 à COR-005)
- COR-001 : le fichier `.env` (secrets réels) n'est plus livré dans l'archive. **Action propriétaire : révoquer la clé API Infobip et changer le mot de passe PostgreSQL** (ils ont circulé en clair).
- COR-002 : `.env.example` par défaut sur `NODE_ENV=development` et `TRUST_PROXY=0` (le lanceur Windows le copiait tel quel en mode production sur un poste local) ; nouvel avertissement `BASE_LOCALE` dans `check-env` ; README : `cp .env.example .env`. Variable `SESSION_SECRET` : inutilisée par le code, retirée du modèle de livraison.
- COR-003 : `public/js/app.js` n'injecte plus le nom de plateforme via `innerHTML` (HTML interprété) mais via `replaceTextIn()` (`dom.js`), texte seulement.
- COR-004 : version du service worker recalculée (`npm run stamp-sw`) ; nouveau `npm run stamp-sw:check`, exécuté par la CI.
- COR-005 : nouveaux tests `web`, `rules` (le script `test:rules` pointait vers un fichier absent), `preflight`, `platform-name`, et `integration-pg` (PostgreSQL + HTTP réels, exécuté par la CI, ignoré sans `DATABASE_URL_TEST`).

## SMS Infobip prêt à brancher (10 nov. 2026)
- L'adaptateur Infobip existait déjà (`SMS_PROVIDER=infobip`, `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_FROM`) ; ajout : `INFOBIP_BASE_URL` copiée du portail sans « https:// » est complétée au lieu de bloquer le démarrage.
- Nouveau `test/sms-infobip.test.js` (4 tests, faux réseau) : URL, en-tête `App`, numéro sans « + », refus sans fuite de la clé, configuration incomplète. Suite : 56 réussis.
- `docs/fournisseurs.md` : pas à pas de mise en place avec le compte d'essai. Jamais essayé contre le vrai service : premier envoi réel à faire avec votre numéro.

## Justificatifs d'agence branchés (10 nov. 2026)
- Décision du propriétaire : le RCCM reste **facultatif** pour approuver une agence (aucun changement de règle).
- Demande d'agence, côté équipe : la fiche affiche « Voir : RCCM de l'agence » (lecture tracée), et, pour un ADMIN, « RCCM contrôlé : accepter » (donne le badge « Agence vérifiée », nom de l'agence demandé) ou « RCCM : refuser » (motif obligatoire). Même circuit que l'onglet Confiance (`/staff/proofs/:id/…`) ; `listForStaff` renvoie `agency_proof_id`. Accepter ou refuser le RCCM ne décide pas la demande.
- Côté titulaire : sur une demande agence en cours, bouton « Envoyer le RCCM de l'agence » pour renvoyer un RCCM manquant ou refusé (limite existante : 5 pièces en attente).
- Vérifié dans un navigateur sur PostgreSQL réel : ouverture du RCCM, lecture journalisée, acceptation avec badge, demande toujours en attente, renvoi du RCCM ; 0 erreur de console ; 52 tests réussis.

## Correctif demandes annonceur + vérification sur PostgreSQL réel (10 nov. 2026)
- `advertiser-applications.js` appelait `accounts.profile(...)`, qui n'existe pas : toute demande (dépôt, liste, ajout de pièce, renouvellement) échouait en production avec « accounts.profile is not a function ». Les tests passaient car ils simulaient cette méthode. Remplacé par `accounts.ensureProfile(...)` ; le faux des tests est aligné sur la vraie API.
- Migrations 001 à 051 appliquées sur PostgreSQL 16 : rejeu sans effet (idempotent), retours arrière 050/051 vérifiés, remise à niveau des échéances de 050 vérifiée (seules les demandes décidées avec pièces reçoivent une échéance à un an).
- Nouveau `scripts/verification/pg-applications.mjs` : parcours complet sur la vraie base (dépôt agence, pièces, lecture journalisée, demande d'infos, approbation, échéance, rappel unique, renouvellement, export, orphelins, purge, suppression de compte). Usage : `DATABASE_URL=… node scripts/verification/pg-applications.mjs <dossier du projet>`.
- Tests : 52 réussis sur 52.
- Essai dans un vrai navigateur (Chromium, serveur réel, PostgreSQL réel) : dépôt d'une demande d'agence avec 3 fichiers, lecture d'une pièce par l'équipe (s'ouvre dans un nouvel onglet, lecture tracée), demande d'infos, ajout d'une pièce par le titulaire, approbation, avis de conservation, renouvellement. Script : `scripts/verification/browser-applications.mjs`.
- Deux défauts supplémentaires trouvés par cet essai et corrigés : (1) `GET /api/platform-settings` répondait 500 (« db is not defined ») sur chaque page : la lecture passe maintenant par `stats.publicPlatform()` ; (2) `public/js/admin.js` n'appelait jamais `load()` : le Centre de contrôle restait vide. Appel ajouté en fin de fichier.
- Parcours navigateur : 0 erreur de console. Avertissements de sécurité identifiés et corrigés : le bouton ☰ de `admin.html` utilisait `style="display:none"`, bloqué par la politique de sécurité (`style-src 'self'`) ; le bouton s'affichait donc aussi sur ordinateur. Remplacé par une règle dans `modern.css` ; la page Profil posait aussi deux styles en texte (`account.js`, et `advertiser.js`) : `dom.js` applique désormais un style donné en texte via `style.cssText` (autorisé) ; aucune violation restante sur l'accueil, les annonces, la carte, « Devenir annonceur », `admin.html` et `/owner`.

## Correctif page Localiser le bien (8 nov. 2026)
- `localisation.js` : la page `#/localiser/:id` affichait « searchCard is not defined » (bloc de recherche de la page Carte inséré par erreur dans la page de localisation). Référence supprimée.

## Correctif page Réclamations (8 nov. 2026)
- `complaints.js` importait `/js/core/dom.js` (inexistant) : la page « Mes réclamations » échouait avec « Failed to fetch dynamically imported module ». Import corrigé vers `/js/dom.js` ; les retours à la ligne du commentaire (affichés en « \n ») sont corrigés ; une erreur de chargement affiche un message et un lien de retour.
- Vérification : aucun autre import cassé dans `public/js`.

## Boutons « Retour » (8 nov. 2026)
- Site : barre « Retour » sous l'en-tête sur toutes les pages sauf l'accueil. Elle revient à la page réellement visitée avant ; si la page a été ouverte directement, elle remonte à la page parent (annonce → annonces, conversation → messages, etc.).
- Centre de contrôle : le changement d'onglet et l'ouverture d'une fiche annonceur ou d'une comparaison s'empilent ; le bouton « Retour » et le bouton retour du navigateur ou du téléphone les défont.

## Correctif Owner Control (8 nov. 2026)
- `ownerOverview` et `subscriptionsOverview` lisaient `ika_payments.amount` ; la colonne réelle est `amount_xof` (migration 008). Le serveur renvoyait une erreur et l'onglet Owner Control restait sur « Chargement… ».
- `admin.js` : un échec de chargement affiche maintenant le message et un bouton « Réessayer » au lieu de relancer la requête en boucle.
- `modern.css` : texte des cartes de statistiques du centre de contrôle (blanc sur blanc) rendu lisible.

## Campagnes SPONSORED branchées (8 nov. 2026)
- Migration 041 : `ika_campaigns` reçoit `listing_id`, `image_url`, `link_url`, `cta_label`, `sort_order`.
- Route publique `GET /api/campaigns/sponsored` (sans compte, cache 60 s) : campagnes SPONSORED actives dans leur fenêtre de dates ; une campagne liée à une annonce non publiée est ignorée.
- Routes Superadmin : `PUT /api/staff/owner/campaigns/:id` (modifier) et `POST /api/staff/owner/campaigns/:id/status` (ACTIVE / PAUSED / ENDED). Une SPONSORED ne s'active qu'avec une annonce liée, ou un visuel ET un lien ; ENDED est définitif.
- Validation : visuel limité à `/media/…` et `/api/media/…` (politique de sécurité), lien limité à `#/…` ou `https://`.
- Accueil : les campagnes SPONSORED passent avant les annonces « à la une » (3 publications maximum) ; une panne de la route n'empêche pas l'affichage des annonces.
- Admin : « Nouvelle campagne » demande annonce/visuel/lien pour SPONSORED ; nouveau bouton « État campagne ».

## 2026-11-08 (modernisation du design — référence Index_moderne.html)
- Interface : onglets Accueil, Annonces, Carte, Favoris, Messages, Partenaires (nouvelles routes `#/annonces` et `#/partenaires`), logo de la référence, bouton « Publier » dans l'en-tête, six onglets en barre mobile.
- Accueil : bannière de référence (textes et photo toujours réglables depuis l'administration), catégories, annonces sponsorisées AVANT les annonces classiques (annonces réellement mises à la une, alignées à gauche, mention « Sponsorisé »), aperçu des biens, appel à publier, aide.
- Carte : le bloc « Recherche immobilière » (Tous / Acheter / Louer, type, ville ou quartier, budget en FCFA) est désormais dans cet onglet et appelle réellement `/api/listings` ; carte publique des résultats ; « Mes biens localisés » conservé pour les comptes connectés.
- Annonces : tous les filtres d'origine conservés (transaction, type, quartier, budget, surface, chambres, tri, pagination, favoris, recherche enregistrée) ; les filtres arrivent aussi par l'adresse (recherche rapide, catégories, Carte).
- Correctifs de la modernisation partielle précédente : recherche rapide de l'en-tête sans effet, formulaire de la Carte factice, icônes de navigation vides, icône du bouton de thème, bouton favori sans style, polices sans pile de secours.
- Aucun changement serveur, aucune migration. Service worker restampé. Vérifié par un test de fumée Chromium sur API simulée (`scripts/verification/design-smoke/`). Non éprouvé sur PostgreSQL, sur un téléphone réel ni sur Mapbox.

## 2026-11-07 (livraison 27)
- Réclamations : notes internes de l'équipe invisibles du plaignant (migration 040), colonnes explicites, identifiants aléatoires. Non exécuté sur PostgreSQL.

## 2026-11-07 (livraison 26)
- Droits des personnes : l'export et la suppression de compte couvrent le consentement newsletter, les réclamations déposées et les commentaires de réclamation (anonymisation du dossier). Non exécuté sur PostgreSQL.

## 2026-11-07 (reprise du projet avancé)
- Audit de réception de `Ika_So_Owner_Control_v1_2_1` ; fichiers de carte `public/vendor/*` restaurés ; plan des permissions renuméroté (040, 041). Aucun code applicatif modifié.

## 2026-11-07 (livraison 26 — correctifs après vérification du rapport)
- Page d'accueil : enregistrement possible après un import de photo (défaut corrigé), photo importée « en attente » jusqu'à l'enregistrement, adresses externes refusées, protection contre le nettoyage des orphelins, journal d'audit.
- Événements : `verification_completed` aussi pour la vérification SMS ; `payment_completed` sans double émission ; les 9 événements affichés dans l'onglet Statistiques.
- Tests ajoutés (`homepage-settings`, `events-wiring`) : 325 tests, 0 échec (Express de substitution, sans PostgreSQL). Non éprouvé sur PostgreSQL ni sur un téléphone réel.

## 2026-11-07 (livraison 24)
- Fiche détaillée d'annonceur et comparaison de deux annonceurs (administrateurs), consultations journalisées. Non éprouvé sur PostgreSQL ni dans un navigateur.

## 2026-11-07 (livraison 23)
- Pondérations des classements réglables par le Superadmin (motif obligatoire, journal). Aucune migration. Non éprouvé sur PostgreSQL ni dans un navigateur.

## 2026-11-07 (livraison 22)
- Classements d'annonces, d'agences et d'autres annonceurs (indice et taux par vue, formules affichées) ; favoris agrégés par annonce. Non éprouvé sur PostgreSQL ni dans un navigateur.

## 2026-11-07 (livraison 21)
- Onglet « Statistiques » du centre de contrôle (ADMIN/SUPERADMIN) lisant les agrégats ; libellés d'honnêteté ; route `/staff/stats/overview`. Non éprouvé sur PostgreSQL ni dans un navigateur.

## 2026-11-07 (livraison 20)
- Agrégation journalière manuelle (`scripts/aggregate.mjs`, simulation par défaut), contrôle de cohérence consigné, sans donnée personnelle. Non exécutée sur PostgreSQL.

## 2026-11-06 (livraison 19)
- Consentement individuel aux statistiques (migration 027, routes, case dans « Profil », texte provisoire) ; sans accord, actions comptées sans identifiant de compte. Collecte toujours éteinte.

## 2026-11-06 (livraison 18)
- Dossier juridique d'activation des statistiques (questions, textes proposés, durées, liste de contrôle) ; export et suppression de compte couvrent les événements d'usage. Aucune activation.

## 2026-11-06 (livraison 17)
- Émission d'événements d'usage côté serveur (13 types), double interrupteur éteint par défaut (`ANALYTICS_ENABLED`), « Ne pas suivre » respecté, aucune donnée personnelle ajoutée. Non exécuté sur PostgreSQL.

## 2026-11-06 (livraison 16)
- Modération : masquage des photos de profil (motif, journal), signalements de profil lisibles dans Confiance ; `SUIVI.md` et feuille de route à jour. Non exécuté sur PostgreSQL ni dans un navigateur.

## 2026-11-05 (livraison 15)
- Profil public à onglets (Tous, Annonces, Avis, Contacter, Plus), couverture, photo, présentation facultatives, limites par rôle, contact et signalement d'annonceur ; migration 026 (additive) ; correction du script `stamp-sw` (silencieux dans un chemin avec espaces). Non exécuté sur PostgreSQL ni dans un navigateur.

## 2026-11-05 (livraison 14)
- Documentation : `PLAN_PROFIL_ANNONCEUR.md`. Aucun code, aucune migration.

## 2026-11-05 (livraison 13)
- Documentation : second `npm test` Windows (scripts ignorés correctement ; sortie coupée ; base de test toujours non définie). Aucun code.

## 2026-11-05 (livraison 12)
- Tests : les tests de scripts shell sont ignorés sous Windows. Aucun code d'application.

## 2026-11-05 (livraison 11)
- Documentation : résultat de `npm test` sous Windows (tests PostgreSQL non exécutés ; 5 tests de scripts shell inadaptés à Windows). Aucun code.

## 2026-11-04 (livraison 10)
- Migration 025 (permissions nommées, additive) + retour arrière, `server/lib/permissions.js`, `test/permissions.test.js`. Non exécutée sur PostgreSQL. Aucun comportement existant modifié.

## 2026-11-04 (livraison 9)
- Documentation : `PLAN_ROLES_PERMISSIONS.md` (migrations 025 à 027). Aucun code, aucune migration.

## 2026-11-04 (livraison 8)
- Documentation : règles de conduite précisées (questions avec recommandations numérotées par priorité, recherche web en cas de blocage). Aucun code, aucune migration.

## 2026-11-04 (livraison 7)
- Ajout : migrations 021 à 024 (pays et paramètres, audit administrateur, événements et sessions, agrégats et contrôles), retours arrière, test `analytics-migrations.test.js`.
- Collecte désactivée par défaut ; aucun code applicatif ne l'utilise encore. Suite 340/340 sur PostgreSQL 16.

## 2026-11-04 (livraison 6)
- Correction : `test/budget.test.js` (la bibliothèque hébergée `public/vendor` n'est plus comptée comme ressource externe) ; suite 333/333 sur PostgreSQL 16.
- Documentation : statut des anomalies dans `AUDIT_INITIAL_IKA_SO.md`.
- Aucune migration, aucun changement de base ni de code applicatif.

## 2026-11-04 (livraison 5)
- Ajout : `PLAN_MIGRATIONS_021_024.md` ; décisions D-1 à D-6 consignées dans `SUIVI_EVOLUTION_IKA_SO.md`.
- Aucun changement de code, de migration ni de base.

## 2026-11-04 (livraison 4)
- Ajout : `RECOMMANDATIONS_METIER.md` ; règles de conduite dans `SUIVI_EVOLUTION_IKA_SO.md`.
- Aucun changement de code, de migration ni de base.

## 2026-11-04 (livraison 3)
- Ajout : `ARCHITECTURE_ANALYTICS.md`, `MODELE_DONNEES_ANALYTIQUES.md` (Phase 2, conception).
- Aucun changement de code, de migration ni de base.

## 2026-11-04 (livraison 2)
- Ajout : `SPECIFICATION_SUPERADMIN.md` (Phase 1), `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`.
- Spécification mise à jour avec les décisions du propriétaire (délai d'une semaine, pièces jointes 2 Mo, stockage).
- Aucun changement de code, de migration ni de base.

## 2026-11-04 (livraison 1)
- Ajout : `AUDIT_INITIAL_IKA_SO.md` (Phase 0).
- Aucun changement de code, de migration ni de base.

### Personnalisation page d’accueil
- Ajout du module administrateur « Page d’accueil » avec aperçu en direct, champs de textes et photo de bannière configurable.
- Configuration persistée dans PostgreSQL et diffusée sur la page publique ; accès à l’enregistrement réservé aux administrateurs.
- Migration requise : 028_homepage_settings.sql.

## Modernisation design IKA SO (2026-11-08)

- Application du design system de référence (HTML modernisé) : palette vert #075b35 / or #e9ad22, typographies DM Sans + Manrope, cartes arrondies, ombres légères.
- Header modernisé : logo textuel IKA SO, barre de recherche rapide, navigation Accueil / Annonces / Carte / Favoris / Messages avec icônes.
- Toggle thème clair/sombre.
- Formulaire de recherche immobilière intégré dans l'onglet Carte.
- Libellé « Sponsorisé » pour les annonces featured.
- Styles modern.css + mises à jour index.html, admin.html, chrome.js, localisation.js, listing-card.js.
- Toutes les fonctionnalités métier, routes, API et logique existantes conservées.
