# Ika So — Suivi du projet

Mis à jour le 7 novembre 2026 (branchement des 22 événements analytiques et harmonisation de la palette) — auparavant : 6 novembre 2026 (profil public) — avant : 4 novembre 2026 (cartographie : étapes 4 et 5, suppression d'un sommet). Dernier lot « base réelle » : 2 novembre 2026, soir (lot 7, première exécution du lot 6 sur un vrai PostgreSQL). Ce fichier est livré avec chaque version : il dit **ce qui est fait (et prouvé)**, **ce qui reste**, et **ce qui attend une décision**.
Légende : ✅ fait et testé · 🟡 fait mais vérification incomplète · ⬜ à faire · ⛔ décision du propriétaire attendue

## Pages illisibles et partenaires (11 novembre 2026)
**Ce qui est fait**
- ✅ **Pages serveur illisibles (Quartiers, Agences, Guides, annonces, pages légales, 404)** : `seo.css` est désormais autonome (ses propres couleurs clair/sombre, posées ensemble sur html, en-tête, cartes, boutons, pastilles, tableaux, pied de page). Même avec un ancien `ika.css` ou sans lui, le texte reste lisible.
- ✅ **Cause probable du « encore »** : le service worker servait l'ancienne version des pages et des feuilles de style (copie en mémoire de l'appareil, `?v=` ignoré). Corrigé : pages en « réseau d'abord », fichiers des pages serveur versionnés par empreinte (`?v=`), installation avec rechargement forcé. Version du cache : `ika-so-b176befb49`.
- ✅ **Contrôle automatique ajouté** : `npm run check-seo-contrast` (13 pages × clair/sombre × ika.css actuel/ancien/absent = 78 contrôles, contraste ≥ 4,5:1) → 0 texte illisible ; le contrôle échoue bien quand `seo.css` manque.
- ✅ **Autres pages pareilles trouvées et corrigées** (application, 22 routes × clair/sombre × ordinateur/téléphone) : pastille active « Tous » invisible en sombre (Annonceurs) ; « Annuaire » doré illisible sur fond clair ; « Devenir annonceur » sur l'accueil ; tableau et étapes Premium en sombre ; liens « Mettre une annonce à la une… » de la page Partenaires en sombre.
- ✅ **Partenaires inexistants → ajout possible** : migration 057 (`ika_partners`), service, routes (`GET /api/partners` public ; `/api/staff/partners…` administrateurs : ajouter, modifier, masquer/réafficher, retirer, logo importé). Sur `#/partenaires`, l'administrateur voit « Ajouter un partenaire » et les boutons Modifier / Masquer / Retirer ; le public voit seulement les partenaires actifs. Nom, catégorie (liste), description 300 car., site web (http/https seulement, `rel="noopener nofollow sponsored"`), logo facultatif (JPEG/PNG/WebP 2 Mo, stocké en base, protégé du nettoyage des orphelins). Actions inscrites au journal d'audit (PARTNER_*). Limite 100 partenaires.
- ✅ Tests : `test/partners.test.js` (7) ; suite : 115 tests, 112 réussis, 0 échec, 3 ignorés (PostgreSQL absent). Parcours navigateur (visiteur / administrateur, ajout, erreur, masquage, retrait, clair/sombre, téléphone) réussi sur serveur simulé.

**Non vérifié / reste à faire**
- ⬜ Migration 057 et requêtes SQL **jamais exécutées sur PostgreSQL** (aucune base disponible ici) : lancer `npm run migrate` puis tester un ajout réel.
- ⬜ Centre de contrôle (`admin.html`) et espace propriétaire (`owner.html`) : non re-contrôlés (derrière connexion, couleurs propres) ; pastille « eyebrow » d'owner non touchée.
- ⬜ Vérifier sur votre appareil : vider une fois les données du site si l'ancien affichage persiste (le nouveau service worker prend la main au rechargement).
- ⬜ Partenaires : pas d'ordre manuel (ordre d'ajout), pas de page dédiée par partenaire, pas de demande de partenariat en ligne.

## Correctifs de la page d'accueil et des événements (7 novembre 2026, 2e livraison)
Suite à la vérification du rapport `Rapport_Travaux_Ika_So.pdf` contre le code.
- ✅ **Défaut corrigé — impossible d'enregistrer après un import de photo** : l'import produisait `/api/media/<id>`, que « Enregistrer » refusait. L'enregistrement accepte maintenant une photo importée (seulement si c'est la photo publique ou la photo en attente) ou un fichier `/media/…` du site. Test de régression ajouté.
- ✅ **Adresses externes (https) refusées** : la politique de sécurité (`img-src 'self'`) les aurait bloquées à l'affichage.
- ✅ **Import = photo « en attente »** : plus publiée avant « Enregistrer » ; visible seulement des administrateurs (aperçu) ; « Annuler » revient à la version enregistrée.
- ✅ **Nettoyage des fichiers orphelins** : la photo d'accueil (publique ou en attente) est protégée.
- ✅ **Journal d'audit** : `HOMEPAGE_IMAGE_UPLOAD` et `HOMEPAGE_SAVE` (champs modifiés).
- ✅ **Événements** : `verification_completed` émis aussi à la vérification du numéro par SMS ; `payment_completed` émis seulement si la confirmation fait réellement passer le paiement à PAID (plus de double émission si deux notifications distinctes). Les 9 événements apparaissent maintenant dans l'onglet Statistiques (ils étaient déjà comptés dans les agrégats `event.*`, mais non affichés). `contact_clicked` est un compteur général : chaque clic Appeler/WhatsApp y est aussi compté (note affichée : ne pas additionner).
- ✅ Tests : `test/homepage-settings.test.js` (13), `test/events-wiring.test.js` (6) ; suite complète 325 tests, 324 réussis, 0 échec, 1 ignoré (Express de substitution, sans PostgreSQL).
- ⬜ **Non vérifié** : migration 028 et requêtes SQL (photo en attente, orphelins) sur un vrai PostgreSQL ; import réel depuis un téléphone ; aperçu dans un navigateur ; réglage des couleurs/positionnement de la bannière (non développé) ; `comment_deleted` seulement pour le masquage par la modération (aucune route de suppression par l'auteur) ; visiteurs uniques, sessions, tableau de bord complet et export Excel (non développés, en attente de l'avis juridique).

## Droits des personnes : newsletter et réclamations (7 novembre 2026)
- 🟡 Export et suppression de compte couvrent le consentement newsletter, les réclamations déposées et les commentaires de réclamation (dossier conservé, personne retirée). Testé en logique seulement ; choix « anonymiser » à confirmer avec le juriste.
- 🟡 Notes internes du Superadmin invisibles du plaignant (réponse visible seulement si l'équipe le choisit) ; identifiants de commentaires aléatoires (migration 040). Testé en logique seulement.

## Profil public à onglets (5-6 novembre 2026)
- 🟡 Page profil : onglets Tous / Annonces / Avis (positifs 4-5, négatifs 1-2, donner un avis, réponse, signalement d'avis) / Contacter / Plus (antécédents constatés, à propos, conseils, signaler l'annonceur, partager). Code écrit, tests de logique réussis ; jamais ouverte dans un vrai navigateur ni sur téléphone (un aperçu avec données fictives a été produit à partir du vrai code et de la vraie feuille de style).
- 🟡 Couverture, photo de profil, présentation : facultatives, limites par rôle contrôlées par le serveur (migration 026, **jamais exécutée sur PostgreSQL**).
- 🟡 Contact : Appeler / WhatsApp seulement si l'annonceur l'autorise, connexion exigée, numéro jamais écrit sur la page.
- 🟡 Litige : signalement d'annonceur dans la file « Personnes signalées » (onglet Confiance) ; la modération peut masquer les photos de profil, avec motif et trace dans le journal.
- ✅ Script `stamp-sw` corrigé (ne faisait rien dans un dossier avec espaces ; test ajouté).
- ⬜ « Promoteur vérifié » et « Particulier certifié » : impossibles tant qu'aucune procédure de vérification n'existe. ⬜ Clics de contact de profil dans les statistiques du centre de contrôle.

## Événements analytiques (6 novembre 2026)
- 🟡 Les 22 types autorisés sont maintenant branchés : pages vues (navigation SPA), vues d’annonces, contacts, demandes de contact (message initial envoyé depuis une annonce), commentaires (retrait par modération pour `comment_deleted`), création/modification/publication/archivage d’annonces, vérifications acceptées et paiements confirmés par webhook signé au montant attendu. Collecte **éteinte par défaut** (`ANALYTICS_ENABLED=false` + réglage en base) ; DNT/GPC respectés ; émissions métier après succès. Tests de logique à exécuter ; PostgreSQL réel non validé.
- ⬜ `visitor_id` et `session_id` restent volontairement nuls : aucun visiteur unique ni aucune session ne doit être annoncé. Leur mise en œuvre attend une validation juridique/APDP et une conception de consentement/cookies ; les pages vues simples ne suffisent pas à calculer des uniques.
- 🟡 Dossier pour le juriste prêt (`docs/juridique/dossier-activation-statistiques.md`) : questions, textes de confidentialité et de bandeau proposés, durées. Export et suppression du compte couvrent les événements.
- 🟡 Consentement individuel aux statistiques : case facultative non cochée dans « Profil » (texte provisoire), sans accord = comptage sans identifiant de compte (migration 027). Testé en logique seulement.
- 🟡 Agrégation journalière manuelle (`node scripts/aggregate.mjs`, simulation par défaut, `--apply` pour écrire) : écrite et testée en logique, jamais exécutée sur PostgreSQL ; aucun écran ne lit encore les agrégats.
- 🟡 Onglet « Statistiques » du centre de contrôle (administrateurs) : lit les agrégats, période 7/30/90 jours avec comparaison, annonces les plus vues, libellés honnêtes. Testé en logique seulement.
- 🟡 Classements d'annonces, d'agences et d'autres annonceurs (administrateurs) : indice pondéré et taux d'interaction par vue, formules affichées. Testés en logique seulement.
- 🟡 Pondérations de l'indice de performance réglables par le Superadmin (motif obligatoire, journal, un contact pèse plus qu'une vue). Testées en logique seulement.
- 🟡 Fiche détaillée d'annonceur et comparaison de deux annonceurs (administrateurs) ; chaque consultation est inscrite au journal. Testées en logique seulement.
- ⛔ Activation : avis juridique, mise à jour de la politique de confidentialité et consentement. ⬜ Sessions, visiteurs uniques, agrégats, tableaux de bord.

## Refonte visuelle « forêt / lime / sable » (4 novembre 2026)
- ✅ Nouveau visage d'après `index_.html` : en-tête (transparent sur l'accueil), accueil en sections (entête + recherche rapide, chiffres, catégories, annonces, carte, appel à publier, ressources), cartes d'annonce, pied de page. Palette : `#102c25`, `#1e6b50`, `#c9ef75`, `#f6f5ef`.
- ✅ Respect des règles du projet : aucune ressource externe (pas de Tailwind CDN, ni Google Fonts, ni Unsplash) ; images locales, polices du système avec « DM Sans » / « Manrope » en tête de pile si elles sont installées. CSS : 8,6 Ko compressés (budget 10 Ko).
- ✅ Toutes les fonctions conservées : filtres (type, quartier, budget min/max, superficie, chambres, tri), recherche enregistrée, favoris, carte (chargée à l'approche), messagerie et compteur, publication, profil, centre de contrôle, pages publiques du serveur.
- ⬜ Le formulaire de contact par e-mail de la maquette n'est pas repris (aucune adresse de contact réelle dans le projet) : remplacé par une carte « Ressources utiles ».
- ⬜ Chiffres de la maquette (« +120 biens »…) remplacés par des faits vérifiables ; à remplacer par de vraies statistiques si le propriétaire le souhaite.

## Vue d'ensemble

| Phase | Contenu | État |
|---|---|---|
| 0 | Mise en service de l'existant | 🟡 parcours testé ; SMS et photo réels non testés |
| 1 | Fondations (modules, journaux, tests, CI, budget) | 🟡 testé avec un substitut d'Express |
| 2 | Cœur de la marketplace | 🟡 recherche, filtres, doublons, regroupement, partage faits ; reste voir ci-dessous |
| 3 | Confiance et modération avancée | 🟡 badges, pièces, liste noire, alertes, signalement de commentaires faits ; avis non faits |
| 4 | Engagement (alertes, messagerie, PWA) | 🟡 alertes en boîte, messagerie, visites, hors ligne faits ; canaux externes non faits |
| 5 | Monétisation | 🟡 socle indépendant du fournisseur fait (faux fournisseur) ; ⛔ agrégateur mobile money et tarifs à choisir |
| 6 | Croissance (SEO, agences, import CSV) | 🟡 pages SEO, repères de prix, guides, annuaire, import CSV, espace agence faits ; guides à relire |
| 7 | Durcissement et conformité | 🟡 contrôles automatisés ; sauvegarde chiffrée hors site et restauration indépendante en cours de sécurisation ; charge, audit humain et textes juridiques ⬜ ⛔ |
| 8 | Déploiement et pilote à Bamako | ⬜ ⛔ hébergeur, domaine |
| 9 | Stockage durable des fichiers | 🟡 code et migration ajoutés ; exécution PostgreSQL/Render à confirmer |
| 10 | Cartographie immobilière (Mapbox, GPS, parcelles) | 🟡 étapes 1 à 3 faites (données, calcul, API) ; étape 4 partielle (écran sans fond de carte, suppression d'un sommet précis) ; étape 5 faite (fiche imprimable) ; SQL réel jamais exécuté ; Mapbox (4 bis) et recette (6) ⬜ ⛔ — voir `docs/cartographie.md` |

## Vérification du lot 6 sur un vrai PostgreSQL 16 (lot 7, 02/11 soir)
Jusqu'ici les migrations 009 à 015 et une grande partie des tests « base » n'avaient **jamais** été exécutées. C'est fait, avec un vrai PostgreSQL 16 (pilotage par `psql`, `scripts/verification/psql-adapter.mjs`, maintenant avec transactions, requêtes `WITH` et colonnes binaires) et un substitut d'Express :
- ✅ Migrations 001 à 015 appliquées sans erreur sur une base vide.
- ✅ **226 tests sur 226** (aucun ignoré, aucun échec) : brouillons serveur, historique de prix, alertes groupées, blocage/signalement, remboursements et expiration des paiements, stockage des fichiers, orphelins, frein de connexion par compte, redirections d'adresses lisibles, concurrence des rôles.
- ✅ Parcours navigateur réel (Chromium) : **48/48**.
- ✅ Contrôle d'accessibilité automatique : **0 problème sur 18 pages** (clair) après correction de 4 contrastes introduits par la refonte bleu/or : texte secondaire (4,43), pied de page (3,74), logo « So » des pages publiques (1,78), pastille de compteur blanc sur or (1,78).
- Corrections faites dans ce lot : test de sécurité (la route publique `GET /media/:id` n'était pas dans la liste autorisée) ; test SEO (le justificatif de test n'était plus un vrai PNG depuis la validation du contenu des fichiers) ; substitut d'Express (`res.redirect`). **Aucun défaut applicatif n'a été trouvé dans le code du lot 6** par ces exécutions.
- 🗃️ **Historique uniquement — palette bleu / blanc / or (02/11)** : cette ancienne direction a été remplacée le 04/11 par la palette officielle forêt / lime / sable décrite ci-dessus. Ne pas réutiliser comme référence actuelle. Les icônes et le manifeste doivent être considérés comme éléments historiques à réaligner si leur palette est encore bleu/or.
- ✅ **Mode sombre refait sur la nouvelle palette** (suit le réglage du téléphone ; fond bleu nuit, bleus et ors éclaircis quand ils servent de texte). Contrôle automatique : **0 problème sur 18 pages en mode clair ET en mode sombre** ; captures vérifiées (accueil, fiche). ⬜ Pas de bouton pour forcer clair/sombre (le téléphone décide).
- ⬜ Pages d'administration (`admin.html`) et pages publiques rendues par le serveur : contrastes vérifiés, mais pas relues visuellement en mode sombre.
- ⬜ Toujours jamais exécuté : le vrai `express` et le vrai `pg` (le test de la boucle `npm install && npm test` chez vous reste la vraie preuve), Render/Neon réels, sauvegarde chiffrée `age` + `rclone` vers un vrai stockage, SMS, paiement mobile money, téléphone réel.

## À faire en premier, chez vous (usage local)
1. `npm install` puis `npm test` avec un vrai PostgreSQL (`DATABASE_URL_TEST`, base jetable). **C'est la première vraie vérification d'`express` et de `pg`.**
2. Si tout est vert : générer et conserver `package-lock.json`, puis passer la CI et Docker à `npm ci`.
3. `npm run dev`, ouvrir `http://localhost:8080`, refaire à la main le parcours : inscription → numéro → publier → approuver dans `/admin.html` → voir sur la carte → commenter → bloquer.
4. PostgreSQL local : le paquet « contrib » doit être installé (extensions `unaccent` et `pg_trgm`, migration 005).

## Phase 0 — Mise en service
- ✅ Retour à la pile de l'ordonnance (Express, PostgreSQL, CSS), aucune marque tierce.
- ✅ Connexion unique : e-mail + mot de passe, session par cookie opaque ; numéro vérifié par code.
- ✅ Parcours publier → modérer → carte → contacter → commenter → signaler → bloquer (navigateur réel).
- ⬜ Envoi d'un SMS réel (Twilio) — jamais exécuté. ⛔ fournisseur SMS.
- 🟡 Photos d'annonces : les nouvelles photos sont désormais enregistrées dans `stored_files` (PostgreSQL/Neon), et non sur le disque Render ; migration `009_stored_files.sql` à exécuter en environnement de test puis réel après validation.
- 🟡 Socle reconstruit (`package.json`, `config.js`, `db.js`, `migrate.js`) : à relire.

## Phase 1 — Fondations
- ✅ Frontend en modules (`core`, `components`, `pages` à la demande) ; chargement initial ≈ 9 Ko compressés.
- ✅ Journaux JSON sans IP, identifiant de requête, `/api/health`, erreurs navigateur et serveur tracées.
- ✅ Suivi d'erreurs extensible : journaux par défaut ; `ERROR_WEBHOOK_URL` ou un `sink` maison pour un service tiers plus tard.
- ✅ Tests de routes HTTP, budget de performance, absence de CDN. Docker, CI.
- 🟡 CI GitHub et image Docker jamais exécutées. Pas de `package-lock.json` (⬜ à générer chez vous : Docker et CI exigent maintenant `npm ci`).
- ⬜ Mesure sur un vrai téléphone d'entrée de gamme (Lighthouse).

## Phase 2 — Cœur de la marketplace
- ✅ Recherche plein texte en français, sans accents, par fragment de mot, classée par pertinence (migration 005).
- ✅ Filtres : transaction, type, quartier, prix min/max, superficie min, chambres ; tris prix et récence ; pagination (« Voir plus »).
- ✅ Détection de doublons : même annonceur et même titre = refusé ; annonce proche d'un autre annonceur = signalée à la modération.
- ✅ Carte avec regroupement des repères proches.
- ✅ Expiration à 45 jours, prolongation, vendu/loué, archivage (phase 0). ✅ Compression des photos dans le téléphone. ✅ Brouillon enregistré sur l'appareil.
- ✅ Filtres superficie et chambres dans l'écran. ✅ Fiche annonce : partage (ou copie du lien) et annonces similaires.
- 🟡 Brouillons enregistrés côté serveur (2 nov.) : code écrit, **migration `011_listing_drafts.sql` à appliquer**, tests base non exécutés (pas de PostgreSQL ici). Un brouillon « nouvelle annonce » par compte, copie appareil conservée (la plus récente gagne), supprimé à la soumission.
- 🟡 Fiche annonce : historique de prix (2 nov.) : code écrit, **migration `012_price_history.sql` à appliquer**, tests base non exécutés. Un point à chaque publication par la modération si le prix a changé ; les annonces déjà en ligne reçoivent leur prix actuel comme point de départ ; affiché sur la fiche à partir de deux points.
- ⬜ Vraie carte (fonds de carte hébergés localement). Aujourd'hui : repères en CSS sur un schéma de Bamako.
- ✅ Décidé le 01/11 : pas de PostGIS pour le pilote (filtre par quartier). À rouvrir si la recherche par rayon devient nécessaire.
- ⬜ Critère « trouver ou publier en moins de 2 minutes sur téléphone d'entrée de gamme » : non mesuré.

## Phase 3 — Confiance et modération avancée
- ✅ Pièces justificatives : l'annonceur joint une photo ou un PDF (700 Ko max) ; seule l'équipe peut l'ouvrir, et chaque ouverture est tracée.
- ✅ Badge « Titre foncier contrôlé » : donné seulement par une personne de l'équipe, avec la note de ce qu'elle a contrôlé ; retiré automatiquement si l'annonce est modifiée ; retrait manuel motivé (administrateur).
- ✅ Badge « Agence vérifiée » : réservé aux administrateurs, avec nom de l'agence et note de contrôle (RCCM).
- ✅ Liste noire (téléphone, e-mail) : refuse l'inscription et la vérification du numéro ; bloque les comptes existants et ferme leurs sessions ; administrateurs seulement.
- ✅ Alertes automatiques dans le centre de contrôle (onglet « Confiance ») : prix très éloigné du marché du quartier (médiane de 3 comparables ou plus), rafale de 5 annonces en 24 h, annonce proche d'un autre annonceur, commentaire signalé par 3 personnes. Elles n'empêchent jamais la publication : la modération décide.
- ✅ Signalement des commentaires : un signalement par personne, motif imposé, file de modération (masquer ou écarter).
- ⬜ Avis (notes sur les annonceurs) : non fait ; à décider (qui peut noter, après quel contact).
- ⬜ Seuils d'alerte (40 %, 250 %, 5 annonces, 3 signalements) : choisis par moi, à valider par vous.
- ✅ Badge renommé **« Titre foncier contrôlé »** (note juridique) et règle appliquée par le serveur : refus d'accepter la pièce si l'annonce ne déclare pas un « Titre Foncier » (testé). Procédure v2 écrite : `docs/juridique/procedure-controle-badges.md`. ⛔ Reste à valider avec un notaire/juriste : pièces valables après la réforme foncière de 2021, délais.
- 🟡 Les nouvelles pièces justificatives sont enregistrées dans `stored_files` (PostgreSQL/Neon), avec accès réservé au personnel ; migration `009_stored_files.sql` à exécuter et vérifier en réel.

## Phase 4 — Engagement
- ✅ Recherches enregistrées (10 par compte) et alertes : à l'approbation d'une annonce, les personnes dont une recherche correspond reçoivent une alerte tout de suite (2 secondes mesurées dans le navigateur ; critère « moins d'une minute » respecté). Une seule alerte par annonce même si plusieurs recherches correspondent ; jamais pour l'annonceur lui-même ni pour un compte banni.
- ✅ Boîte : alertes, messages, visites ; compteur à lire dans l'en-tête, mis à jour à chaque page et toutes les 30 secondes.
- ✅ Messagerie interne entre intéressé et annonceur (un fil par annonce et par personne), non-lus, 30 messages par heure au plus, comptes restreints ou bannis refusés.
- ✅ Demandes de visite : date future (1 h à 60 jours), 3 en attente au plus, une par annonce ; l'annonceur accepte ou refuse (motif obligatoire) ; chacun est prévenu.
- ✅ L'annonceur est prévenu quand son annonce est publiée ou refusée (avec le motif).
- ✅ Hors connexion léger : le site et les dernières annonces vues restent lisibles, bandeau « Hors connexion » ; messages, compte, contact et administration ne sont jamais gardés (testé).
- ✅ Correction d'un défaut réel trouvé en test : une page qui arrivait en retard pouvait écraser la page affichée (navigation rapide).
- ⬜ Notifications hors du site : push, WhatsApp, SMS, e-mail. Le point de branchement existe (`notifiers`), aucun canal n'est branché. ⛔ fournisseurs (SMS, WhatsApp Business, e-mail) et clés push.
- 🟡 Installation sur l'écran d'accueil : icônes PNG 192/512 et « maskable » refaites dans l'ancienne palette bleu/or (02/11, historique) ; installation non testée sur un vrai téléphone. Service worker passé à `ika-so-v7-3` (la version est désormais calculée automatiquement, voir lot 4).
- 🟡 Alertes quotidiennes groupées (2 nov.) : code écrit, **migration `013_alert_digest.sql` à appliquer**, tests base non exécutés. Choix par compte dans Boîte > Alertes : « dès qu'une annonce correspond » (défaut, inchangé) ou « un résumé par jour ». ⛔ Le résumé part au plus une fois par 23 h et par compte, au premier passage de la minuterie (15 min) après une correspondance, pas à une heure fixe : à confirmer.
- ✅ Version du cache hors connexion automatique (lot 4) : `npm run stamp-sw` calcule la version depuis le contenu des fichiers préchargés ; un test échoue si elle est périmée (donc la CI aussi). Plus de numéro à changer à la main. ⬜ Toujours jamais testé : service worker sur un vrai téléphone Android d'entrée de gamme et mise à jour réelle du cache après déploiement.
- 🟡 Blocage et signalement d'une personne dans la messagerie (2 nov.) : code écrit, **migration `014_user_blocks_reports.sql` à appliquer**, tests base non exécutés. Le blocage coupe messages et demandes de visite dans les deux sens ; le signalement transmet à la modération les 10 derniers messages seulement. Limite : le numéro de téléphone d'une annonce reste visible pour un compte connecté, le blocage ne l'efface pas. Pas de pièces jointes (volontaire, pour limiter les arnaques).

## Phase 5 — Monétisation (socle fait, fournisseur ⛔)
Décision du 02/11 : le moyen de paiement sera choisi plus tard ; le code essentiel est posé sans lui.
- ✅ Fournisseur interchangeable : un contrat de deux fonctions (`createCheckout`, `parseWebhook`) dans `server/payments/providers.js`. Aujourd'hui : un faux fournisseur de démonstration, refusé en production et sans secret.
- ✅ Offres « mise à la une 7 jours » et « 30 jours » : **créées inactives, prix 0** ; seul un administrateur fixe le prix et active (journalisé). Rien n'est proposé au public sans prix.
- ✅ Paiement : l'annonce n'est mise à la une qu'après une confirmation du fournisseur **signée** (HMAC), au **bon montant**. Confirmation rejouée = sans effet ; montant différent = « MISMATCH », rien n'est activé ; fausse signature = 403.
- ✅ Respect du plafond de places « à la une » au moment d'acheter ; une demande identique en cours est reprise (pas de double paiement).
- ✅ Factures numérotées (`IKA-2026-000001`), page « Paiements » avec impression.
- ✅ Rapprochement (administrateur) : paiements à vérifier, total encaissé, et réparation automatique d'un paiement confirmé dont l'effet n'a pas été appliqué. Remboursement noté avec motif (retire la mise à la une).
- ✅ Vérifié : 7 tests paiements ; navigateur : tarif → achat en attente → confirmation signée → facture.
- ⛔ Choisir l'agrégateur mobile money (Orange Money, Moov, Wave, agrégateur…) : il faudra écrire son adaptateur (création du paiement, lecture et signature de ses confirmations) et le tester en bac à sable. **Aucun vrai paiement n'a jamais été fait.**
- ⛔ Tarifs ; mentions légales et fiscales des factures (aujourd'hui : « facture simple », à valider) ; durée de conservation.
- 🟡 Expiration des paiements restés en attente (2 nov.) : après 24 h, statut EXPIRED (minuterie horaire + à l'ouverture du rapprochement) ; une confirmation tardive du fournisseur est honorée. Code écrit, non testé sur PostgreSQL.
- ⬜ Abonnements agences, remboursement automatique chez le fournisseur, relance des paiements en attente, notification à l'annonceur à la confirmation.
- ⬜ Mise en place : `PAYMENT_PROVIDER` vide = paiements fermés (par défaut) ; `PAYMENT_WEBHOOK_SECRET` à définir.

## Phase 6 — Croissance
- ✅ Pages publiques rendues par le serveur (lisibles sans JavaScript) : `/quartiers`, `/quartier/:slug`, `/a/:id`, `/agences`, `/agence/:id`, `/guides`, `/guides/:slug`.
- ✅ `/sitemap.xml` et `/robots.txt` ; données structurées (fil d'Ariane, liste, annonce immobilière avec prix en XOF, agence, article) ; pages vides en `noindex`.
- ✅ Aucun numéro de téléphone sur les pages publiques (il reste derrière le contact compté). Tout texte est échappé.
- ✅ Repères de prix par quartier (médiane, fourchette, médiane au m² pour les terrains), affichés seulement avec 3 comparables ou plus.
- ✅ Annuaire des agences : seules les agences au badge « Agence vérifiée » (contrôle humain) sont listées.
- ✅ Import CSV pour agences : tout ou rien, 200 lignes et 400 Ko au plus, séparateur `;` ou `,`, test à blanc, modèle téléchargeable (`/modele-import.csv`) ; chaque annonce passe par la modération.
- ✅ Espace agence (`#/agence`) : import et statistiques.
- ✅ Vérifié : 15 tests SEO + test du modèle ; 42 vérifications navigateur sur 42.
- ⬜ Les 3 guides sont une information générale : **à faire relire par un professionnel malien** (notaire, géomètre) avant la mise en ligne publique.
- ⬜ `PUBLIC_URL` doit être défini en production (sitemap, liens canoniques) ; sinon l'adresse de la requête est utilisée.
- ⬜ Repères de prix jamais testés sur de vrais volumes ; vitesse des pages SEO non mesurée.
- ⬜ Pas d'icônes PNG ; pas d'équipe ni de facturation dans l'espace agence ; pas d'import de photos par CSV (photo par défaut selon le type).
- ✅ Adresses d'annonces lisibles : `/a/<id>/<titre>` ; l'ancienne forme `/a/<id>` et un titre périmé redirigent (301) vers l'adresse canonique ; plan du site, liens, fil d'Ariane et données structurées utilisent la forme lisible. 2 tests purs verts ; l'assertion de redirection ajoutée à `test/seo.test.js` n'a **pas** pu être exécutée ici (pas d'`express` ni de PostgreSQL). Le substitut d'Express de `scripts/verification` devra peut-être gérer `res.redirect`.
- ⬜ En-tête des pages SEO sur deux lignes sur petit écran.

## Phase 7 — Durcissement et conformité (🟡 ⛔)
- 🟡 Historique : une ancienne version des scripts réalisait un dump local et un essai de restauration temporaire avec comparaison de comptes de lignes. Cette preuve était limitée : elle dépendait d'une connexion à la base source, ne démontrait pas une copie chiffrée hors site et ne prouvait pas la reprise après perte de l'environnement source. Ne pas considérer ce résultat historique « 26 tables identiques » comme une validation actuelle de reprise indépendante.
- ✅ Audit de sécurité automatisé (`test/securite.test.js`, 8 tests) : chaque route de l'API est lue dans le code et appelée sans compte (toute route privée doit refuser) puis avec un simple compte (tout `/staff/*` doit refuser) ; entrées hostiles (injection SQL, script, octet nul, textes de 5 000 caractères) sans erreur 500 ni trace ; pages publiques sans script exécutable ; en-têtes (CSP, nosniff, anti-cadre) ; cookie HttpOnly/SameSite/Secure ; écriture d'un autre site refusée ; force brute sur la connexion freinée (429).
- ✅ Défauts réels trouvés puis corrigés par cet audit : un octet nul dans une adresse donnait une erreur 500 (maintenant 400) ; la décision sur une pièce répondait « introuvable » à un simple compte avant de vérifier ses droits (maintenant 403).
- ✅ Contrôle d'accessibilité automatique (`scripts/verification/a11y.mjs`, 18 pages, mode clair et mode sombre) : langue, titre, un seul h1, images avec alt, boutons et liens nommés, champs étiquetés, identifiants uniques, zoom non bloqué, contraste AA, taille des cibles tactiles. Défauts réels corrigés : texte or trop pâle (4,2 au lieu de 4,5), champ sans étiquette dans le signalement, **texte vert illisible en mode sombre** (contraste 1,5 à 2,3). Résultat : 0 problème sur 18 pages dans les deux modes.
- ⬜ L'accessibilité automatique ne remplace pas un essai avec lecteur d'écran (TalkBack) ni un audit humain : à faire.
- ⬜ Tests de charge : non faits. Ils n'auraient aucun sens ici (la base est pilotée par un adaptateur lent) ; à faire sur le vrai serveur avec le vrai `pg`.
- 🟡 Scripts renforcés dans la livraison du 02/11 : dump PostgreSQL chiffré avec `age`, destination distante obligatoire via `rclone`, contrôle de transfert distant et empreinte SHA-256 ; aucun dump en clair conservé après exécution. Le script refuse de fonctionner si destination distante ou clé publique manquante.
- 🟡 Script de restauration modifié : exige une URL d'administration PostgreSQL explicitement réservée aux tests et une variable de confirmation du serveur jetable, vérifie le SHA-256, déchiffre dans un répertoire temporaire, restaure dans une base au nom généré et la supprime à la sortie. Il ne compare plus la sauvegarde à la base de production.
- ⬜ Configurer réellement un remote rclone (R2/S3 ou autre), les secrets `DATABASE_URL` et `BACKUP_AGE_RECIPIENT`, la conservation sécurisée de `BACKUP_AGE_IDENTITY`, puis planifier l'exécution depuis un runner externe au service web Render.
- ⬜ Exécuter une sauvegarde distante et un test de restauration sur PostgreSQL jetable ; contrôler explicitement le nombre et la taille des fichiers `stored_files`, les annonces, justificatifs et références. Aucun test réel de dump/chiffrement/transfert/restauration n'a été exécuté dans cette livraison faute de secrets, d'outils et de serveur de test configurés.
- ✅ Frein de connexion **par compte** (en plus du frein par adresse) : 5 échecs en 15 minutes sur un même e-mail → 429, même avec le bon mot de passe ; une connexion réussie remet le compteur à zéro ; un e-mail inconnu est compté pareil (rien ne révèle si le compte existe). 5 tests du limiteur passent ; le test HTTP (`test/connexion.test.js`) n'a **pas** pu être exécuté ici (pas d'`express` ni de PostgreSQL).
- ⛔ Limite connue du frein par compte : quelqu'un peut bloquer le compte d'autrui pendant 15 minutes en tapant de faux mots de passe. Compromis courant, à confirmer ; une alternative serait de ne freiner que la combinaison e-mail + adresse.
- ⬜ Limiteur de débit en mémoire (une seule instance) : les compteurs sont perdus au redémarrage et ne se partagent pas entre instances ; à déplacer en base si plusieurs instances.
- 🟡 Textes juridiques : **projets** rédigés d'après le fonctionnement réel du logiciel, avec les articles de la Loi n° 2013-015 cités (`docs/juridique/`). Désormais **affichés** sur `/confidentialite` et `/conditions` avec la bannière « texte provisoire » (tant que `LEGAL_VALIDATED` est faux dans `server/lib/legal.js`). ⛔ À faire relire par un juriste malien avant l'ouverture au public.
- ⬜ Audit humain / test d'intrusion ; `npm audit` des dépendances (jamais lancé : npm bloqué ici) ; confidentialité et conditions validées par un juriste malien .

## Phase 3 bis — Profil public de l'annonceur et avis (lot 9, 03/11) 🟡
- ✅ Page `#/annonceur/<id>` (lien « Voir le profil de l'annonceur » sur chaque fiche, avec note et niveau en résumé) : nom ou agence, rôle, **statut de confiance** (5 critères constatés : numéro vérifié par SMS, 30 jours d'ancienneté, annonce en ligne, titre foncier contrôlé ou agence vérifiée, 3 avis et moyenne ≥ 4), **expérience** (sur Ika So depuis, annonces en ligne et au total, biens vendus ou loués, titres contrôlés, contacts reçus), **note moyenne et répartition**, **meilleurs avis**, **avis négatifs**, tous les avis (pagination), annonces en ligne.
- ✅ Jamais d'e-mail ni de téléphone sur le profil (testé). Auteur d'avis affiché « Prénom N. ».
- ✅ Avis (migration 017) : note 1–5 + texte de 10 à 600 caractères ; **un seul avis par personne** (le second remplace le premier) ; **seulement après un vrai échange** (message ou contact appel/WhatsApp avec l'annonceur) ; pas de numéro de téléphone dans le texte ; pas d'avis sur soi-même ; l'auteur peut modifier ou supprimer le sien.
- ✅ Modération : signalement d'un avis (4 motifs), file « Avis signalés » dans le centre de contrôle, masquer / écarter, trace dans le journal ; un avis masqué ne peut pas être republié.
- ✅ Mise en garde : avec 3 avis ou plus et une moyenne < 3, le profil affiche « Avis plutôt négatifs : redoublez de prudence » ; avec moins de 3 avis, la moyenne ne compte pas dans le niveau.
- ✅ Suppression de compte : les avis donnés et reçus disparaissent ; l'export de données les contient.
- ✅ Testé : `test/reviews.test.js` (11 tests, PostgreSQL), navigateur 52/52 (avis publié après contact, note affichée, aucun téléphone ni e-mail visible), accessibilité 0 problème sur 20 pages (clair et sombre). Défaut réel trouvé par le navigateur et corrigé : style en ligne bloqué par la politique de sécurité.
- ✅ **Droit de réponse** (migration 018) : l'annonceur répond publiquement à chaque avis reçu (une réponse, modifiable, supprimable ; 5 à 600 caractères, pas de téléphone) ; affichée sous l'avis. Testé.
- ⛔ À valider avec le juriste : responsabilité de la plateforme pour les avis (hébergeur), délai de retrait 48 h, contenu et délai du droit de réponse.
- ⬜ Pas encore fait : « temps de réponse moyen » ; profil dans le plan du site (le profil est une page de l'application, non rendue côté serveur).

- ✅ Annuaire et page d'agence (rendus côté serveur) : note moyenne et nombre d'avis, lien vers le profil complet. Pas de balisage « note » pour les moteurs de recherche (risque d'avis jugés non conformes). Testé.

## Phase 4 bis — Messagerie façon WhatsApp (lot 12, 03/11) 🟡
Demande du propriétaire : « la messagerie doit être comme celle de WhatsApp ». Réalisé avec les couleurs d'Ika So (bleu, blanc, or), pas le vert de WhatsApp.
- ✅ **Liste des discussions** (Boîte › Messages) : pastille ronde avec initiales colorées, nom de l'interlocuteur (nom du profil public), dernier message tronqué, **heure** (heure du jour / « Hier » / jour de la semaine / jj/mm/aa), **pastille de messages non lus** (compteur), discussions non lues en gras, annonce concernée, **coches** sur votre dernier message.
- ✅ **Recherche** (personne, annonce ou texte d'un message) et **filtres en pastilles** : Toutes, Non lues, Mes annonces, Mes demandes, Bloquées.
- ✅ **Conversation en bulles** : bulles à droite (vous, bleu) et à gauche (eux), **séparateurs de jour** (« Aujourd'hui », « Hier »…), heure sur chaque bulle, **une coche = envoyé, deux coches dorées = lu** (données réelles : date de lecture de l'autre personne), zone de saisie arrondie qui grandit, bouton d'envoi rond, entrée = envoi sur ordinateur (Maj+Entrée = ligne), entrée = nouvelle ligne sur téléphone, défilement automatique en bas.
- ✅ Nouveaux messages reçus **sans recharger** : la conversation se rafraîchit toute seule toutes les 8 secondes (interrogation régulière, pas de connexion permanente).
- ✅ Barre du haut de la conversation : retour, interlocuteur, lien vers l'annonce, **Profil** de l'annonceur, Signaler, Bloquer ; barre de navigation du bas masquée dans la conversation pour laisser la place à la saisie.
- ✅ Testé : 3 tests d'affichage (heures, jours) et le test de messagerie étendu (compteur, coches lues, remise à zéro à l'ouverture) ; navigateur 52/52 ; accessibilité 0 problème sur 23 pages (liste et conversation, clair et sombre) ; captures vérifiées à l'œil en mode clair.
- ⬜ Pas fait (volontairement ou non encore) : **messages vocaux, photos et pièces jointes** dans la conversation (risque : fichiers privés, modération, stockage — à décider), indication « en train d'écrire », réponse à un message précis, suppression d'un message, **notification sur le téléphone** quand le site est fermé (nécessite SMS/e-mail/push ⛔), temps réel par connexion permanente (WebSocket) au lieu de l'interrogation toutes les 8 s, épinglage et archivage de discussions, bouton « nouvelle discussion ».
- ⬜ Le mode sombre de la liste et de la conversation n'a été vérifié que par le contrôle automatique d'accessibilité, pas à l'œil.

## Phase 7 bis — Conformité juridique (lot 8, 03/11) 🟡 ⛔
- ✅ Cadrage écrit à partir de textes maliens cités : `docs/juridique/note-cadre-juridique-mali.md`, `plan-conformite.md` (18 points), procédure des badges v2, projets de confidentialité et de conditions. **Je ne suis pas juriste** : ces documents préparent le travail d'un avocat ou notaire, ils ne le remplacent pas.
- ✅ **Consentement à l'inscription** : case obligatoire (conditions + confidentialité), refus 400 sans acceptation, version des textes et date enregistrées (`terms_version`, `terms_accepted_at`, migration 016).
- ✅ **Droit d'accès** : « Télécharger mes données » (`GET /api/me/export`, JSON, sans mot de passe ni fichiers, 3 par heure).
- ✅ **Droit de suppression** : « Supprimer mon compte » (`POST /api/me/delete`, mot de passe + mot SUPPRIMER). Efface annonces, photos, justificatifs, messages, favoris, recherches, sessions. Si le compte a des paiements : **anonymisé** (e-mail, nom, téléphone effacés) et annonces liées archivées, factures gardées avec le nom du client à l'émission. Refusé pour l'équipe et pendant un paiement en cours. Journal `ika_data_requests` sans donnée personnelle.
- ✅ Pages publiques `/confidentialite` et `/conditions` (rendues depuis `docs/juridique`), liens dans le pied de page.
- ✅ Testé sur PostgreSQL 16 : `test/rights.test.js` (8 tests), règle du badge (`test/trust.test.js`).
- ⬜ Compte BANNI : ne peut pas se supprimer (volontaire, pour ne pas échapper à la sanction) ; à confirmer avec le juriste.
- ⬜ Les photos d'annonces supprimées le sont dans la transaction ; les messages envoyés à d'autres personnes disparaissent aussi chez elles (conversation supprimée) : à valider.
- ⛔ Points bloquants identifiés (voir plan de conformité) : transfert de données hors du Mali (autorisation APDP), déclaration à l'APDP, conservation des données de connexion (en tension avec « aucune IP stockée »), statut éditeur/hébergeur, durées de conservation, droit de rétractation, âge minimal, pièces foncières valables après 2021.

## Phase 5 bis — Fournisseurs tiers : code prêt, éteint (lot 13, 04/11) 🟡 ⛔
Demande du propriétaire : « mettre tous les codes nécessaires ; on activera après décision ; prendre les bonnes décisions factuelles pour moi ». Guide : `docs/fournisseurs.md`.
- ✅ **SMS** Twilio et Infobip · **paiement** CinetPay et PayDunya (création, retour client, notification en JSON ou formulaire, **confirmation auprès du fournisseur** avant d'activer quoi que ce soit, montant contrôlé, rejeu sans effet) · **e-mail** Brevo et Resend · suivi d'erreurs par webhook. **Tout est éteint** tant que les variables sont vides ; faux fournisseur refusé en production.
- ✅ **Alertes par personne** (Mon profil) : consentement daté, jamais le texte privé d'un message, 1 e-mail/heure, 5 SMS/jour, SMS seulement vers un numéro vérifié par SMS ; un canal indisponible ne s'active pas.
- ✅ **Conservation des données** : `npm run retention` (simulation) / `--apply --confirm=PURGER`, manuelle, tracée au journal ; testée sur PostgreSQL.
- ✅ **Décisions prises pour vous** (révisables, `docs/decisions.md`) : âge minimal 18 ans (case d'inscription), durées de conservation, plafonds d'alertes, factures 10 ans.
- ✅ Testé : 23 tests fournisseurs (faux réseau + PostgreSQL), 5 de conservation, 6 de configuration ; tous les tests passent ; navigateur 52/52 ; accessibilité 0 problème sur 23 pages (Express de substitution, pas le vrai).
- ℹ️ Constat : une seule adresse faisant plus de 240 requêtes/min reçoit « 429 » (frein anti-abus voulu) ; le tableau d'administration en fait 6 par action. Sans effet pour des visiteurs distincts ; à surveiller si toute une agence travaille derrière une seule adresse.
- ⛔ À vous : choisir le fournisseur SMS, l'agrégateur, fixer les tarifs, valider les durées avec un juriste malien.
- ⬜ **Jamais lancé contre un vrai service** : le premier essai bac à sable est obligatoire. Pas codés : Web Push, WhatsApp Business, vocaux/photos en messagerie, temps réel (WebSocket).

## Phase 8 — Déploiement et pilote (🟡 ⛔)
Usage local d'abord, déploiement progressif ensuite (décision du propriétaire). Environnement visé : Render + Neon.
- ✅ Contrôle de configuration avant mise en ligne (`npm run check-env`, `server/lib/preflight.js`, 6 tests) : base distante sans SSL, adresse publique non https, `TRUST_PROXY` absent, codes SMS de démonstration, premier administrateur ouvert, faux fournisseur de paiement, secret de paiement absent ou court, webhook d'erreurs non https. Sépare **bloquant** et **attention** ; n'affiche aucun secret. Votre configuration actuelle (SMS, paiement, suivi d'erreurs non choisis) donne zéro blocage.
- ✅ Guide d'exploitation `docs/exploitation.md` : avant mise en ligne, premier démarrage (contrôles à la main), déploiement et retour arrière, sauvegardes, surveillance minimale, tableau d'incidents. **Jamais exécuté sur Render/Neon** : à dérouler une première fois en cochant chaque ligne.
- ⬜ Serveur, domaine, HTTPS réels · sonde externe sur `/api/health` · sauvegarde planifiée et restauration d'essai (⛔ voir phase 7) · 5 à 10 agences pilotes · critère « 2 minutes pour publier ou trouver » mesuré sur téléphone réel.

## Décisions attendues du propriétaire
- Fournisseur SMS · agrégateur mobile money (reporté par le propriétaire, 02/11) · hébergeur et domaine · structure juridique · tarifs · quartiers prioritaires · textes juridiques.
- À confirmer : canaux de notification à brancher et leur ordre de priorité (SMS, WhatsApp, e-mail, push) ; contact réservé aux comptes connectés ; stockage initial des fichiers dans PostgreSQL/Neon décidé pour cette version (migration 009 non exécutée) ; seuils d'alerte ; avis.

## Décisions déjà prises
- 01/11 : pile Express + PostgreSQL + CSS ; aucune marque tierce ; connexion e-mail + mot de passe ; numéro vérifié par SMS.
- 01/11 : suivi d'erreurs = journaux, avec possibilité d'ajouter un service tiers.
- 01/11 : usage local d'abord, déploiement avec le temps.
- 01/11 : toujours livrer ce fichier de suivi.
- 02/11 : moyen de paiement choisi plus tard ; on pose le code essentiel et on avance sur ce qui ne demande pas de décision lourde. Le propriétaire préfère réfléchir longuement avant de trancher : les décisions réservées restent marquées ⛔ plutôt que prises à sa place.
- 02/11 : stockage initial des photos et pièces dans PostgreSQL/Neon pour éviter la perte des fichiers lors des redémarrages Render ; migration `009_stored_files.sql` préparée mais pas encore exécutée. Un stockage objet S3-compatible reste une évolution éventuelle, non nécessaire pour cette première mise en service.

## Ce qui n'a JAMAIS été vérifié (honnêteté)
Vrai `express` et vrai `pg` · aucun vrai paiement mobile money · aucun adaptateur de fournisseur (SMS, paiement, e-mail) lancé contre le vrai service · service worker sur téléphone réel · lecteur d'écran réel · tests de charge · SMS réel · stockage de photos réel · CI et Docker · temps de chargement sur téléphone réel · textes juridiques.

## Journal des versions
- Lot 13 (04/11) : fournisseurs SMS/paiement/e-mail prêts et éteints, alertes par personne, conservation des données, décisions factuelles prises (âge 18 ans, durées).
- Lot 12 (03/11) : messagerie façon WhatsApp (liste, filtres, bulles, coches lu/envoyé, rafraîchissement automatique) ; tous les tests passent, 52/52 navigateur, 0 problème d'accessibilité sur 23 pages.
- Lot 9 (03/11) : profil public de l'annonceur (confiance, expérience, note, avis positifs et négatifs, annonces) ; migration 017 ; tous les tests passent (voir ci-dessus), 52/52 navigateur, 0 problème d'accessibilité sur 20 pages.
- Lot 8 (03/11) : conformité juridique en code — consentement, export, suppression/anonymisation, pages légales, badge « Titre foncier contrôlé » ; migration 016 ; 234 tests sur 234, 48/48 navigateur, 0 problème d'accessibilité (clair et sombre).
- Textes (02/11 nuit) : procédure de contrôle des badges et projets de confidentialité et de conditions, rédigés d'après le code ; non validés.
- Phase 8, préparation (02/11 nuit) : contrôle de configuration `npm run check-env` (6 tests) et guide d'exploitation.
- Lot 7, suite (02/11 nuit) : ancienne palette bleu/or alors confirmée (historique), mode sombre et icônes PNG alors refaits ; 226 tests sur 226, 48/48 navigateur, 0 problème d'accessibilité clair et sombre.
- Lot 7 (02/11 soir) : exécution réelle du lot 6 sur PostgreSQL 16 : migrations 001–015 propres, 226 tests sur 226, 48/48 navigateur, 0 problème d'accessibilité (mode clair) après 4 corrections de contraste ; 3 corrections de tests ou d'outil, aucun défaut applicatif trouvé. Version du cache hors connexion recalculée (`stamp-sw`).
- Lot 6 (02/11) : icônes SVG devant les libellés, onglets, boutons, champs, titres et pastilles (site + centre de contrôle), navigation latérale et mobile, cœur des favoris ; `public/js/icons.js` (icônes en ligne, couleur = celle du texte), règles dans `public/js/icon-rules.js`, pose automatique par `public/js/decorate.js`. Glyphes Unicode retirés. Vérifié : 129 tests réussis, 0 échec, 1 ignoré ; captures Chromium (accueil ordinateur/mobile, fiche annonce) sans erreur console, avec une API simulée. ⬜ Non revérifié : contrôle d'accessibilité complet (`a11y.mjs`, besoin de PostgreSQL), mode sombre, téléphone réel. ⛔ Palette non appliquée : en attente de votre choix précis (les icônes suivent la palette sans changement ; les icônes PNG d'installation sont à refaire ensuite).
- Lot 4 (02/11, suite) : relecture manuelle des migrations 011 à 015 et du SQL associé (aucune erreur trouvée ; non exécutées) ; test base des orphelins complété (annonce, galerie, justificatif, casse d'UUID différente, fichier récent, rejeu) ; version du service worker automatique (`npm run stamp-sw`) ; suite : 125 réussites, 0 échec, 1 ignoré (test base orphelins).
- Lot 3 (02/11, vérification avant tests) : alertes groupées, blocage/signalement, remboursements (idempotence, rapprochement, expiration), brouillons serveur et historique de prix confirmés présents dans le code (migrations 011 à 015) ; nettoyage des orphelins ajouté. Suite avec substitut d'Express : 122 réussites, 0 échec, 1 ignoré (test base). Rien n'a été exécuté sur PostgreSQL.
- Phase 6, suite (02/11 soir) : adresses d'annonces lisibles avec redirection 301 ; tests purs verts, test de redirection écrit mais non exécuté ici.
- Phase 7, suite (02/11 soir) : frein de connexion par compte (limiteur `check/record/forget`), 5 tests purs verts ; test HTTP écrit mais non exécuté ici.
- Phase 0 (01/11) : reprise sur la pile de l'ordonnance, 36 tests.
- Phase 1 (01/11) : modules, journaux, routes testées, budget, CI, Docker ; 57 tests.
- Phase 7, suite (02/11) : audit de sécurité automatisé (2 défauts corrigés), accessibilité automatique (3 défauts corrigés, dont le mode sombre) ; 115 tests, 48 vérifications navigateur sur 48, 0 problème d'accessibilité sur 18 pages.
- Phase 5, socle (02/11) : paiements indépendants du fournisseur, offres, factures, rapprochement ; 7 tests dédiés, 107 tests au total, 48 vérifications navigateur sur 48. Phase 7, début : sauvegarde et restauration prouvées.
- Phase 6 (02/11) : pages SEO serveur, sitemap, repères de prix, guides, annuaire, import CSV, espace agence  ; 100 tests verts, 42 vérifications navigateur sur 42.
- Phase 4 (01/11) : alertes, messagerie, visites, hors ligne, correction de la course entre pages ; 84 tests, 35 vérifications navigateur sur 35 (hors erreurs réseau et 403 attendus).
- Phase 3 (01/11) : confiance, badges, liste noire, alertes ; 73 tests, 27 vérifications navigateur sur 28 (la 28e est le 403 attendu).
- Phase 2, seconde partie (01/11) : filtres superficie/chambres, partage, annonces similaires.
- Phase 2, première partie (01/11) : recherche, filtres, doublons, regroupement, suivi d'erreurs extensible ; 65 tests et 24 vérifications navigateur sur 25 (la 25e est le 403 attendu).


---

# Audit complémentaire et feuille de route d'évolution — 2 novembre 2026

Cette section complète l'historique existant sans effacer les états précédents. Les constats ci-dessous proviennent de l'inspection de l'archive `IKA_SO_express (2).zip` et des fichiers réellement présents dans cette livraison.

## A. Actions réellement effectuées pendant cette session

| Action | Résultat | Preuve / limite |
|---|---|---|
| Extraction de l'archive dans un répertoire de travail séparé | ✅ | Archive inspectée sans modifier l'original ; 109 fichiers extraits. |
| Lecture du `SUIVI.md`, des phases 0 à 7 et des décisions | ✅ | Les éléments existants ont été conservés ; les statuts antérieurs ne sont pas présentés comme des tests nouvellement rejoués. |
| Inspection de la structure serveur, routes, services, migrations et configuration | ✅ | Contrôles statiques sur authentification, rôles, modération, justificatifs, paiements, base et PWA. |
| Vérification de l'environnement | ✅ | Node.js v22.16.0 et npm 10.9.2 présents. |
| Tentative d'installation des dépendances (`npm install --ignore-scripts --no-audit --no-fund`) | 🟡 | La commande a dépassé le délai disponible ; aucune installation complète n'est confirmée. |
| Exécution de la suite complète avec le vrai Express, pg et PostgreSQL | ⬜ | Non exécutée dans cette session : dépendances non installées et base PostgreSQL non validée. |
| Modification du code applicatif ou de la base | — | Aucune modification du code métier ni aucune opération sur une base de données. |
| Mise à jour du présent suivi | ✅ | Ajout du présent audit, des risques, des propositions et des jalons de validation. |

**Règle de preuve :** les tests historiques mentionnés dans les phases précédentes restent des résultats rapportés par les livraisons précédentes. Ils ne sont pas comptabilisés comme réexécutés le 02/11 pendant cette session.

## B. Nouveaux constats techniques issus de l'inspection

### B1. Points positifs confirmés par lecture du code

- ✅ Les routes `/staff/*` délèguent les contrôles d'autorisation aux services métier ; les droits ne reposent donc pas uniquement sur le masquage des boutons dans l'interface.
- ✅ Le changement de rôle est réservé au `SUPERADMIN`, et un administrateur ne peut pas modifier son propre rôle par cette route.
- ✅ La consultation d'une pièce justificative passe par une vérification de rôle et écrit une trace `VIEW_PROOF` dans `ika_audit`.
- ✅ Les pièces justificatives ne sont pas retournées par les routes publiques ordinaires ; leur consultation passe par le centre de contrôle.
- ✅ Les mots de passe utilisent Scrypt ; les sessions sont opaques et seul leur hachage est stocké en base.
- ✅ Les confirmations de paiement sont vérifiées par le fournisseur, avec contrôle de signature et du montant, selon le socle existant.
- ✅ Les migrations sont versionnées et exécutées sous verrou consultatif PostgreSQL.

### B2. Anomalies et risques à traiter

| ID | Gravité | Constat | Action recommandée | État |
|---|---|---|---|---|
| AUD-01 | 🔴 Bloquant déploiement | `Dockerfile` copie `package-lock.json*`, mais aucun `package-lock.json` n'est livré. Le motif peut ne correspondre à aucun fichier et faire échouer la construction Docker. | Générer un lockfile avec npm dans un environnement connecté, le versionner, puis remplacer `npm install` par `npm ci` dans CI et Docker. Construire réellement l'image. | 🟡 `npm ci` en place (F-08) ; lockfile ⬜ chez vous |
| AUD-02 | 🔴 Bloquant validation | L'installation npm n'a pas abouti dans l'environnement de cette session ; le vrai Express et le vrai `pg` ne sont donc pas validés ici. | Installer sur le poste de développement, exécuter la suite avec PostgreSQL jetable, conserver les logs et corriger chaque échec avant release. | ⬜ |
| AUD-03 | 🟠 Élevé | Le limiteur de débit est une `Map` en mémoire : il se réinitialise au redémarrage et n'est pas partagé entre plusieurs instances. | Pour le pilote mono-instance, documenter la limite et surveiller ; avant montée en charge, déplacer les compteurs dans PostgreSQL ou un stockage partagé atomique. | ⬜ |
| AUD-04 | 🟠 Élevé | Le rôle du personnel et le statut du compte sont contrôlés séparément ; `requireStaff` refuse `BANNED`, mais ne refuse pas explicitement `RESTRICTED`. Un compte de personnel restreint peut donc conserver des capacités de modération. | Décider d'une règle explicite : un personnel `RESTRICTED` doit-il perdre tous les accès staff ou seulement certaines actions ? Ajouter tests de matrice rôle × statut. | ✅ code (F-06) ; test `roles-concurrence` à exécuter sur PostgreSQL ⛔ règle à confirmer |
| AUD-05 | 🟠 Élevé | Le bootstrap du premier SUPERADMIN dépend de la configuration d'environnement. En développement, il est activé par défaut ; un déploiement mal configuré en environnement non-production pourrait laisser le premier inscrit obtenir ce rôle. | Imposer `NODE_ENV=production` hors poste local, exiger une adresse de bootstrap nominative, vérifier le démarrage et désactiver le bootstrap après création du premier SUPERADMIN. | ✅ code (F-06, démarrage refusé sans `NODE_ENV`) |
| AUD-06 | 🟠 Élevé | Le SUPERADMIN peut attribuer ou retirer les rôles d'autres comptes, mais le code ne montre pas de protection contre la rétrogradation du dernier SUPERADMIN. | Empêcher la suppression/rétrogradation du dernier SUPERADMIN actif ; exiger une confirmation renforcée et journaliser la raison. Ajouter tests de verrouillage administratif. | ✅ code (F-06) ; test de course à exécuter sur PostgreSQL |
| AUD-07 | 🟠 Élevé | Les photos d'annonces et justificatifs sont conservés dans PostgreSQL sous forme de données encodées. | Migrer progressivement vers un stockage objet privé ; conserver les métadonnées et références en base ; URL signées courtes ; antivirus et validation réelle des contenus ; migration réversible et contrôlée. | ⬜ |
| AUD-08 | 🟠 Élevé | Le remboursement dans l'application est une opération de rapprochement interne ; il ne déclenche pas un remboursement réel auprès du fournisseur. | Renommer clairement l'action actuelle « marquer comme remboursé » ; ne déclarer un remboursement réel qu'après confirmation du prestataire. Ajouter idempotence et rapprochement des remboursements. | 🟡 libellés corrigés (« remboursement noté ») ; idempotence et rapprochement fournisseur 🟡 code écrit le 2 nov. (**migration `015_payment_refunds.sql` à appliquer**, tests base non exécutés) ; remboursement réel chez le fournisseur toujours ⬜ |
| AUD-09 | 🟠 Élevé | Les opérations webhook et l'application métier sont réparties sur plusieurs requêtes SQL ; le rapprochement peut réparer certains paiements payés non appliqués, mais il faut tester les interruptions à chaque étape et les webhooks concurrents. | Ajouter tests de concurrence et scénarios de panne ; verrouiller la ligne du paiement dans une transaction et traiter l'événement de façon atomique. | 🟡 transaction + verrou (F-03) ; tests de panne réels ⬜ |
| AUD-10 | 🟡 Moyen | Le service worker utilise une version manuelle (`ika-so-v7-1`) et les fichiers statiques ont une durée de cache de production. | Automatiser l'incrément de version à chaque release ; définir une stratégie de cache distincte pour `sw.js`, HTML et assets versionnés ; tester la mise à jour sur Android réel. | 🟡 version automatique faite (lot 4) ; stratégie de cache distincte pour `sw.js` et test Android ⬜ |
| AUD-11 | 🟡 Moyen | Les pièces justificatives PDF sont prévues, mais l'ouverture PDF réelle n'est pas documentée comme testée ; aucun antivirus n'est mentionné. | Tester PDF malformés, fichiers trop lourds, faux MIME, contenu actif et fichiers malveillants dans un environnement isolé. | ⬜ |
| AUD-12 | 🟡 Moyen | Les seuils d'anomalies, les règles de confiance et les guides immobiliers reposent encore sur des paramètres ou contenus à valider par des professionnels locaux. | Faire valider par notaire, géomètre, agence partenaire et juriste au Mali ; publier les limites et la date des données. | ⬜ |

**Important :** les éléments AUD-01 à AUD-12 sont des constats de code ou des risques à vérifier. Ils ne signifient pas tous qu'une exploitation malveillante a été observée.

## C. Propositions pour faire d'IKA SO une plateforme immobilière de nouvelle génération

Les propositions ci-dessous sont un portefeuille d'évolution. Elles ne sont pas codées et ne doivent pas être marquées « faites » avant réalisation et tests.

### C1. Confiance immobilière — priorité stratégique

1. **Dossier de vérification d'un bien** : identité du déclarant, mandat ou autorisation de commercialiser, pièces foncières déclarées, date de contrôle, agent vérificateur, limites du contrôle et historique des décisions.
2. **Niveaux de confiance transparents** : « identité vérifiée », « agence contrôlée », « documents examinés », « visite effectuée ». Ne jamais afficher « titre foncier garanti » ou « propriété certifiée » si la plateforme n'a pas l'autorité et les preuves pour l'affirmer.
3. **Anti-arnaque** : détection de numéros, photos, textes et annonces réutilisés ; avertissement contre les avances non sécurisées ; signalement rapide ; gel préventif soumis à une décision humaine.
4. **Traçabilité des visites** : rendez-vous, confirmation des deux parties, code de présence facultatif, compte rendu et signalement après visite.
5. **Historique vérifiable** : changements de prix, propriétaire/mandataire déclaré, statut, badge, modération et motifs accessibles selon les droits.

### C2. Recherche et découverte intelligentes

1. Recherche en langage naturel : « maison à louer à ACI 2000, deux chambres, moins de 300 000 FCFA ».
2. Recherche géographique réelle : quartiers, points d'intérêt, temps de trajet et rayon, avec fonds cartographiques et géocodage adaptés aux coûts et à la couverture locale.
3. Comparateur de biens : prix au m², caractéristiques, proximité, ancienneté de l'annonce et niveau de vérification.
4. Alertes intelligentes : baisse de prix, nouveau bien similaire, annonce remise en ligne, bien proche d'un favori.
5. Recommandations explicables : afficher pourquoi un bien est proposé, sans vendre le classement ni favoriser secrètement une annonce payante.

### C3. Espace professionnel pour agences et promoteurs

1. Comptes d'agence multi-utilisateurs avec rôles : propriétaire, directeur, agent, comptable, modérateur interne.
2. Affectation d'un bien à un agent, suivi des prospects, rendez-vous, relances et historique de contact.
3. Portefeuille de biens, import/export contrôlé, gestion des mandats, échéances et documents.
4. Mini-site public personnalisable pour chaque agence, avec domaine ou sous-domaine ultérieur.
5. Statistiques : vues qualifiées, contacts, demandes de visite, délais de vente/location et performance des annonces.
6. Gestion des promoteurs : programmes neufs, lots, disponibilité, plans, prix, réservations et historique des disponibilités.

### C4. Expérience client, mobile et inclusion

1. Interface prioritairement mobile, légère sur réseau lent et téléphone d'entrée de gamme.
2. Installation PWA complète, icônes, notifications configurables et mode faible consommation de données.
3. Français d'abord ; préparer l'architecture pour le bambara et d'autres langues locales après validation professionnelle des traductions.
4. Parcours guidés pour les personnes peu familières avec les plateformes numériques : publier, rechercher, contacter, signaler une arnaque.
5. Accessibilité clavier, lecteur d'écran, contrastes, tailles tactiles et tests TalkBack sur Android.
6. Partage d'annonce propre via WhatsApp et autres canaux, sans exposer les données privées ni contourner les préférences de contact.

### C5. Intelligence artificielle utile et contrôlée

1. Assistant de recherche et de rédaction d'annonces, avec validation humaine avant publication.
2. Aide à la qualité des annonces : champs manquants, incohérences de prix/surface, photos floues ou répétées.
3. Modération assistée : score de risque et explication, jamais bannissement automatique sur la seule décision d'une IA.
4. Estimation indicative par quartier seulement avec un volume statistique suffisant, intervalle de confiance, date et sources ; aucune promesse de valeur officielle.
5. Assistant documentaire qui résume les pièces pour les agents autorisés, sans certifier leur authenticité ni remplacer notaire, géomètre ou avocat.
6. Protection des données : consentement, minimisation, journalisation, durée de conservation et option de désactivation des traitements non essentiels.

### C6. Services et écosystème immobilier

1. Annuaire professionnel contrôlé : agences, notaires, géomètres, architectes, diagnostiqueurs, déménageurs et artisans, avec catégories et procédures de vérification adaptées.
2. Demande de devis et mise en relation, avec transparence sur les éventuelles commissions.
3. Espace diaspora : parcours à distance, visites vidéo, procurations et étapes de vérification clairement expliquées.
4. Outils de gestion locative à envisager : contrats modèles validés localement, échéancier, quittances, incidents, états des lieux et rappels.
5. Simulateurs informatifs de budget et de frais, seulement après validation des règles locales et avec avertissement de non-conseil juridique/fiscal.
6. API partenaires ultérieure, documentée, authentifiée, limitée et soumise à autorisation du propriétaire.

### C7. Gouvernance, sécurité et exploitation

1. Isolation stricte des espaces agence et des données clients ; tests automatiques anti-fuite entre comptes et organisations.
2. Authentification renforcée des administrateurs : MFA, réauthentification pour les opérations sensibles et procédure de récupération.
3. Journal d'audit inviolable au niveau applicatif, exportable, avec accès limité et conservation définie.
4. Sauvegardes chiffrées hors site, restauration testée, objectifs RPO/RTO et procédure d'incident.
5. Supervision : disponibilité, erreurs, latence, files de notifications, paiements bloqués, saturation stockage et alertes d'exploitation.
6. Déploiements progressifs, migrations compatibles, sauvegarde avant migration, rollback documenté et environnement de préproduction.
7. Protection juridique et vie privée : politique de confidentialité, consentements, droits des personnes, réclamations, suppression/archivage et procédure de violation de données, validés par un professionnel malien.

## D. Feuille de route recommandée — ordre de réalisation

| Étape | Livrable attendu | Priorité | Dépendance / validation |
|---|---|---|---|
| R0 | Stabilisation technique : lockfile, npm ci, tests vrais Express/pg/PostgreSQL, Docker et CI verts | P0 | Environnement de développement connecté et PostgreSQL jetable |
| R1 | Audit complet des rôles, statuts, superadmin, accès aux justificatifs et isolation des données | P0 | Décision sur le statut RESTRICTED du personnel |
| R2 | Paiements robustes : transactions atomiques, concurrence, rapprochement, remboursement réel séparé | P0 avant paiement public | Choix du prestataire reporté ; tests simulés possibles avant choix |
| R3 | Stockage privé des photos/pièces, migration réversible, antivirus et politique de rétention | P0 avant pilote public | Choix stockage et budget |
| R4 | Durcissement opérationnel : MFA staff, rate-limit partagé, logs, sauvegardes planifiées et restauration | P0 avant production | Hébergeur / stratégie d'exploitation |
| R5 | Pilote fermé à Bamako : 5 à 10 agences, accompagnement, métriques et retours | P1 | Procédures de vérification et documents juridiques |
| R6 | Comptes agences multi-utilisateurs, CRM prospects, mandats et mini-sites | P1 | Modèle métier agence validé |
| R7 | Cartographie réelle, recherche naturelle et comparateur | P1 | Cartographie, géocodage, coût et qualité des données |
| R8 | Notifications push/e-mail/WhatsApp/SMS et digest | P1 | Choix des fournisseurs et consentements |
| R9 | IA d'assistance à la recherche, rédaction et modération avec contrôle humain | P2 | Politique IA, données de qualité et protection des données |
| R10 | Expansion multi-villes et multi-pays, langues locales et partenaires | P2 | Validation pays par pays, juridique et opérationnelle |

## E. Indicateurs de réussite proposés

Les objectifs ci-dessous sont des cibles à mesurer, pas des performances déjà atteintes.

- Publication d'une annonce complète en moins de 2 minutes sur un téléphone d'entrée de gamme, hors vérification SMS.
- Affichage de la recherche principale en moins de 2,5 secondes au 75e percentile sur réseau mobile cible.
- Disponibilité mensuelle cible de 99,5 % au pilote, puis révision selon les moyens d'exploitation.
- 100 % des opérations administratives sensibles journalisées et attribuées à un compte nominatif.
- 0 accès inter-agences dans les tests d'isolation.
- 100 % des sauvegardes planifiées vérifiées par restauration périodique selon la politique retenue.
- Aucun paiement déclaré encaissé ou remboursé sans preuve du prestataire et rapprochement.
- Mesure mensuelle du taux de signalements confirmés, des annonces frauduleuses, du délai de modération et du taux de résolution.

## F. Décisions à recueillir avant les développements concernés

- ⛔ Le personnel avec statut `RESTRICTED` doit-il perdre tout accès au centre de contrôle ? Proposition : oui, sauf accès de consultation explicitement accordé.
- ⛔ Confirmer le principe d'un seul SUPERADMIN propriétaire, avec administrateurs délégués et procédure de secours sécurisée.
- ⛔ Choisir le stockage objet privé et le budget associé.
- ⛔ Choisir l'hébergeur, la région de données et le domaine.
- ⛔ Définir les justificatifs acceptables et le sens exact des badges, avec validation juridique/professionnelle.
- ⛔ Définir les offres et commissions ; aucun prix n'est proposé ici.
- ⛔ Choisir les canaux de notification et prestataires.
- ⛔ Définir les langues prioritaires après le français.
- ⛔ Confirmer le périmètre du CRM, de la gestion locative et des services partenaires.

## G. Prochaines actions concrètes

1. Sur un poste connecté : `npm install`, générer et conserver `package-lock.json`, puis exécuter `npm test` sur un PostgreSQL de test vierge.
2. Corriger le Dockerfile/CI pour utiliser `npm ci`, puis produire une image Docker et démarrer un conteneur avec une base de test.
3. Ajouter les tests de matrice de permissions (USER/MODERATOR/ADMIN/SUPERADMIN × ACTIVE/RESTRICTED/BANNED), y compris le dernier SUPERADMIN.
4. Ajouter les tests de concurrence et de panne des webhooks/paiements.
5. Préparer la conception de migration des photos et pièces vers un stockage privé, sans déplacer ni supprimer de données avant sauvegarde et test de restauration.
6. Après ces validations seulement, ouvrir le chantier du pilote fermé.

## Journal des actions — 02/11/2026, audit complémentaire

- Inventaire de l'archive `IKA_SO_express (2).zip` et lecture du suivi, des phases et décisions.
- Inspection statique des routes, contrôles de rôle, authentification, justificatifs, paiements, configuration, migrations, Docker, CI et service worker.
- Tentative d'installation npm interrompue par dépassement du délai ; aucun résultat de test complet revendiqué.
- Identification et consignation des risques AUD-01 à AUD-12.
- Ajout d'un portefeuille de propositions produit et d'une feuille de route R0 à R10.
- Mise à jour du suivi uniquement ; aucune modification du code métier, aucune migration appliquée et aucune base client touchée.


## Phase 9 — Stockage durable des fichiers (Render + Neon)

Objectif : aucune photo ni pièce utilisateur ne doit dépendre du système de fichiers éphémère du service web Render.

- ✅ Ajout de `migrations/009_stored_files.sql`, basée sur le SQL fourni : table `stored_files` avec UUID, clé de stockage, type MIME contrôlé, taille maximale de 2 Mo et contenu binaire `BYTEA`.
- ✅ Ajout de `server/lib/file-storage.js` : validation du type MIME et de la signature réelle (JPEG, PNG, WebP, PDF), limite de taille et enregistrement PostgreSQL.
- ✅ Nouvelles photos d'annonces : conversion des data URLs en fichiers PostgreSQL ; les annonces référencent ensuite `/api/media/:id`.
- 🟡 Route `/api/media/:id` : ne sert que des images ; type MIME contrôlé et `nosniff`. L'accès est vérifié par rapport à une annonce publiée, au propriétaire connecté ou au personnel autorisé. **Correctif de sécurité ajouté le 02/11 : `Cache-Control: private, no-store` pour toutes les images**, afin qu'une image d'annonce non publiée consultée par son propriétaire ou le personnel ne puisse pas être conservée dans un cache partagé. Le comportement HTTP réel reste à tester avec Express et un navigateur.
- ✅ Nouveaux justificatifs : contenu binaire dans `stored_files`, avec lien privé `ika_proofs.file_id`. La consultation reste soumise aux droits du personnel et à la journalisation existante.
- ✅ Compatibilité : les valeurs d'origine sont recopiées dans des colonnes `legacy_*` avant remplacement (correction F-02 du 02/11) ; la migration transfère les anciens justificatifs et photos encodés en data URL lorsqu'ils respectent les limites. Les fichiers statiques historiques `/media/` restent compatibles.
- ✅ Documentation README mise à jour : `DATABASE_URL` doit pointer vers une base PostgreSQL persistante, telle que Neon ; le disque Render n'est pas utilisé pour les fichiers métier.
- 🟡 Vérifications locales : `node --check` sur 69 fichiers JavaScript (aucune erreur) ; 21 tests ciblés (règles, stockage, confiance) réussis. Les tests PostgreSQL intégrés sont présents mais ignorés sans `DATABASE_URL_TEST`.
- 🟡 `npm test` complet : 50 réussites et 5 échecs d'import liés à l'absence du paquet `express` dans cet environnement ; ce résultat ne valide donc pas encore la suite HTTP complète.
- ⬜ Appliquer la migration sur une base de test puis sur la base Neon de production après sauvegarde vérifiée.
- ⬜ Contrôler le transfert des anciennes photos et pièces : nombre avant/après, tailles, types, références sans fichier manquant.
- ⬜ Sur Render : créer une annonce avec photo et déposer un justificatif, redémarrer puis redéployer le service ; confirmer que les fichiers restent accessibles.
- ⬜ Mettre en place la sauvegarde et la restauration de `stored_files`, avec une copie hors fournisseur.
- ⬜ Raccorder les futurs téléversements de logos et autres pièces jointes à ce stockage commun ; pour cette livraison, les formulaires connectés sont les photos d'annonces et les justificatifs fonciers/agence.
- 🟡 Enregistrement atomique ajouté dans le code pour la création/modification d'annonce (fichiers + annonce + galerie) et le dépôt de justificatif (binaire + ligne métier). Le test PostgreSQL de rollback est ajouté, mais reste à exécuter avec `DATABASE_URL_TEST` avant validation définitive.
- 🟡 Nettoyage sécurisé des fichiers orphelins (2 nov., lot 3) : commande manuelle `npm run files:orphans` (`scripts/cleanup-orphan-files.mjs`), **simulation par défaut** ; suppression seulement avec `--apply --confirm=SUPPRIMER`, fichiers de plus de 72 h (24 h minimum), un lot de 200 au plus (1 000 maximum), références revérifiées dans le DELETE lui-même, trace `ORPHAN_FILES_DELETE` dans la même transaction. Jamais branché sur le démarrage, une minuterie ou une route (test). Tests purs verts ; test base écrit mais **non exécuté** (pas de PostgreSQL ici) et il ne couvre pas encore les cas « référencé par annonce / galerie / justificatif ».
- ⬜ Pour une forte croissance : mesurer le volume PostgreSQL et étudier un stockage objet S3-compatible (R2/S3) pour les binaires, sans modifier les URL métier publiques.

### Précautions de déploiement
1. Faire une sauvegarde vérifiée de la base Neon avant la migration.
2. Déployer le code et la migration ensemble ; le migrateur applique le fichier `009_stored_files.sql` au démarrage sous verrou advisory.
3. Vérifier les journaux `[migrate] appliquée : 009_stored_files.sql`.
4. Vérifier une annonce existante, une nouvelle photo, une pièce justificative et le contrôle d'accès personnel.
5. Redémarrer puis redéployer Render et refaire les vérifications.
6. Ne jamais supprimer les anciennes colonnes de fichiers avant d'avoir validé la migration et la restauration sur une copie réelle.

**État honnête :** le code et les scripts sont ajoutés dans cette livraison, mais aucune connexion à la base Neon du propriétaire ni à son service Render n'a été effectuée depuis cet environnement. La persistance après redémarrage reste donc à prouver sur son déploiement.


### Correctif de numérotation — 2 novembre 2026

- La migration de stockage durable est numérotée `009_stored_files.sql`, immédiatement après `008_paiements.sql`.
- Le numéro `060` a été abandonné : aucun historique de migrations `009` à `059` n'existait dans l'archive initiale.
- Le migrateur trie les fichiers SQL par nom et enregistre leur nom exact dans `_migrations` ; le fichier `009` sera donc exécuté après `008` lors d'un déploiement neuf ou si cette migration n'a pas déjà été appliquée.
- Le propriétaire a confirmé le 02/11/2026 que cette migration n'avait pas été exécutée : le renommage en `009_stored_files.sql` intervient donc avant toute application en base.
- État : correction de nommage effectuée ; migration non exécutée, à valider sur une base de test avant Neon. Aucun déploiement Render n'a été fait.

### Correctif de sécurité du cache des images — 2 novembre 2026

- Inspection de `server/lib/file-storage.js` et `server/routes/index.js` : une image d'annonce non publiée peut être consultée par son propriétaire ou le personnel autorisé. L'ancien en-tête `Cache-Control: public, max-age=31536000, immutable` n'était donc pas adapté à tous les cas.
- Correction limitée : toutes les réponses `/api/media/:id` portent maintenant `Cache-Control: private, no-store`. Ce choix privilégie la confidentialité ; une optimisation de cache public différenciée pourra être étudiée plus tard avec un indicateur public/non public fiable.
- Vérifications exécutées : `node --check server/routes/index.js` et 21 tests purs ciblés (règles, stockage, confiance) réussis. Les tests PostgreSQL sont ignorés car `DATABASE_URL_TEST` n'est pas configuré ; le test HTTP avec Express réel et le test navigateur ne sont pas exécutés ici.
- Aucun fichier SQL modifié ; aucune migration exécutée ; aucune connexion Neon/Render ; aucune donnée client touchée.
- Risque restant identifié : les binaires sont insérés avant certaines opérations métier et peuvent devenir orphelins si une opération ultérieure échoue. Une transaction atomique et des tests PostgreSQL sont à réaliser avant de considérer le stockage comme prêt pour une forte charge.



### Correctif d'atomicité du stockage — 2 novembre 2026

- ✅ Création d'annonce : les contrôles métier (liste noire, doublon, similarité) sont effectués avant l'écriture des fichiers ; l'enregistrement des fichiers, de l'annonce, du nom de profil éventuel et des photos de galerie est maintenant regroupé dans `db.transaction()`.
- ✅ Modification d'annonce : verrouillage de la ligne avec `SELECT ... FOR UPDATE` ; les nouveaux fichiers, la mise à jour de l'annonce et le remplacement de la galerie sont exécutés dans une seule transaction. Une erreur déclenche le rollback de l'ensemble.
- ✅ Dépôt de justificatif : verrouillage du profil pour sérialiser les dépôts concurrents et contrôler la limite de cinq pièces en attente ; stockage du binaire et insertion de la pièce dans la même transaction.
- ✅ Ajout d'un test d'intégration PostgreSQL : simuler l'échec sur la deuxième photo et vérifier que le premier binaire est annulé avec la transaction.
- 🟡 Vérification de syntaxe : `node --check` sur les fichiers modifiés (`server/services/listings.js`, `server/services/trust.js`, `test/trust.test.js`) sans erreur.
- 🟡 Tests exécutés : `node --test` donne 51 réussites, 5 échecs d'import parce que `express` n'est pas installé dans l'environnement ; les tests nécessitant PostgreSQL sont ignorés faute de `DATABASE_URL_TEST`. Les 19 tests ciblés `rules` + `storage` réussissent.
- ⬜ Exécuter le test d'intégration de rollback et toute la suite sur une base PostgreSQL temporaire, avec les dépendances installées.
- ⬜ Tester les cas de concurrence sur la limite des cinq justificatifs et les modifications simultanées d'annonce.
- ⬜ Vérifier après tests que les fichiers remplacés ou non référencés ne sont pas supprimés par erreur ; aucun nettoyage automatique des binaires n'est introduit dans ce correctif.
- ⬜ Ne pas déployer sur Neon/Render avant ces validations ; migration `009_stored_files.sql` toujours non exécutée selon confirmation du propriétaire.

**Limites de cette livraison :** aucune base PostgreSQL réelle n'a été utilisée ici ; aucune migration n'a été appliquée ; aucun accès Render ou Neon n'a été effectué. L'atomicité est implémentée dans le code, mais la garantie opérationnelle doit encore être confirmée par le test d'intégration sur PostgreSQL.


### Correctif anti-réutilisation croisée des photos — 2 novembre 2026

- **Risque identifié pendant la poursuite de l'audit :** `storePublicImage()` acceptait toute URL `/api/media/<uuid>` fournie par un client sans vérifier que ce fichier appartenait déjà à l'annonce modifiée. Un utilisateur connaissant l'identifiant d'un fichier pouvait tenter de rattacher ce fichier à une autre annonce et, si celle-ci était publiée, en changer les conditions de visibilité.
- **Correction :** lors d'une modification, une image PostgreSQL existante n'est conservée que si elle est déjà référencée par `image_url` ou `ika_listing_photos` de la même annonce et que cette annonce appartient à l'utilisateur connecté. Lors d'une création, la réutilisation d'une URL `/api/media/` existante est refusée ; l'utilisateur doit téléverser le fichier.
- **Durcissement des chemins statiques :** les références `/media/` sont limitées à un nom de fichier simple avec extension image autorisée ; les chemins imbriqués et les tentatives de traversée (`../`) sont rejetés. Les quatre médias statiques existants du projet respectent ce format.
- **Fichiers modifiés :** `server/lib/file-storage.js`, `server/services/listings.js`, `server/lib/rules.js`, `test/storage.test.js`, `test/rules.test.js`, `README.md`. Aucun fichier de migration SQL modifié.
- **Tests exécutés :** `node --test test/storage.test.js test/rules.test.js` : 23 tests réussis, 0 échec, 0 ignoré. `node --check` sur les fichiers JavaScript modifiés : aucune erreur de syntaxe.
- **Limites :** l'installation des dépendances a été tentée dans la copie de travail mais a expiré ; la suite complète avec Express/pg n'a donc pas été exécutée. Aucun serveur PostgreSQL local n'est disponible ; les tests d'intégration DB, les migrations 001–009 et le rollback transactionnel ne sont pas validés.
- **Aucune opération sur Neon ou Render :** aucune migration appliquée, aucun déploiement, aucune donnée réelle modifiée.
- **Prochaine étape :** installer les dépendances dans un environnement isolé disposant d'un accès fiable au registre npm, puis utiliser exclusivement une base PostgreSQL jetable pour valider les migrations et les parcours de stockage.


### Renforcement des sauvegardes et de la restauration — 2 novembre 2026

- Inspection de `scripts/backup.sh`, `scripts/restore-check.sh`, `README.md` et du suivi : l'ancienne sauvegarde utilisait par défaut un dossier local (potentiellement éphémère sur Render) ; l'ancien test de restauration comparait les nombres de lignes à la base source et ne constituait pas une preuve de reprise indépendante après perte de la source.
- Modification de `scripts/backup.sh` : variables obligatoires `DATABASE_URL`, `BACKUP_REMOTE` (remote rclone hors serveur) et `BACKUP_AGE_RECIPIENT` ; dump custom temporaire ; contrôle `pg_restore --list` ; chiffrement `age` ; empreinte SHA-256 ; transfert distant et vérification de contenu avec `rclone check --download` ; suppression du répertoire temporaire en sortie. Aucune suppression automatique d'archives distantes n'est activée afin d'éviter une purge accidentelle.
- Modification de `scripts/restore-check.sh` : variables obligatoires `RESTORE_TEST_ADMIN_URL`, `BACKUP_AGE_IDENTITY` et `RESTORE_TEST_ALLOW_CREATE_DATABASE` ; vérification de l'empreinte ; déchiffrement temporaire ; restauration dans une base de test générée ; contrôle de connexion et de présence de tables ; suppression de la base temporaire à la sortie. Le script ne lit pas `DATABASE_URL` et ne compare plus avec une base source de production.
- Mise à jour de `README.md` avec les prérequis, les commandes, le modèle de secrets et les avertissements d'exploitation.
- Ajout de `test/ops-scripts.test.js` : 5 tests de garde-fous (variables obligatoires, destination distante, chiffrement, cible de test et confirmation explicite du serveur jetable).
- Vérifications exécutées : `bash -n scripts/backup.sh scripts/restore-check.sh` sans erreur ; `node --test test/ops-scripts.test.js` : 5 réussites, 0 échec.
- Limites : aucun `pg_dump`, `pg_restore`, `age` ou `rclone` n'a été exécuté contre un serveur ; aucune destination distante ni paire de clés n'est configurée ; aucun test PostgreSQL de restauration n'a été réalisé. Les scripts sont préparés mais la chaîne de sauvegarde n'est pas opérationnelle tant que les secrets et services ne sont pas configurés.
- Aucune connexion à Neon/Render, aucune migration appliquée, aucune donnée client modifiée.
- Prochaine étape : configurer un remote distant et des secrets sur un runner dédié, effectuer une sauvegarde, puis restaurer cette archive sur une instance PostgreSQL jetable et vérifier `stored_files` et les relations métier.


### Diagnostic de cohérence des fichiers — 2 novembre 2026

- Inspection des schémas `ika_listings`, `ika_listing_photos`, `ika_proofs` et `stored_files`, de la migration `009_stored_files.sql` et des fonctions de stockage/lecture.
- Ajout de `scripts/audit-stored-files.sql` : rapport en transaction `READ ONLY` pour compter les références `/api/media` sans fichier, les justificatifs sans fichier/contenu, les anciennes data URLs, les tailles incohérentes, les références multiples entre annonces, les justificatifs partageant un binaire, les PDF référencés comme images et les fichiers sans référence connue.
- Les fichiers non référencés sont classés comme éléments à examiner, pas comme déchets certains. Aucune suppression ou correction automatique n'est proposée.
- Ajout de `test/storage-audit.test.js` pour contrôler les garde-fous en lecture seule et la couverture des principales tables.
- Mise à jour du README avec la commande d'exécution et les précautions d'accès.
- Vérifications exécutées : `node --test test/storage-audit.test.js test/ops-scripts.test.js` : 8 réussites, 0 échec ; `bash -n scripts/backup.sh scripts/restore-check.sh` sans erreur.
- Limites : `psql` n'est pas installé dans cet environnement ; la syntaxe SQL n'a donc pas été validée par un moteur PostgreSQL et le rapport n'a pas été exécuté sur une base. Aucune connexion Neon/Render ; aucune migration appliquée ; aucune donnée client lue ou modifiée. Le diagnostic suppose que la migration 009 est déjà appliquée et ne peut pas être lancé avant celle-ci.
- Prochaine étape : valider la syntaxe et les résultats du rapport sur une base PostgreSQL jetable, puis comparer les anomalies éventuelles avec un export de sauvegarde avant toute décision de correction.


### Précontrôle des données historiques avant migration 009 — 2 novembre 2026

- Analyse du SQL de `009_stored_files.sql` : les anciennes data URLs sont décodées directement par PostgreSQL ; un payload mal formé, un MIME non accepté ou un contenu supérieur à 2 Mio peut être ignoré ou faire échouer la migration selon le cas. Les justificatifs utilisent le `file_type` de la colonne et non le MIME extrait de leur data URL, ce qui rend les divergences à examiner avant migration.
- Ajout de `scripts/preflight-stored-files.sql`, transaction `READ ONLY`, à exécuter sur une copie restaurée après les migrations 001 à 008 et avant 009. Le rapport vérifie les colonnes attendues, les data URLs mal formées, les MIME non pris en charge, les PDF dans les photos, les divergences de MIME des justificatifs, la syntaxe base64, les contenus vides, les tailles supérieures à 2 Mio et les anciens contenus non-data-URL.
- Le précontrôle n'appelle pas `decode()` et ne modifie aucune donnée. Les candidats compatibles ne sont pas déclarés valides sur le plan binaire : la signature réelle PNG/JPEG/WebP/PDF n'est pas contrôlée par ce SQL.
- Ajout de `test/storage-preflight.test.js` pour verrouiller la lecture seule et la couverture des cas critiques. Mise à jour du README avec l'ordre d'exécution.
- Vérifications exécutées : `node --test test/storage-preflight.test.js test/storage-audit.test.js test/ops-scripts.test.js` : 11 réussites, 0 échec. Le premier essai a révélé un faux positif du test qui détectait le mot `decode()` dans un commentaire ; le test a été corrigé pour analyser le SQL exécutable hors commentaires, puis la suite ciblée a réussi.
- Limites : aucun serveur PostgreSQL / `psql` disponible dans cet environnement ; ni syntaxe SQL ni résultats de données validés par PostgreSQL. Aucun accès Neon/Render, aucune migration exécutée, aucune donnée client modifiée.
- Prochaine étape : exécuter le précontrôle sur une copie PostgreSQL jetable issue d'une sauvegarde, traiter manuellement les éventuels `BLOCKER`, puis tester la migration 009 sur cette même copie avant toute décision de production.

### Refonte visuelle du tableau de bord IKA SO — 2 novembre 2026

- Application du langage visuel de la maquette fournie : interface bleu profond/bleu vif, blanc et accent or, navigation latérale sur grand écran, barre supérieure, cartes arrondies, ombres légères et hiérarchie visuelle plus marquée.
- Adaptation au métier réel du projet : le bandeau met en avant terrains, maisons et appartements à vendre ou à louer ; l'image de la bannière réutilise une photo immobilière déjà présente dans `public/media/` ; les filtres, les annonces, les favoris, la carte, les statuts de vérification et les parcours existants sont conservés.
- Refonte de `public/index.html` pour structurer la barre latérale, l'espace de travail, l'en-tête, le pied de page et la navigation mobile.
- Mise à jour de `public/js/components/chrome.js` : navigation latérale avec les routes existantes, compteur de messages non lus, accès profil et dépôt d'annonce ; la navigation mobile reste disponible.
- Mise à jour de `public/js/pages/home.js` : nouveau bandeau d'accueil, accès direct au dépôt d'annonce, garanties formulées selon les fonctions déjà présentes et regroupement visuel de la recherche.
- Ajout des styles responsive dans `public/css/ika.css`. Aucun framework ni ressource externe supplémentaire.
- Aucun changement de schéma, migration, API métier, règle d'autorisation, donnée, photo utilisateur ou mécanisme de stockage.
- Vérifications exécutées : `node --check public/js/components/chrome.js`, `node --check public/js/pages/home.js` et `node --check server/app.js` sans erreur ; tests ciblés `storage-audit`, `storage-preflight` et `ops-scripts` : 11 réussites, 0 échec.
- Limites : pas de navigateur graphique/jeu de données de démonstration utilisé pour valider le rendu à l'écran ; aucun test visuel automatisé, aucune connexion PostgreSQL, aucun déploiement Render/Neon. Les chiffres fictifs de la maquette n'ont pas été ajoutés ; les annonces et données restent alimentées par l'API réelle.
- Prochaine étape : exécuter l'application dans un environnement de test avec une base de démonstration non sensible, contrôler les vues desktop/tablette/mobile et corriger les éventuels débordements avant livraison de production.
- Suite complète `npm test` tentée : 65 tests réussis, 5 échecs de chargement de suites serveur (`connexion`, `payments`, `routes`, `securite`, `seo`) dus à l'absence du paquet `express` dans cet environnement (`ERR_MODULE_NOT_FOUND`). Les tests de base de données dépendant de `DATABASE_URL_TEST` sont restés ignorés. Aucun `npm install` n'a été lancé et aucun paquet n'a été ajouté.
- Incrément de la version du cache Service Worker (`ika-so-v7-2`) pour forcer le renouvellement des ressources statiques modifiées sur les appareils lors de la prochaine mise à jour de l'application.


## Corrections de l'audit du 2 novembre 2026 (F-01 à F-09)

Vérifié ici : `node --check` sur tous les fichiers JS, `bash -n` sur les scripts, `npm test` avec le substitut d'Express (93 tests, 0 échec, dont 11 nouveaux dans `test/corrections-audit.test.js`). **Non vérifié** (pas de PostgreSQL ni de réseau) : exécution des migrations 009 et 010, transactions réelles, tests de base, image Docker.

| Constat | Correction | État |
|---|---|---|
| F-01 | Migration 009 : décodage base64 tolérant (`pg_temp.safe_b64`, forme et taille contrôlées avant décodage) ; une valeur illisible est ignorée et laissée intacte au lieu de bloquer le démarrage. Démarrage du serveur inchangé ; `npm run migrate` seul recommandé avant bascule. | 🟡 SQL non exécuté |
| F-02 | Valeurs d'origine conservées dans `legacy_file_data`, `legacy_image_url`, `legacy_url`. README et suivi corrigés. | 🟡 SQL non exécuté |
| F-03 | Webhook : événement + statut + application dans une transaction ; échec ou paiement inconnu = annulation, la relance du fournisseur est traitée. Application du paiement atomique (aussi pour le rapprochement). | ✅ testé avec base factice ; 🟡 test de panne réel à faire |
| F-04 | `TRUST_PROXY` = nombre de sauts (1 sur Render) ; valeur invalide refusée ; avertissements au démarrage ; documenté (README, `.env.example`). | ✅ |
| F-05 | Migration 010 (index hachage sur `image_url` et `url`) ; compteur de débit séparé (1 200/min) pour `/api/media` ; cache privé 5 min + ETag/304 pour les annonces publiées, `no-store` sinon. | 🟡 SQL non exécuté |
| F-06 | Personnel RESTRICTED : droits de modération suspendus (⛔ décision à confirmer, voir `docs/decisions.md`) ; changement de rôle sérialisé et refusé s'il ne reste aucun SUPERADMIN actif ; démarrage refusé sans `NODE_ENV` ; avertissement tant que le bootstrap est ouvert ; procédure documentée. | 🟡 course à tester sur PostgreSQL |
| F-07 | Sanction, changement de rôle, mise à la une, remboursement, réglage d'offre : action et trace d'audit dans la même transaction ; plafond « à la une » contrôlé sous verrou, paiements en attente comptés comme places réservées. | 🟡 à tester sur PostgreSQL |
| F-08 | Versions exactes dans `package.json` ; Dockerfile et CI passent à `npm ci`. **`package-lock.json` non généré** (réseau bloqué) : `npm install` chez vous, puis versionner le fichier, sinon la construction Docker échoue volontairement. | ⬜ lockfile à générer |
| F-09 | Section « Déploiement sur Render + Neon » du README : variables, commande de démarrage, `/api/health`, migration 009, bootstrap. | ✅ |

À faire ensuite : plan d'action de l'audit, étapes 1 (npm install + lockfile + `npm test` sur PostgreSQL jetable) et 2 (précontrôle, migrations 009/010 et `audit-stored-files.sql` sur une copie restaurée de Neon).

### Suite du 2 novembre 2026
- ✅ AUD-08 (partiel) : le journal affiche « Remboursement noté (fait chez le fournisseur) » ; il n'y a pas de remboursement automatique.
- 🟡 Ajout de `test/roles-concurrence.test.js` (matrice rôle × statut, course entre deux SUPERADMIN, trace d'audit) : **écrit mais non exécuté** (nécessite `DATABASE_URL_TEST`).
- ⬜ Reste, uniquement possible chez vous (réseau, PostgreSQL, téléphone, Render) : lockfile + `npm test` complet, migrations 009/010 sur copie de Neon, `npm audit`, sauvegarde distante, Lighthouse, TalkBack, SMS réel. Je n'ai pas introduit de nettoyage automatique des fichiers orphelins (risque de suppression par erreur).
- ✅ Corrections visuelles (vues sur captures du navigateur, API simulée) : bouton central « Déposer » du menu du bas sur téléphone (le style s'appliquait aussi à l'étiquette), filtres de l'accueil sur ordinateur (grille adaptative). Service worker passé à `ika-so-v7-4`. Palette réelle de l'interface : bleu et jaune or (le vert/or/crème du suivi n'est pas appliqué) ; ⛔ à trancher, icônes PNG à refaire ensuite.

### Cartographie, étape 4 (partielle) : localisation et dessin sans fond de carte externe — 4 novembre 2026

- Ajouts : `public/js/map/{provider,local,geometry}.js`, `public/js/pages/localisation.js`, `test/geo-ui.test.js` ; routes `#/localiser/:id` et `#/carte`, entrée de menu « Ma carte », bouton « Localiser » dans Mes annonces, bloc « Localisation » sur l'annonce publique (seulement si position rendue publique).
- `Permissions-Policy` : `geolocation=(self)` (GPS réservé à notre site). CSP inchangée, aucune dépendance ajoutée. Service worker `ika-so-` re-estampillé.
- Défaut trouvé et corrigé pendant la vérification : l'aperçu de superficie utilisait une sphère (écart de 0,4 % avec le serveur à Bamako) ; il utilise maintenant les rayons WGS84 locaux, écart < 0,1 %, verrouillé par un test.
- Vérifié : `npm test` avec le substitut d'Express (192 réussis, 0 échec, 1 ignoré) ; parcours de l'écran dans Chromium avec API simulée, sans erreur JavaScript.
- Non vérifié : vrai serveur/base, vrai GPS, vrai téléphone, bloc public sur l'annonce dans un navigateur. Les tests de base de l'étape 3 (`geo-db`, `securite`, migration 020) restent à lancer chez vous.
- Prochaine étape : lancer chez vous `DATABASE_URL_TEST=… npm test`, puis décider Mapbox (jeton, CSP, fichiers dans `public/vendor/`) pour l'étape 4 bis, ou passer à l'étape 5 (export imprimable).

### Cartographie, étape 5 : fiche imprimable — 4 novembre 2026

- Ajouts : `server/lib/fiche.js`, route `GET /api/me/listings/:id/fiche`, `GeoService.fiche()`, `public/css/fiche.css`, `public/js/fiche.js`, `test/fiche.test.js`, bouton « Fiche imprimable (PDF) » dans l'écran de localisation. Aucune dépendance ajoutée, CSP inchangée, service worker re-estampillé (règle du projet : tout fichier de `public/js` est préchargé).
- Vérifié : suite complète avec le substitut d'Express (200 réussis, 0 échec, 1 ignoré) ; fiche dans Chromium sans erreur, export PDF d'une page A4 (mise en page resserrée après un premier essai à 2 pages).
- ⛔ À faire par vous : valider ou remplacer le texte de la mention obligatoire. Non vérifié : vrai serveur/base, impression réelle.
- Prochaine étape : étape 6 (recette complète) après vos tests de base, et étape 4 bis (Mapbox) quand le jeton est prêt.

### Cartographie, étape 4 (suite) : suppression d'un sommet précis — 4 novembre 2026

- Demande d'origine : limite connue de l'étape 4 (« supprimer un sommet précis n'est pas possible »). Statut : **Validé** pour la partie navigateur testée ci-dessous.
- Solution : un appui (sans glisser) sur un sommet le choisit (pastille foncée à contour or) ; un second appui le relâche ; le bouton « Supprimer le point choisi » le retire. Appui sur le fond, « Annuler le dernier », « Tout effacer » : le choix est effacé. Glisser un sommet le corrige et le choisit. Aucune dépendance, CSP et serveur inchangés.
- Fichiers modifiés : `public/js/map/geometry.js` (`removeVertex`), `public/js/map/local.js` (sélection, `getSelected`, `removeSelected`, rappel `onSelect` ; contrat du fournisseur complété), `public/js/pages/localisation.js` (bouton, texte d'aide), `public/css/ika.css` (`.geo-vertex-sel`), `public/sw.js` (re-estampillé : `ika-so-b226053435`), `test/geo-ui.test.js` (3 tests ajoutés), `docs/cartographie.md`.
- Tests : `geo.test.js`, `geo-ui.test.js`, `sw-version.test.js`, `budget.test.js`, `icons.test.js` : 46/46 (Node 22, sans base). Chromium (composant `local.js` seul, page de test jetable non livrée, fenêtre 800 px) : sélection, relâchement, suppression du bon sommet, suppression sans choix sans effet, glisser, désélection par appui sur le fond et par « Annuler », aucune erreur JavaScript : 14/14.
- **Non vérifié** : la suite complète (pas de `express` ni de PostgreSQL ici), l'écran complet avec le bouton dans un navigateur, le geste au doigt sur un petit téléphone réel (cibles tactiles de 20 unités de rayon, à confirmer à l'étape 6).
- Risque de régression : faible (ajout, aucune route ni donnée touchée). Un fournisseur Mapbox futur devra reprendre le même contrat (`getSelected`, `removeSelected`, `onSelect`).

### Cartographie, étape 6 (préparation) : liste de recette — 4 novembre 2026

- Ajout : `docs/recette-cartographie.md` (préparation, ordinateur, confidentialité et droits, téléphone réel, régression). Rien n'est exécuté : tous les points sont **Non testé**.
- ⛔ Décision attendue, filtre de recherche par zone de carte : les positions exactes sont privées par défaut. Un filtre par rectangle sur toutes les positions permettrait de les retrouver par recoupements. Règle proposée à valider : le filtre ne porte que sur les annonces dont l'annonceur a rendu la position publique (les autres restent trouvables par quartier). Rien n'a été codé avant votre accord, et son SQL ne pourrait de toute façon être éprouvé que sur une vraie base.

### Cartographie, étape 4 bis (préparation serveur) : jeton Mapbox — 4 novembre 2026

- Décision du propriétaire : fournir un jeton Mapbox public (« pk. »). **Le jeton n'est écrit dans aucun fichier du projet** (contrôle fait : 0 occurrence). Il se pose uniquement dans la variable d'environnement `MAPBOX_TOKEN` (Render : Environment ; local : variable du shell).
- Ajouts : `server/config.js` (`mapbox`, `parseMapboxToken` : seul un jeton « pk. » valide est gardé ; « sk. », « tk. » ou toute autre forme est rejeté et jamais exposé) ; `server/lib/web.js` (`contentSecurityPolicy`) ; route publique `GET /api/config/map` (`{ mapbox: { token } }` ou `{ mapbox: null }`, `no-store`) ; `server/lib/preflight.js` (`MAPBOX_JETON` bloquant, `MAPBOX_RESTRICTION` attention) ; tests dans `web.test.js` et `preflight.test.js` ; `GET /config/map` ajoutée aux routes publiques de `securite.test.js`.
- **CSP** : sans jeton, strictement identique à avant (test inchangé). Avec un jeton valide seulement : `connect-src` + `api.mapbox.com` et `events.mapbox.com` ; `img-src` + `blob:` et `api.mapbox.com` ; `worker-src` et `child-src` `blob:`. `script-src` et `style-src` restent `'self'` : la bibliothèque doit être hébergée chez nous.
- Tests : 174 réussis sur 181 exécutables sans express ; les 6 échecs sont uniquement « paquet express introuvable » (environnement), 1 ignoré (base).
- ⛔ **Reste pour que le fond de carte s'affiche** : (1) déposer `mapbox-gl.js` et `mapbox-gl.css` (version à choisir et à figer) dans `public/vendor/` — réseau coupé ici ; (2) écrire le fournisseur `public/js/map/mapbox.js` (même contrat que `local.js`) et le choisir dans `provider.js` quand `/api/config/map` donne un jeton, sinon plan local ; (3) ajouter les fichiers au service worker ; (4) tester dans un vrai navigateur avec accès à Mapbox. Aucun de ces points n'est fait.
- ⛔ **Sécurité du jeton** : le jeton ayant été écrit dans une conversation, restreignez-le à l'adresse de votre site dans votre compte Mapbox (restriction par URL) et, par prudence, créez-en un nouveau si vous ne l'avez pas encore restreint. Confirmez licence et coûts par écrit avant la production.

### Cartographie, étape 4 bis (suite) : fournisseur Mapbox et repli — 4 novembre 2026

- Ajouts : `public/js/map/mapbox.js` (fournisseur, même contrat que `local.js` + `setBase("streets"|"satellite")`), `public/js/map/provider.js` réécrit (choix + repli), `public/vendor/LISEZMOI.md`, `scripts/verification/carte-mapbox-stub.py` et `carte-sommets.py`, `public/sw.js` (mapbox.js préchargé ; version `ika-so-a84f2e2f36`), tests statiques complétés, scénarios 3 bis dans `docs/recette-cartographie.md`.
- Règle de choix : Mapbox seulement si le serveur donne un jeton, la bibliothèque hébergée chez nous se charge ET la carte démarre ; sinon plan local (pas de jeton, hors connexion, fichiers absents, jeton refusé, délai de 15 s). Les pages ne connaissent toujours que `createMap()`.
- Défaut trouvé et corrigé pendant la vérification : une carte Mapbox qui échouait au démarrage n'était pas retirée avant le repli.
- Tests : statiques 38/38 (geo-ui, sw-version, budget, web). Chromium avec **fausse** bibliothèque Mapbox (stub) : choix et repli dans 4 situations, contrat complet (clics, sélection, suppression, glisser, repère, satellite, annulation, effacement, destruction), 23/23 ; plan local 14/14 ; aucune erreur JavaScript.
- ⛔ **Non vérifié** : tout ce qui dépend de la VRAIE bibliothèque Mapbox GL JS (rendu, couches, glisser au doigt, géométrie des événements, styles inline éventuels face à la CSP, version exacte), le réseau Mapbox, le jeton restreint. Le stub ne reproduit que le contrat que j'ai supposé de l'API. Les fichiers `mapbox-gl.js` et `.css` ne sont pas dans le projet : tant qu'ils sont absents, le site reste sur le plan local.

### Cartographie / Mapbox — validation technique demandée le 4 novembre 2026 (résultats réels)

Rapport détaillé : `docs/validation-mapbox.md`. **L'intégration Mapbox N'EST PAS validée** : l'environnement de cette session n'a ni réseau, ni PostgreSQL, ni Render, ni la bibliothèque Mapbox.
- ✅ (avec le substitut d'Express) `GET /api/config/map` : `test/config-map.test.js` 3/3, aucun secret divulgué (7 secrets injectés, absents du corps et des en-têtes), jeton `sk.` ou invalide jamais renvoyé.
- 🔧 Défaut corrigé : la route plantait (500), `config` absent de la signature de `buildRoutes` (`server/routes/index.js`). Les deux archives précédentes de cette conversation le contiennent.
- 🟡 Suite complète avec le substitut d'Express : 210 tests, 209 réussis, 0 échec, 1 ignoré. Les « 6 échecs » précédents étaient l'absence du paquet `express` ; ce n'est pas une preuve avec le vrai `express`. Tests base non exécutés.
- ⛔ Non exécuté : installation propre, CSP avec Mapbox réel (tuiles, styles, images, workers), Render, carte réelle rues/satellite, marqueur GPS, enregistrement et relecture après reconnexion, isolation A/B sur PostgreSQL, refus GPS réel, coupure réseau réelle.
- Fichiers de ce lot : `server/routes/index.js` (correctif), `test/config-map.test.js` (nouveau), `docs/validation-mapbox.md` (nouveau). Aucune migration. Fonctionnalités existantes inchangées.



## Palette officielle (07/11/2026)

La référence actuelle est **forêt / lime / sable** (`#102C25`, `#1E6B50`, `#C9EF75`, `#F6F5EF`).
Les couleurs de la bannière d’accueil sont réglables depuis le centre de contrôle (overlay, opacité, accent, texte).
Les mentions bleu/or sont historiques uniquement.

## Owner Control Center v2 (08/11/2026)
Page `/owner`, journal unifié des mouvements, dossiers de traçage, migration 042. Voir `LIVRAISON_OWNER_CENTER_2026-11-08.md` et `CHANGELOG_OWNER_CONTROL.md` (v2.0). Environnement : PostgreSQL 18, Node.js, localhost.
