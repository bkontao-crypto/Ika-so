# Ika So — Suivi du projet

Mis à jour le 21 novembre 2026 (cadre du profil dans la carte annonceur de la fiche annonce) — auparavant : 21 novembre 2026 (onglet « Découvrir » : publications de la communauté) — auparavant : 21 novembre 2026 (conditions officielles et exceptions tracées) — auparavant : 21 novembre 2026 (suivi de remboursement Premium en 3 étapes) — auparavant : 21 novembre 2026 (Premium en 3 étapes : décisions du propriétaire, SMS à la décision finale) — auparavant : 20 novembre 2026 (Premium : le numéro confirmé est la certification) — auparavant : 20 novembre 2026 (Premium : numéro confirmé par SMS obligatoire) — auparavant : 19 novembre 2026 (aperçu des pièces et saisie des motifs) — auparavant : 19 novembre 2026 (Premium sans certification : explications) — auparavant : 19 novembre 2026 (photo de profil dans l'en-tête) — auparavant : 19 novembre 2026 (DEC-003 tranchée) — auparavant : 19 novembre 2026 (écran « Délégations de modules ») — auparavant : 19 novembre 2026 (PDF du CRM et de l'audit de modération) — auparavant : 19 novembre 2026 (mise en page professionnelle des PDF) — auparavant : 19 novembre 2026 (exports PDF en plus du CSV) — auparavant : 19 novembre 2026 (Super Administrateur : habitudes de connexion) — auparavant : 19 novembre 2026 (lien « Gérer mes choix » sur les pages serveur) — auparavant : 19 novembre 2026 (cookies, lot C : registre des cookies et prestataires) — auparavant : 18 novembre 2026 (cookies, lot B : Statistiques soumises au consentement) — auparavant : 16 novembre 2026 (bouton afficher/masquer le mot de passe) — auparavant : 7 novembre 2026 (branchement des 22 événements analytiques et harmonisation de la palette) — auparavant : 6 novembre 2026 (profil public) — avant : 4 novembre 2026 (cartographie : étapes 4 et 5, suppression d'un sommet). Dernier lot « base réelle » : 2 novembre 2026, soir (lot 7, première exécution du lot 6 sur un vrai PostgreSQL). Ce fichier est livré avec chaque version : il dit **ce qui est fait (et prouvé)**, **ce qui reste**, et **ce qui attend une décision**.
Légende : ✅ fait et testé · 🟡 fait mais vérification incomplète · ⬜ à faire · ⛔ décision du propriétaire attendue

## Intégration des correctifs externes du 19-20 novembre (20 novembre 2026)
**À réaliser** : mettre en place l'archive `ika-so-correctifs-complets.zip` (base c8fc425) si elle est conforme au code actuel (9035707), sinon l'adapter. Branche `feat/correctifs-externes`.
**Appliqué tel quel** : historique des demandes de pièces (Confiance : `trust.proofHistory`, `GET /staff/proofs/history` protégé par la délégation `trust`, panneau `v-proof-history.js`) ; centre Premium : favoris et contacts par annonce sur la période choisie (contacts = appels, WhatsApp, messages, visites) et variation « Nouveau » au lieu de « +100 % » (`viewsChange` et `contactsChange` peuvent valoir `null`) ; bannière d'accueil « Devenir annonceur » masquée pour un compte approuvé ; colonne « Basique » du tableau Standard / Premium.
**Adapté (conflit avec une décision plus récente)** : depuis le commit d0f44f7, le propriétaire a décidé que **le numéro confirmé est la certification** (badge agence ou titre facultatif). Donc :
- `account.js` du zip **non copié** : seule la règle « carte Devenir annonceur masquée si demande APPROVED » est reprise. La **liste d'étapes de certification** (RCCM, titre foncier) et `certification.js` ne sont **pas intégrés** : elle décrirait une condition qui n'existe plus.
- `premium.js` : textes de la page Avantages mis en cohérence (étape 1 « Faire certifier votre numéro », statut « Numéro confirmé / à confirmer », avertissement avant paiement, FAQ, centre ouvert quand le numéro est confirmé et l'abonnement actif) ; le nom « Premium certifié » est conservé.
**Vérifié** : `npm test` ; SQL de l'historique et de la période par annonce exécutés sur PostgreSQL 16 ; test ajouté pour `proofHistory` (statut en liste blanche, lecture seule, refus d'un non-personnel).
**Non vérifié** : rendu navigateur du panneau d'historique et de la carte Compte (4 cas du zip) ; accès refusé à un administrateur sans délégation `trust` (code identique aux pièces, non rejoué) ; site réel. Les notes ci-dessous (écrites par l'auteur du zip) restent historiques : « écrit, non exécuté ».
**À décider** : retirer ou non du dossier de suivi les mentions « Premium certifié = RCCM/titre » dans les anciennes sections.

## Accueil : bannière « Devenir annonceur » masquée pour un compte déjà annonceur (20 novembre 2026)
**À réaliser** : un compte déjà annonceur ne voit plus la bannière d'inscription annonceur de la page d'accueil (suite logique de la carte « Devenir annonceur » masquée dans Compte). **Décision du propriétaire : oui.**
**Réalisé (écrit, non exécuté)** : `public/js/pages/home-sections.js` : si l'utilisateur est connecté, `GET /me/advertiser-applications` est appelé en parallèle de `/homepage-settings` ; une demande au statut APPROVED supprime toute la section `#vendre` (titre, « Publier une annonce » et « Devenir annonceur professionnel »). Visiteur non connecté, erreur de l'API ou compte sans demande approuvée : la bannière reste affichée.
**Non exécuté / non vérifié** : rendu navigateur ; liens ou menus pointant vers l'ancre `#vendre` (à rechercher avant fusion) ; site réel.

## Confiance : historique des demandes de pièces avec motif au clic (20 novembre 2026)
**À réaliser** : dans « Confiance & vérifications » du centre de contrôle, lister toutes les demandes de pièces (reçues, acceptées, refusées) ; un clic sur une ligne affiche le détail avec le motif ou le contrôle noté. Aucune migration, aucune règle de droits modifiée.
**Réalisé (écrit, non exécuté)** :
- `server/services/trust.js` : nouvelle méthode `proofHistory` (lecture seule des pièces ACCEPTED/REFUSED : motif, personne qui a décidé, dates ; 100 dernières).
- `server/routes/index.js` : `GET /staff/proofs/history`, protégé par `requireOwnerGate(req, "trust")` comme la consultation d'une pièce.
- Nouveau `public/js/owner/v-proof-history.js` : panneau « Historique des demandes de pièces » (filtres Toutes / Reçues / Acceptées / Refusées, détail au clic). `public/js/owner/v-modules.js` : import et insertion après « Pièces à contrôler ».
**Non exécuté / non vérifié** : `npm test` (aucun test ajouté pour la nouvelle route) ; rendu navigateur ; site réel. À tester : un modérateur voit l'historique ; un administrateur sans délégation « trust » est refusé ; un utilisateur ordinaire est refusé.

## Tableau Standard / Premium certifié : vérification du branchement aux données (20 novembre 2026)
**Méthode** : relecture de `public/js/pages/premium.js`, `public/js/pages/centre.js` et `server/services/advertiser-center.js` (aucune exécution, aucun test, pas d'accès à la base de production).
**Accès** : tout le centre est refusé côté serveur sans Premium en cours ET profil certifié (`overview`, `mapPins`). Cohérent avec « Premium certifié ».
**Branché sur des données réelles** : centre de contrôle (`GET /me/center`) ; courbe vues/contacts 7/14/30/90 jours avec variation vs période précédente ; carte (`GET /me/center/map`, annonces localisées, 100 au plus) ; alertes (signalements ouverts, annonces expirant sous 30 jours, paiement PAID des 7 derniers jours) ; échéances (Premium, mises à la une, expirations) ; messages récents (4) et demandes de visite (3).
**Écarts constatés et décisions du propriétaire (20 novembre 2026)** :
1. Favoris et contacts par annonce : étaient des cumuls ; **décision : période choisie** (comme les vues). Corrigé (écrit, non exécuté) dans `server/services/advertiser-center.js` (requête `overview`, filtre sur `$2` jours).
2. Contacts par annonce : ne comptaient que les clics appel/WhatsApp ; **décision : appels, WhatsApp, messages et visites**, comme le total de la courbe. Corrigé dans la même requête.
3. Compte Standard : possède déjà favoris cumulés, contacts par annonce et 3 messages récents ; **décision : corriger le tableau**. `public/js/pages/premium.js` : colonne Standard « Basique » pour ces deux lignes, avec une note explicative.
4. Variation « +100 % » quand la période précédente vaut 0 : **décision : afficher « Nouveau »**. `pct` (`server/services/advertiser-center.js`) renvoie `null` dans ce cas (champs `viewsChange` et `contactsChange`) et `delta` (`public/js/pages/centre.js`) affiche « ↑ Nouveau ». Changement de contrat de l'API `/me/center` : tout autre consommateur de ces deux champs doit accepter `null`.
5. Non traité : les vues ne comptent que si la collecte d'usage est active (les commits du 20 novembre indiquent qu'elle l'est par défaut : à confirmer sur le site réel).
**Non exécuté / non vérifié** : `npm test` (`test/advertiser-center.test.js` utilise une fausse base qui reconnaît le SQL par expressions régulières : si un test échoue après le changement de requête, adapter l'expression) ; rendu navigateur ; site réel. Les périodes par annonce (`now() - n jours`) et la courbe (jours calendaires) diffèrent de quelques heures.

## Compte : liste des certifications avant « Compléter la certification » et carte « Devenir annonceur » masquée (19 novembre 2026)
**À réaliser** : (1) sur la carte « Mon espace » d'un Premium non certifié, afficher les étapes de certification faites et restantes avant le bouton « Compléter la certification » ; (2) ne plus afficher la carte « Devenir annonceur » à un compte déjà annonceur. Aucune migration, **aucune règle de droits modifiée**.
**Réalisé (écrit, non exécuté)** :
- Nouveau `public/js/components/certification.js` : étapes tirées des données réelles (`/me/listings`, `/me/proofs`, `meta.agencyVerified`, `meta.displayRole`). Une seule voie suffit. Voie 1 « agence vérifiée » : profil d'agence ; RCCM envoyé ; RCCM accepté par l'équipe. Voie 2 « titre foncier » : annonce en ligne ; justificatif envoyé ; titre contrôlé par l'équipe sur une annonce en ligne. Les pièces refusées ou en cours de contrôle sont signalées.
- `public/js/pages/account.js` : la liste s'insère dans `centreCard` (Premium non certifié seulement) ; la carte « Devenir annonceur » est masquée si une demande a le statut APPROVED dans `GET /me/advertiser-applications` (même règle que `assertCanPublishListing`).
**Vérifié** : champs de `/me/proofs` (`kind`, `status`, `note`, `listingId`) relus dans `server/services/trust.js` ; règle APPROVED relue dans `server/services/accounts.js`.
**Non exécuté / non vérifié** : `npm test` ; rendu navigateur en largeur de téléphone ; site réel. À faire avant fusion : 4 cas (Premium non certifié avec et sans RCCM envoyé, compte avec demande APPROVED, compte sans demande).
**Points à signaler** : un particulier approuvé ne voit plus « Devenir agence » ; le bouton « Devenir annonceur » de la page d'accueil est inchangé.
**Risques** : faibles (interface seulement). Retour arrière : `git revert -m 1 <commit de fusion>`.


## Durée de visionnage, Android, onglet Services (20 novembre 2026)
**À réaliser** : (1) mesurer la durée de visionnage d'une annonce ; (2) fenêtre de consentement dans l'application Android ; (3) onglet Services du profil annonceur. Branche `feat/duree-android-services`.
**Réalisé** :
- Durée : événement `listing_dwell` (migration 074 + retour arrière ; liste blanche et contrainte identiques, test). La fiche mesure le temps où l'onglet est visible et l'envoie une fois à la sortie (`POST /listings/:id/dwell`, 2 s à 30 min, limité en débit). Anonyme, sauf accord du compte. Visible dans le centre Utilisateurs : vues et durée moyenne par annonce, durée de consultation du compte.
- **Correction importante** : la migration 021 avait posé `analytics_enabled='false'` en base ; mon changement précédent « actif par défaut » ne suffisait donc pas en production. La migration 074 la passe à `true` (retour arrière : remet `false`).
- Android : la WebView affiche déjà la fenêtre du site pour l'inscription e-mail. Pour Google, le site envoie `terms=1&consent=all|essential` ; `MainActivity.kt` et `NativeGoogleSignIn.kt` transmettent `dataConsent` au serveur. Les anciennes versions de l'application restent compatibles (elles ignorent `consent` → « indispensable »).
- Services : le propriétaire ajoute et retire ses services dans l'onglet Services (état vide guidé, plafond serveur de 20, doublons refusés, mise à jour sans rechargement de la page). Les visiteurs ne voient que la liste.
**Vérifié** : `npm test` ; PostgreSQL 16 réel (migration, enregistrement de 3 durées dont une avec compte, moyenne 34 s affichée) ; navigateur : ajout, retrait, état vide de l'onglet Services.
**Non vérifié** : compilation et exécution de l'application Android (pas de SDK ici) ; mesure réelle sur le site déployé ; téléphone (sendBeacon).
**À faire** : reconstruire et publier l'application Android (versionCode non modifié, décision du propriétaire) ; invitation des comptes existants à choisir leur consentement.
**Risques** : volumétrie des événements `listing_dwell` (un par visite de fiche) : surveiller la taille de `ika_analytics_events`. Retour arrière : `git revert -m 1 <fusion>` puis `scripts/rollback/074_duree_visionnage_down.sql`.

## Collecte d'usage active par défaut + consentement à l'inscription (20 novembre 2026)
**À réaliser** (décision du propriétaire) : collecte active par défaut, réglable par chaque utilisateur dans ses paramètres ; à l'inscription : tout accepter (données liées au compte) ; si refus → demander l'indispensable ; si refus encore → accès bloqué. Branche `feat/consentement-inscription`.
**Réalisé** :
- Interrupteurs inversés : collecte active sauf `ANALYTICS_ENABLED=false` (environnement) ou réglage `analytics_enabled='false'` (base). Ils restent des interrupteurs d'arrêt pour le propriétaire.
- Fenêtre d'inscription en 3 étapes (`public/js/components/data-consent.js`) pour le formulaire e-mail et Google : « Tout accepter » → `dataConsent=all` ; « Refuser » → « Données indispensables » → `essential` ; second refus → « Accès impossible », aucun compte créé. Cases à cocher remplacées.
- Serveur : `register` et `loginWithGoogle` (création) enregistrent le choix dans `ika_analytics_consent` (date et version du texte comme preuve). Seuls les comptes ayant accepté ont leurs événements rattachés ; les autres restent comptés sans identifiant. Le réglage de `Mon profil > Paramètres` permet de changer à tout moment (un retrait détache l'historique).
- Conditions d'utilisation : nouvelle clause « 9 bis. Données nécessaires et données d'usage » ; `LEGAL_VERSION` = `2026-11-20-provisoire`. Fiche d'un compte (centre Utilisateurs) : état et date du consentement affichés.
**Vérifié** : `npm test` ; rendu navigateur (mobile) des 3 étapes ; requêtes envoyées : annulation → rien posté, indispensable → `essential`, tout → `all`.
**Non vérifié** : inscription Google réelle sur le site ; application Android (appel natif sans choix = « indispensable » par prudence, l'application doit afficher la même fenêtre).
**Choix prudents (à confirmer)** : (1) les comptes existants n'ont pas de choix enregistré : leurs données d'usage ne sont PAS rattachées tant qu'ils n'ont pas accepté (le consentement doit être un acte positif) ; (2) le texte juridique reste « provisoire » : relecture par un juriste malien recommandée (loi 2013-015, déclaration APDP) ; (3) refus des seules données d'usage n'empêche jamais l'accès.
**À faire** : durée de visionnage d'une annonce (événement à créer, non collecté aujourd'hui) ; fenêtre équivalente dans l'application Android ; invitation des comptes existants à choisir.
**Risques** : retour arrière `git revert -m 1 <fusion>` (aucune migration).

## Centre « Utilisateurs » : annuaire, agrégats et analyse d'un compte (20 novembre 2026)
**À réaliser** : interface listant tous les comptes (identifiant, dernière connexion), agrégats (actifs, en veille, inactifs, fréquence), filtres (annonceur confirmé ou non, ≥ 1 annonce, plage de dates), centre d'analyse par compte (activité, clics appel/WhatsApp, audits, sanctions à durée déterminée ou à vie). Branche `feat/owner-utilisateurs-19-11`.
**Réalisé** :
- Migration 073 (+ retour arrière) : `ika_login_history`, `ika_profiles.last_login_at / login_count / status_until` ; `last_login_at` rempli depuis les sessions réellement connues, rien d'inventé. Purge à 13 mois (rétention) et effacement avec le compte.
- `accounts.createSession` enregistre chaque connexion (méthode : mot de passe, Google, inscription, application) sans jamais bloquer la connexion.
- Sanctions avec date de fin (`until`, 10 ans max) ; fin automatique à l'échéance (annonces rétablies, trace `SANCTION_EXPIRED`) ; sans date = jusqu'à levée (à vie pour un blocage).
- `server/services/user-center.js` + routes `/staff/owner/users`, `/users/aggregates`, `/users/export.csv`, `/users/:id/analysis` (module délégable `users`, matrice et documents mis à jour).
- Interface `public/js/owner/v-users.js` (menu « Utilisateurs & comptes ») : 12 agrégats, recherche (identifiant, nom, e-mail, téléphone), 10 filtres dont dates, tri, pagination, export CSV ; fiche `#/users/<id>` : connexions 30 j, appels et WhatsApp reçus/passés par annonce, signalements, signaux de risque (règles simples et lisibles), audits, historique de sanctions, bouton sanction/réactivation.
**Vérifié** : `npm test` 354 réussis, 0 échec ; requêtes exécutées sur un vrai PostgreSQL 16 (migration, annuaire, agrégats, analyse, sanction datée, expiration automatique) ; rendu navigateur des deux écrans avec données réelles de test.
**Non vérifié** : clic réel sur le site déployé ; volumes de milliers de comptes (index prévus, non mesurés).
**Non collecté (déclaré à l'écran)** : durée de visionnage d'une annonce et pages vues par compte : la collecte d'usage est désactivée en production (consentement requis, loi malienne 2013-015). Les activer est une décision du propriétaire.
**Risques** : l'historique de connexion démarre à la mise en ligne (avant, seule la dernière connexion connue). Retour arrière : `git revert -m 1 <fusion>` puis `scripts/rollback/073_utilisateurs_centre_down.sql`.
## Premium : décisions du propriétaire appliquées — le numéro confirmé est la certification (20 novembre 2026)
**À réaliser** : réponses du propriétaire aux trois points ouverts : (1) le mode démonstration gère d'abord (SMS pas encore configuré) ; (2) les comptes Premium sans numéro confirmé perdent l'accès mais reçoivent un rappel avec bouton « Vérifier mon numéro » tout en bas de leur centre ; (3) le Premium attend la certification **du numéro**. Branche `feat/premium-numero-certifie`. Aucune migration.
**Réalisé** :
- `premiumAccess` : centre ouvert = Premium en cours ET numéro confirmé. Le badge agence / titre foncier devient **facultatif** (badge de confiance), plus une condition ; l'ancien blocage « profil non certifié » et ses bandeaux sont retirés.
- « Numéro confirmé » = code SMS **ou code de démonstration** tant que le SMS n'est pas configuré (`requireSmsPhone` renommé `requireVerifiedPhone`) : plus de blocage si le SMS est absent ; le badge « Numéro vérifié par SMS » des annonces reste réservé aux vrais SMS.
- Demande et paiement Premium : numéro à confirmer **avant** le formulaire (étape 1 déjà en tête de « Devenir Premium », formulaire SMS intégré) ; refus serveur `PHONE_REQUIRED` sinon.
- Espace standard d'un compte Premium sans numéro confirmé : bandeau en bas « Vérifiez votre numéro pour ouvrir votre Premium » + bouton « Vérifier mon numéro » (et boutons du haut redirigés vers la confirmation).
- Notification d'approbation et file de l'équipe adaptées (pastille « Badge agence / titre » informative).
**Vérifié** : `npm test` : 366 réussis, 0 échec (tests de la règle mis à jour : le badge n'est plus requis, numéro obligatoire).
**Non vérifié** : vrai SMS (fournisseur non configuré : à contrôler avant de retirer le mode démonstration) ; site réel ; rendu du bandeau du bas sur téléphone.
**Risques** : en démonstration, le code s'affiche à l'écran : n'importe qui peut confirmer un numéro qu'il ne possède pas ; la protection réelle exige le SMS. À configurer avant lancement public. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Premium : numéro de téléphone confirmé par SMS obligatoire (20 novembre 2026)
**À réaliser** (demande du propriétaire) : dès le clic sur Premium, exiger d'abord la confirmation du numéro de téléphone ; sans elle, ni demande, ni paiement, ni avantages. But : protéger les utilisateurs et donner confiance aux profils. Branche `feat/premium-telephone-verifie` (une partie du code, `premiumAccess` et `advertiser-center.js`, y avait été commencée sans commit : conservée et complétée).
**Réalisé** :
- Règle serveur : `accounts.requireSmsPhone` (numéro confirmé par un **vrai SMS**, pas le code de démonstration) exigée pour **demander** le Premium (`premium-requests.create`) et pour **payer** une formule Premium (`payments.checkout`) ; refus 403 avec message clair et code `PHONE_REQUIRED`.
- Avantages : `premiumAccess` ne donne le centre de contrôle que si Premium ET profil certifié ET numéro vérifié par SMS ; `phoneVerified` renvoyé à l'interface.
- Interface « Devenir Premium » : bloc « Étape 1 : confirmez votre numéro » avec le formulaire SMS intégré (même composant que la publication) ; demande et paiement remplacés par « bloqués » tant que le numéro n'est pas confirmé, puis débloqués aussitôt ; condition « Numéro confirmé par SMS » ajoutée en tête de la liste. Espace standard : « Confirmer mon numéro » passe avant « Certifier mon profil ».
- Notification d'approbation : dit d'abord que le numéro doit être confirmé si c'est le cas.
**Vérifié** : `npm test` : 366 réussis, 0 échec ; Chromium (API simulée, 390 px) : sans numéro, étape 1 visible et formulaire de demande absent ; après code SMS, le formulaire apparaît, aucune erreur JavaScript.
**Non vérifié** : vrai envoi SMS (nécessite le fournisseur SMS configuré : sans lui, seuls des codes de démonstration existent et **ne suffisent pas**, donc personne ne peut demander le Premium) ; site réel.
**⛔ Points à confirmer** : (1) les comptes déjà Premium sans numéro vérifié par SMS perdent l'accès au centre jusqu'à confirmation (voulu ?) ; (2) la question restante A/B sur la certification (agence/titre foncier) est inchangée.
**Risques** : si le service SMS n'est pas configuré en production, la demande Premium est impossible : à vérifier avant déploiement. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Pièces justificatives : aperçu dans la plateforme et saisie des motifs (19 novembre 2026)
**À réaliser** : « Voir la pièce » doit ouvrir le document en aperçu visuel dans la plateforme, sans téléchargement ni enregistrement ; « Refuser » doit demander un motif ; « Contrôlée : accepter » affichait seulement une erreur rouge sans moyen de saisir. Branche `feat/apercu-pieces`. Aucune migration, aucune règle de droits modifiée.
**Réalisé** :
- Nouvel aperçu `public/js/owner/proof-viewer.js` : fenêtre dans la page, image affichée directement, **PDF dessiné page par page** (pdf.js 3.11.174 hébergé chez nous dans `public/vendor/pdfjs/`, licence Apache-2.0, `script-src 'self'` inchangé). Aucun bouton ni lien de téléchargement, pas de nouvel onglet, clic droit et glisser désactivés, impression masquée. Utilisé aussi pour les pièces des demandes annonceurs.
- Formulaires (`formDialog`, `owner/ui.js`) : les erreurs s'affichent **sous le champ, dans la fenêtre** (champ vide ou texte trop court), avec exemple d'ordre. Accepter exige « Qu'avez-vous contrôlé ? » (3 caractères au moins, exemple donné) ; refuser exige le motif (3 caractères au moins). Cause probable du message rouge : un motif de moins de 3 caractères (ex. « ok ») passait le contrôle du formulaire et était refusé par le serveur sans explication visible.
**Vérifié** : `npm test` : 357 réussis, 0 échec (+3 tests) ; Chromium en largeur de téléphone, avec la même politique de sécurité que le site : aperçu PDF et image affichés, aucun lien de téléchargement, accepter avec « ok » → message sous le champ, accepter avec un vrai motif → requête envoyée, refuser sans motif → bloqué, refuser avec motif → envoyé, aucune erreur JavaScript.
**Limite honnête** : une capture d'écran du téléphone reste possible, aucun navigateur ne peut l'empêcher.
**Non vérifié** : site réel avec une vraie pièce ; téléphone réel (PDF volumineux : rendu page par page, peut être lent).
**Risques** : faibles. Ajout de 1,4 Mo de fichiers (chargés seulement à l'ouverture d'un PDF). Retour arrière : `git revert -m 1 <commit de fusion>`.

## Premium approuvé mais « rien ne change » : cause et explications ajoutées (19 novembre 2026)
**À réaliser** : un profil a reçu le Premium et ne voit aucun avantage ni centre de contrôle ; vérifier la procédure de bout en bout. Branche `fix/premium-sans-certification`. Aucune migration, **aucune règle modifiée**.
**Constat (cause)** : la règle du site (`premiumAccess`, `server/lib/advertiser-ranking.js`) est : centre de contrôle = Premium en cours **ET** profil certifié (agence vérifiée par une pièce RCCM, ou titre foncier contrôlé sur une annonce en ligne). Approuver une demande Premium ne fait que poser la date `premium_until`. Un profil non certifié reste donc sur l'espace « standard », et le seul retour reçu était « Premium activé » : rien n'expliquait la certification manquante. Les avantages annoncés sont tous dans le centre (statistiques, carte, alertes) : sans centre, aucun avantage visible.
**Réalisé** : (1) la notification d'approbation dit si le centre est ouvert (lien « Mon espace ») ou, sinon, la dernière étape à faire (certification) ; (2) la file « Demandes Premium » de l'équipe montre « Profil certifié » ou « Profil non certifié : centre fermé » avant d'approuver ; (3) la page « Devenir Premium » affiche « Dernière étape : faire certifier votre profil » (avec les justificatifs attendus) ou « Votre centre est ouvert » + bouton, et le texte « Tous les avantages sont ouverts » n'apparaît plus tant que le profil n'est pas certifié.
**Vérifié** : `npm test` : 354 réussis, 0 échec (+2 tests sur le message selon la certification). Pas d'essai sur la vraie base ni sur le site réel.
**⛔ Décision du propriétaire attendue** : un profil Premium non certifié doit-il (A) attendre la certification (règle actuelle, conservée) ou (B) ouvrir le centre tout de suite, la certification ne servant qu'au badge ? Rien changé sans réponse.
**Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Photo de profil visible dans la pastille de l'en-tête (19 novembre 2026)
**À réaliser** : si l'utilisateur a une photo de profil, la montrer dans le rond du menu en haut à la place de la première lettre. Branche `feat/avatar-entete`. Aucune migration.
**Réalisé** : `accounts.me()` renvoie `avatarUrl` (photo du profil public ; vide si absente ou masquée par la modération) ; `chrome.js` affiche l'image dans la pastille, la lettre reste en secours ; style `.profile-photo` (rond, image recadrée) ; « Mon profil » rafraîchit la session après chaque action, donc la photo change ou disparaît du rond aussitôt après ajout ou retrait.
**Vérifié** : `npm test` : 352 réussis, 0 échec ; Chromium (API simulée, écran 390 px) : avec photo, une image de 43 px est affichée sans lettre ; sans photo, la lettre « M » s'affiche.
**Non vérifié** : site réel avec une vraie photo ; la requête SQL n'a jamais tourné sur un vrai PostgreSQL (tolérante : en cas d'erreur, la lettre s'affiche). Les pastilles d'autres écrans (Mon espace, Boîte) ne sont pas modifiées.
**Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## DEC-003 tranchée : modules délégables = liste du code (19 novembre 2026)
**À réaliser** : arbitrer entre la liste des modules délégables du code (28) et celle de la matrice proposée.
**Décision du propriétaire** : « A » = on garde la liste du code (`DELEGABLE_MODULES`). Aucun droit modifié.
**Réalisé** : statut de `docs/etape-1/matrice-owner-center.json` mis à jour (la matrice reste un inventaire des routes) ; `test/delegable-modules.test.js` verrouille la liste décidée (28 modules) et l'absence des modules réservés au Superadmin : toute modification future fait échouer le test et demande une nouvelle décision.
**Vérifié** : `npm test` : 352 réussis, 0 échec, 14 ignorés (+2 tests).
**Reste à faire** : les modules de la matrice absents de la liste (newsletters, diffusion, catégories, lieux, zones, langues, redirections, exports) restent donc réservés au Superadmin ; à rouvrir seulement sur demande du propriétaire.
**Risques** : aucun (documentation et test). Retour arrière : `git revert -m 1 <commit de fusion>`.

## Écran « Délégations de modules » dans le Owner Control Center (19 novembre 2026)
**À réaliser** : la délégation de modules (DEC-003) fonctionnait côté serveur mais n'avait aucune interface. Branche `feat/delegations-ui`. Aucune migration, **aucun droit modifié** (la liste des 28 modules délégables du code est inchangée).
**Réalisé** : menu Système & configuration → « Délégations de modules » (réservé au Superadmin, comme les routes `/staff/owner/delegations*` déjà en place). Une fiche par administrateur : 28 modules en 5 groupes (Pilotage, Surveillance, Clients et croissance, Contenu et confiance, Comptes et finances) avec cases à cocher qui délèguent ou retirent aussitôt, compteur par groupe, « Tout déléguer » / « Tout retirer » avec confirmation, rappel des modules jamais délégables. Fichiers : `public/js/owner/v-modules.js`, `main.js`.
**Vérifié** : `npm test` : 342 réussis, 0 échec ; contrôle dans un vrai Chromium avec une API simulée : écran affiché, délégation et retrait envoient les bonnes requêtes, aucune erreur JavaScript, capture relue.
**Non vérifié** : site réel avec vraie base ; téléphone.
**⛔ Décision attendue** : la liste du code (28) et la matrice proposée (`matrice-owner-center.json`) diffèrent : partenaires, imports, doublons, modération, avis, confiance, utilisateurs, paiements sont délégables dans le code seulement ; newsletters, diffusion, catégories, lieux, zones, langues, redirections, exports sont délégables dans la matrice seulement. Rien aligné sans votre choix.
**Limite** : seuls les administrateurs parmi les 100 derniers comptes sont proposés.
**Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## PDF du CRM et de l'audit de modération (19 novembre 2026)
**À réaliser** : les deux derniers exports CSV faits dans le navigateur doivent aussi exister en PDF. Branche `feat/pdf-crm-audit`. Lecture seule, aucune migration.
**Réalisé** : décision technique : PDF généré côté serveur à partir des vraies données (jamais du contenu envoyé par le navigateur), même charte graphique que les autres PDF. `server/lib/table-pdfs.js` ; routes `GET /api/me/crm/leads.pdf` (leads du compte connecté, 500 au plus) et `GET /api/staff/moderation-audit.pdf` (ADMIN minimum, mêmes filtres que l'écran) ; boutons « Exporter PDF » à côté de « Exporter CSV ». Tous les exports de la plateforme existent désormais en CSV et en PDF.
**Vérifié** : tests (2 nouveaux) ; PDF d'essai validés avec `qpdf` et relus en image.
**Non vérifié** : clic réel sur le site déployé (les deux boutons) ; requêtes jamais exécutées sur un vrai PostgreSQL.
**Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## PDF : mise en page professionnelle aux couleurs de la marque (19 novembre 2026)
**À réaliser** : rendre tous les PDF bien structurés, très soignés, avec des couleurs professionnelles. Branche `feat/pdf-design`. Aucune migration, aucune donnée modifiée.
**Réalisé** :
- `server/lib/simple-pdf.js` réécrit : bandeau d'en-tête vert forêt avec filet doré, mention « CONFIDENTIEL », cartes d'indicateurs (couleur selon le niveau), histogrammes (point fort en doré), tableaux à en-tête répété et lignes alternées, encadré de notes, pied de page « Page n / N ». Toujours sans dépendance.
- Les 4 PDF repris : habitudes de connexion (avec graphiques), journal des mouvements (catégories, événements colorés par gravité), rapport des annonces (statuts en français et en couleur), rapport complet de la plateforme (ancien PDF invalide remplacé).
- Libellés des cartes raccourcis, espacement des lettres corrigé (il se propageait aux textes suivants).
**Vérifié** : `npm test` : 340 réussis, 0 échec, 14 ignorés. PDF d'essai validés avec `qpdf --check`, rendus en images et relus à l'œil (pages 1 des quatre documents).
**Non vérifié** : téléchargement réel depuis le site ; ouverture sur téléphone et Adobe ; pages suivantes relues seulement par extraction de texte.
**À faire** : PDF des deux exports faits dans le navigateur (CRM, audit de modération) : génération côté serveur ou navigateur, à décider. Colonne « Type » des annonces à affiner si besoin.
**Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Exports : le PDF s'ajoute au CSV (19 novembre 2026)
**À réaliser** : règle du propriétaire : tout export CSV existe aussi en PDF. Branche `feat/superadmin-connexions-export`. Lecture seule, aucune migration, aucune donnée modifiée.
**Réalisé** :
- `server/lib/simple-pdf.js` (nouveau, sans dépendance) : PDF A4 multi-pages, accents français, tableaux à colonnes réglables, pied de page « page n/N ». Texte seulement (pas d'images ni de graphiques).
- **Habitudes de connexion** : boutons « Exporter CSV » et « Exporter PDF » (`GET /api/staff/owner/activity/connections.csv|pdf`), mêmes chiffres que l'écran, export inscrit au journal d'audit (`OWNER_CONNECTIONS_EXPORT`), limité à 10 exports par heure.
- **Journal des mouvements** : bouton et route `GET /api/staff/owner/activity/export.pdf` (mêmes filtres que le CSV ; les 500 lignes les plus récentes, avec renvoi vers le CSV pour la liste complète ; audit `OWNER_ACTIVITY_EXPORT` « PDF »). Lien « Mouvements PDF » dans la page Rapports.
- **Annonces** : `GET /api/staff/owner/listings.pdf` (500 dernières) + lien « Annonces PDF » dans la page Rapports. Segment `listings.pdf` ajouté à la matrice des droits (délégable, comme `listings.csv`) ; totaux des documents passés à 31 délégables + 12 réservés = 43.
- **Sécurité** : le CSV des annonces neutralise désormais un titre ou un quartier commençant par `=`, `+`, `-` ou `@` (injection de formule dans Excel) ; le contenu ordinaire est inchangé.
- **Vue d'ensemble** : déjà en CSV et en PDF (« Rapport complet PDF »), rien à ajouter.
**Vérifié** : `npm test` : 340 réussis, 0 échec, 14 ignorés (+19 dans `test/owner-connexions-export.test.js`). Les trois PDF d'essai (connexions, journal 620 lignes, annonces) validés avec `qpdf --check` (aucune erreur) et relus avec `pdftotext` (accents, colonnes, pagination, numéros de page).
**Non vérifié** : téléchargement réel depuis le site déployé ; ouverture dans Adobe/Chrome/téléphone ; requêtes SQL toujours jamais exécutées sur un vrai PostgreSQL.
**En cours / à faire** : il reste deux exports faits dans le navigateur, sans PDF : « Exporter CSV » du CRM (`public/js/pages/crm-leads.js`) et de l'audit de modération (`public/js/pages/admin-audit.js`) ; à traiter à part (génération côté serveur ou côté navigateur, à décider). Pas de graphiques dans les PDF.
**Risques** : faibles. Un PDF de 500 lignes pèse quelques dizaines de Ko. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Super Administrateur — « Habitudes de connexion » dans « Mouvements du site » (19 novembre 2026)
**À réaliser** : partie IX de l'ordonnance (§ 14.1 à 14.3) : connexions, comptes actifs et inactifs, tranches horaires, semaine et week-end. Branche `feat/superadmin-connexions`. Lecture seule, aucune migration, aucune donnée modifiée.
**Réalisé** :
- `server/lib/connection-stats.js` (nouveau, fonctions pures) : les 7 tranches horaires de la spécification, heure de pointe, semaine/week-end avec moyenne par jour.
- `server/services/owner-center.js` : `connections()` (Super Administrateur seulement) sur le journal réel `ika_security_log` (connexions réussies) : connexions par jour, comptes connectés 24 h / 7 j / 30 j, comptes sans nouvelle connexion depuis 30 / 60 / 90 jours, comptes sans connexion enregistrée, appareils, début réel de la mesure. Route `GET /api/staff/owner/activity/connections`.
- `public/js/owner/v-activity.js` : panneau sous le résumé de « Mouvements du site » (suit le filtre de période). Journal indisponible = message clair, jamais de chiffre inventé.
**Vérifié** : `npm test` : 321 réussis, 0 échec, 14 ignorés (+9 dans `test/owner-connexions.test.js`, sur fausse base : accès réservé, agrégation, jours à zéro conservés, SQL paramétré, table absente, bornes 1–90 jours). Un test mal écrit a été corrigé (le SQL était bon).
**Non vérifié** : les requêtes SQL n'ont **jamais été exécutées sur un vrai PostgreSQL** (aucune base ici) ; le rendu du panneau dans le navigateur ; à contrôler sur le site après déploiement.
**Limites annoncées dans l'écran** : une « connexion » est une ouverture de session (une session dure 30 jours : un compte peut être actif sans se reconnecter) ; « sans connexion enregistrée » ne veut pas dire « jamais utilisé » (le journal n'existe que depuis « mesuré depuis ») ; heures en UTC = heure du Mali. Pas de durée de session ni de « connexions par utilisateur » : il n'existe pas de fin de session enregistrée, il faudrait des sessions enrichies (Phase 2).
**À faire** : validation par le propriétaire ; durée des sessions et fiche par utilisateur (nécessitent les sessions enrichies) ; export CSV de ces indicateurs (rapports, Phase 5).
**Risques** : faibles (lecture seule, requêtes protégées par `safe()` : une erreur SQL donne « indisponible »). Si le journal grossit beaucoup, ces agrégats lisent `ika_security_log` sur 90 jours au plus. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Confidentialité — lien « Gérer mes choix » sur les pages rendues par le serveur (19 novembre 2026)
**À réaliser** : point resté ouvert du lot A : les pages quartiers, guides, agences et annonces publiques n'avaient pas le lien. Branche `feat/confidentialite-lien-pages-serveur`.
**Réalisé** : lien « Gérer mes choix » dans le pied de page de ces pages (`server/seo/render.js`, vers `/?choix=1`, `rel="nofollow"`) ; `public/js/app.js` ouvre le panneau quand l'adresse contient `?choix=1` puis retire ce paramètre. Aucune migration. Version du service worker re-estampillée.
**Vérifié** : `npm test` : 312 réussis, 0 échec, 14 ignorés (+2 dans `test/confidentialite-lien-pages-serveur.test.js`).
**Non vérifié** : rendu réel sur le site (clic depuis une page quartier, ouverture du panneau, adresse nettoyée) ; à contrôler après déploiement. Les pages `/mentions-legales` et la fiche imprimable n'ont pas été touchées.
**À faire** : validation par le propriétaire. **Risques** : faibles. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Confidentialité, cookies et traceurs — lot C (19 novembre 2026)
**À réaliser** : documenter les cookies, le stockage local et les prestataires. Branche `feat/confidentialite-lot-c`. Documentation seule, aucun code modifié.
**Réalisé** :
- `docs/juridique/registre-cookies-et-prestataires.md` (nouveau) : 2 cookies (`ika_session`, `ika_oauth`), 7 types de stockage local, mesure d'audience, 9 prestataires (Mapbox, Google, WhatsApp, SMS, paiement, e-mail, webhook d'erreurs, Render), points ouverts. Établi par lecture du code.
- `docs/juridique/projet-confidentialite.md` : phrase devenue fausse (« aucune ressource tierce ») corrigée ; section « Cookies et stockage » complétée (choix, Statistiques, Mapbox).
**Vérifié** : `npm test` : 310 réussis, 0 échec, 14 ignorés (inchangé). Contenu relu contre le code (noms, durées et attributs des cookies).
**Non vérifié** : quels prestataires sont réellement activés sur Render (variables non consultables ici) ; le registre le dit et ne l'affirme pas. Texte non relu par un juriste.
**À faire** : validation des lots A, B et C par le propriétaire ; relecture juridique (`LEGAL_VALIDATED` reste `false`) ; lot D (preuve serveur) seulement si exigée.
**Risques** : aucun sur la production (documentation). Retour arrière : `git revert -m 1 <commit de fusion>`.

## Confidentialité, cookies et traceurs — lot B (18 novembre 2026)
**À réaliser** : la mesure de page vue (`POST /api/e`) ne part plus sans l'accord « Statistiques ». Branche `feat/confidentialite-lot-b`.
**Réalisé** :
- `public/js/core/analytics.js` (nouveau) : `trackPageView` n'envoie rien tant que « Statistiques » n'est pas accepté dans ce navigateur ; une erreur d'envoi (synchrone ou réseau) ne casse jamais la page.
- `public/js/app.js` : l'appel direct à `/e` passe par ce filtre. Sans choix, après refus, après retrait ou choix expiré : aucune requête.
- `public/js/core/consent.js` : catégorie « Statistiques » activée dans le panneau « Gérer mes choix » (case cochable), description précisée (aucun identifiant visiteur ni cookie). Aucune migration, aucune donnée modifiée. Version du service worker re-estampillée.
**Vérifié** : `npm test` : 310 réussis, 0 échec, 14 ignorés (304 avant, +6 dans `test/confidentialite-lot-b.test.js`). Un test a révélé puis fait corriger une erreur synchrone non interceptée.
**Non vérifié** : comportement dans un vrai navigateur (case Statistiques, absence de requête `/api/e` sans accord) ; à contrôler sur le site après déploiement.
**En cours / à faire** : validation des lots A et B par le propriétaire sur le site ; lot C (documentation cookies et prestataires) ; lot D (preuve serveur, si exigée).
**Risques** : les événements métier enregistrés côté serveur (vue de fiche, contact, etc.) ne sont pas concernés par ce lot : ils n'utilisent aucun identifiant visiteur ; leur base juridique reste à valider (`LEGAL_VALIDATED=false`). Les chiffres de visites baisseront : seuls les visiteurs consentants sont comptés. Retour arrière : `git revert -m 1 <commit de fusion>`.

## Mon profil : saisie des « Services proposés » par le propriétaire du compte (18 novembre 2026)

- **À réaliser :** permettre au propriétaire du compte d'ajouter lui-même les services affichés dans l'onglet « Services » de son profil public (aujourd'hui « Aucun service listé » sans moyen de les saisir).
- **Réalisé :** carte « Services proposés » dans « Mon profil » (onglet Publications, sous « À propos ») : liste des services, formulaire d'ajout (titre 2–120 caractères, description facultative 500 max) et bouton « Retirer » avec confirmation (`mon-profil.js`). Réutilise les routes existantes `POST /me/services` et `POST /me/services/:id/delete` (limitées au compte connecté, 20 ajouts/heure) ; aucune migration, aucune donnée modifiée. Version du service worker re-estampillée.
- **Vérifié :** syntaxe JS OK ; `npm test` : 304 réussis, 0 échec, 14 ignorés ; `stamp-sw` appliqué.
- **Non vérifié :** rendu et ajout/suppression réels sur le site (pas d'API ni de base dans mon environnement) ; à contrôler après déploiement.
- **À faire :** aucun développement restant pour cette demande.
- **Risques :** faibles (UI seule, routes déjà en production) ; retour arrière : `git revert -m 1 <commit de fusion>`.
## Audit : tous les onglets du centre sont-ils bien sourcés ? (19 novembre 2026)

- **À réaliser :** vérifier que chaque onglet du Owner Center est relié à sa source API et affiche des chiffres justes.
- **Méthode (tout est rejouable) :** (1) cartographie des 50 appels GET des écrans vers les routes et fonctions serveur ; (2) base PostgreSQL locale avec les 84 tables issues de toutes les migrations ; (3) les 610 requêtes SQL statiques du serveur préparées sur ce schéma ; (4) les vraies routes du serveur exécutées sur une base remplie (comptes, annonces, paiements, demandes…) : 48 appels sur 52 réussis, les 4 autres sont des cas attendus (comparaison sans paramètres, réclamation inexistante, deux réglages non encore créés) ; (5) les 25 onglets affichés dans Chromium avec ces vraies réponses ; (6) recherche des champs lus par l'interface et absents des réponses.
- **Résultat :** 25 onglets sur 25 s'affichent sans erreur ; les chiffres contrôlés correspondent aux données de test (publiées, en attente, signalements, pièces, contacts, régions). **Deux champs mal reliés trouvés et corrigés** dans « Annonces & modération » : « Signalements ouverts » et « Nouvelles · 7 jours » restaient vides (l'interface lisait `open_reports` / `new_7d`, le serveur renvoie `openReports` / `newListings7d`). Statuts des visites affichés en français dans « Contacts & visites ».
- **Déjà corrigé plus tôt le même jour :** annonceurs approuvés non comptés (agences) ; Premium accordé à la main non compté (finances).
- **Limites :** base de test et non vos données de production ; un onglet vide en test (réclamations, incidents, droits du personnel) n'a pas pu confirmer ses chiffres ; les 65 requêtes SQL dynamiques ne passent que si leur écran est appelé ; le contrôle d'un chiffre reste manuel (le test automatique `api-links` ne vérifie que l'existence des routes).

## Compteurs du centre : annonceurs approuvés et Premium à la main (19 novembre 2026)

- **À réaliser :** une demande annonceur acceptée disparaissait de la file mais n'était pas comptée dans « Agences & annonceurs » ; vérifier que les écrans sont reliés aux bonnes sources.
- **Cause :** `/staff/owner/agencies` ne listait que les profils avec un nom d'agence ou un badge agence ; l'approbation d'une demande ne modifie que `display_role`, donc un annonceur approuvé (particulier compris) n'apparaissait nulle part.
- **Réalisé :** (1) la liste inclut maintenant les comptes dont la demande annonceur est APPROUVÉE (type, date d'approbation, rôle affiché) ; écran refait : compteurs Annonceurs / Approuvés / Agences vérifiées / Annonces publiées. (2) Même défaut repéré ailleurs : le Premium accordé à la main ne passe pas par `ika_payments` et n'apparaissait pas en finance ; « Paiements & finances » affiche désormais les comptes Premium actifs, les Premium à la main sur 30 jours et la liste des derniers accordés. (3) Garde-fou `test/api-links.test.js` : chaque appel `api("/…")` du front doit correspondre à une route du serveur (305 appels contrôlés, aucun orphelin).
- **Vérifié :** `npm test` 350 OK / 0 échec ; requête de liste testée sur PostgreSQL local (annonceur approuvé listé, demande en attente exclue) ; navigateur (API simulée) : écrans Agences et Paiements sans erreur.
- **Limite :** le garde-fou contrôle l'existence des routes, pas le contenu des réponses ; les autres compteurs n'ont pas été audités un par un. **Non vérifié :** données de production (l'annonceur déjà approuvé apparaîtra après déploiement).

## Demandes : fiche Premium complète + page « Demandes & validations » (19 novembre 2026)

- **À réaliser :** (1) demande Premium plus professionnelle et contrôlable ; (2) vérifier les demandes annonceur : le superadmin doit recevoir toutes les demandes et pouvoir accepter les publications, avec des interfaces professionnelles ; (3) corriger le « Page introuvable » du bouton « Ouvrir » d'une alerte « Demande annonceur ».
- **Cause du « Page introuvable » :** la notification envoyée à l'équipe avait pour lien `/owner` ; la nouvelle Boîte le traitait comme une page interne (`#/owner`). Corrigé : un lien commençant par `/` ouvre la vraie page ; les nouvelles notifications pointent vers `/owner#/requests`.
- **Réalisé :**
  - Migration 072 (+ retour arrière) : demande Premium avec type de compte, téléphone, message, acceptation datée, statut « Retirée ». Formulaire annonceur (champs contrôlés aussi côté serveur), retrait d'une demande en attente, historique des demandes, motif de refus obligatoire et transmis par notification. Panneau « Demandes Premium » de l'équipe : type, téléphone, message, date, motif.
  - Nouvelle page Owner Center « Demandes & validations » (`/staff/requests-hub`, service `requests-hub.js`) : compteurs et demandes les plus anciennes pour les 4 types (annonceur, annonces à valider, mise à la une, Premium), signal « En retard » après 48 h, bouton direct vers l'écran de traitement ; chaque type n'est visible que par l'équipe habilitée (superadmin : tout ; administrateur : modules délégués). Pastille dans le menu.
  - Notifications de l'équipe : nouvelles annonces à valider et nouvelles demandes Premium (les demandes annonceur et mise à la une existaient déjà) ; échec de notification sans effet sur la demande.
- **Vérifié :** `npm test` 311 OK / 0 échec (dont 7 nouveaux tests) ; migration 072, retour arrière et rejeu sur PostgreSQL local ; navigateur (API simulée) : formulaire Premium (envoi, vue « en attente », retrait), page Demandes sur ordinateur et téléphone sombre, sans erreur.
- **Non vérifié :** parcours complet avec de vraies données de production ; réception réelle des notifications par le superadmin après déploiement ; l'acceptation d'une annonce elle-même (écran « Annonces & modération » existant, non modifié).
- **Retour arrière :** `git revert -m 1 <fusion>` puis script `scripts/rollback/072_demandes_premium_details_down.sql` si la migration a été appliquée.

## Mon profil : appel « Passez Premium » sur tous les onglets (18 novembre 2026)

- **À réaliser :** garder l'appel « Passez Premium » en haut de tous les onglets de « Mon profil », pour tous les comptes sauf ceux déjà Premium.
- **Réalisé :** la carte est maintenant affichée par `profilePage` (`mon-profil.js`) entre l'en-tête et les onglets, donc visible sur les 6 onglets ; masquée si `/me/center/access` indique `premium`. Retirée du bloc « Paramètres » (`account.js`, mode intégré) pour éviter le doublon. Marge ajoutée dans `mon-profil.css`.
- **Vérifié :** `npm test` OK ; Chromium (API simulée) : non-Premium = 1 carte sur chacun des 6 onglets, Premium = aucune.
- **À noter :** un compte Premium ne voit plus la carte « Votre Premium est actif » dans son profil (elle reste dans le centre de contrôle). **Non vérifié :** rendu réel après déploiement.

## Boîte : nouvelle interface (18 novembre 2026)

- **À réaliser :** remplacer l'interface Boîte par la maquette fournie (« Boîte — Espace Immobilier »), à l'identique.
- **Réalisé :** nouvelle page `inboxPage` (`public/js/pages/inbox.js`) et feuille `public/css/boite.css` (classes `.bx-*`, rien d'autre touché) : en-tête, recherche, onglets Alertes/Messages/Visites, filtres, cartes d'alertes, messagerie en deux colonnes (liste + fil avec réponse directe), cartes de visites, notifications flottantes, mode sombre. Branchée sur les vraies données (`/me/notifications`, `/me/threads`, `/me/visits`, `/me/team-requests`) ; les anciennes fonctions sont conservées (recherches enregistrées, fréquence des alertes, accepter/refuser une invitation d'équipe, accepter/refuser/annuler une visite ; blocage et signalement via « Options » = page de conversation inchangée). 12 icônes ajoutées à `icons.js`. Feuille ajoutée au cache du service worker (`stamp-sw`).
- **Écarts assumés avec la maquette :** (1) Tailwind, Lucide et Google Fonts viennent de CDN externes, interdits par la CSP du site et par la règle « aucune requête externe » : tout est recréé en CSS local, polices Inter/Plus Jakarta remplacées par la police système si absentes ; (2) les données de la maquette (Ibrahim, Aminata…) sont fictives : le site affiche les vraies ; (3) « Reporter » devient « Refuser / Reporter » (même action serveur : refus avec motif ou autre date) ; (4) téléphone du visiteur, adresse et rappel SMS absents : ces champs n'existent pas dans les données ; (5) pas de « marquer comme non lu » : aucune route serveur.
- **Vérifié :** `npm test` 297 OK / 0 échec ; Chromium avec API simulée : ordinateur, téléphone 390 px, mode sombre, aucun défilement horizontal ; filtres, recherche, lecture, accepter invitation, envoi de message, changement de conversation, réponse à une visite.
- **Non vérifié :** rendu réel avec les données de production et sur téléphone après déploiement.
- **Retour arrière :** `git revert -m 1 <commit de fusion>`.

## Connexion Google dans l'application : l'échec est maintenant expliqué (17 novembre 2026)

- **À réaliser :** le propriétaire, après Google (Chrome), restait dans le navigateur, sur le site connecté à un AUTRE compte.
- **Diagnostic (déduit du code, non reproduit) :** quand l'adresse e-mail du compte Google existe déjà comme compte à mot de passe, `loginWithGoogle` refuse volontairement (409 « compte-existant », protection contre la prise de contrôle d'un compte) ; le callback renvoyait alors vers le site, où Chrome avait déjà une session d'un autre compte. La liaison « Lier Google » ne peut se faire que depuis une session connectée dans le même navigateur (dans l'application, la session est dans la WebView, pas dans Chrome).
- **Réalisé :** pour une connexion lancée depuis l'application, tout échec affiche une page claire (`appFailPage`) avec un bouton « Retourner dans l'application » au lieu de rouvrir le site. Fichiers : `server/lib/google-oauth.js`, `server/routes/index.js`, `test/connexion-google.test.js`. Règle de sécurité inchangée.
- **Vérifié :** `npm test` 262 OK / 0 échec (nouveau test : échec en mode application = page 200 sans redirection ; hors application = comportement inchangé).
- **Non vérifié :** affichage réel sur téléphone après déploiement.
- **À faire (décision du propriétaire) :** permettre de lier Google depuis l'application (ticket de liaison à usage unique) ; non fait car c'est une évolution de parcours.
- **Retour arrière :** `git revert -m 1` du commit de fusion.

## Connexion Google dans l'application : retour vers l'application (17 novembre 2026)

- **À réaliser :** après Google, l'utilisateur restait dans le navigateur au lieu de revenir dans l'application Android.
- **Cause probable :** le serveur renvoyait une redirection 302 vers `ikaso://login?ticket=…` ; les navigateurs Android bloquent souvent l'ouverture d'une application par redirection sans geste de la personne. (Cause déduite du symptôme et du code, non reproduite sur téléphone.)
- **Réalisé :** `/api/auth/google/callback` (cas application) répond maintenant par une page « Connexion réussie » avec un bouton **Ouvrir IKA SÔ** (lien `intent://login?ticket=…#Intent;scheme=ikaso;end`, sans nom de paquet : fonctionne pour la version normale et la version debug), un lien de secours `ikaso://…` et une tentative automatique (meta refresh). Aucun script ni style en ligne (CSP). Fichiers : `server/lib/google-oauth.js` (`appReturnPage`), `server/routes/index.js`, `test/connexion-google.test.js`. Aucun changement dans l'application Android : pas de nouvel APK nécessaire.
- **Vérifié :** `npm test` 261 OK / 0 échec (test mis à jour : page 200, liens intent/ikaso, pas de script/style en ligne, aucune session dans le navigateur) ; rendu de la page à 390 px dans Chromium.
- **Non vérifié :** retour réel dans l'application sur téléphone (à tester après déploiement Render).
- **Risques :** le ticket reste valable 60 s : si la personne tarde à toucher le bouton, elle doit recommencer.
- **Retour arrière :** `git revert -m 1` du commit de fusion.

## Connexion : rangement du bouton et du lien « Mot de passe oublié » ; diagnostic Google dans l'APK (17 novembre 2026)

- **À réaliser :** (1) ranger « Me connecter » et « Mot de passe oublié ? » ; (2) l'APK n'arrive pas à se connecter avec Google (symptôme exact non précisé).
- **Réalisé :** (1) bouton principal pleine largeur, lien centré dessous (`login.js`, `components.css`). (2) Lecture complète du parcours Google de l'application : interception `MainActivity.kt:114-117` → navigateur du téléphone avec `app=1` → callback serveur (`routes/index.js:136-146`) → `ikaso://login?ticket=…` → `onNewIntent` → `/api/auth/app-handoff`. Le code est cohérent ; migration 068 (tickets) présente.
- **Constaté sur l'APK fourni (`public/downloads/ika-so.apk`) :** c'est un build **debug** (`1.0.4-debug`, identifiant `com.ikaso.app.debug`, débogable). Il s'installe À CÔTÉ d'une éventuelle version release (autre identifiant), ne la met pas à jour, et le verrouillage par empreinte y est inactif.
- **Vérifié :** rendu Chromium 390 px clair/sombre ; `npm test` OK ; SW re-estampillé.
- **Non vérifié / non résolu :** cause de l'échec Google dans l'APK (aucun téléphone ici) ; en attente du symptôme précis (message d'erreur, écran affiché).
- **Pistes probables :** application Google non publiée (« En production ») ou compte non ajouté comme testeur ; redirect_uri non identique ; migration 068 non appliquée ; navigateur qui bloque la redirection `ikaso://`.
- **Retour arrière :** `git revert -m 1` du commit de fusion.

## Page de connexion : bouton « Continuer avec Google » (17 novembre 2026)

- **À réaliser :** logo Google et présentation soignée du bloc Google (demande du propriétaire).
- **Réalisé :** logo « G » officiel (SVG fixe, sans ressource externe), séparateur « ou », case des conditions encadrée, bouton pleine largeur avec ombre au survol, atténué tant que les conditions ne sont pas cochées (clic = message d'aide). Fichiers : `public/js/pages/login.js`, `public/css/components.css`. Fonctionnement inchangé (`/api/auth/google?terms=1`).
- **Vérifié :** Chromium 390 px et 1000 px, thèmes clair et sombre (API simulée) ; le bouton s'active après la case ; `npm test` OK ; SW re-estampillé.
- **Non vérifié :** rendu sur vrai téléphone ; parcours Google réel jusqu'au retour dans l'application.
- **Retour arrière :** `git revert -m 1` du commit de fusion.

## Suppression de l'ancien APK en doublon (17 novembre 2026)

- **À réaliser :** supprimer `public/downloads/Ika-So.apk` (ancien, casse différente), à la demande du propriétaire.
- **Réalisé :** fichier supprimé ; seul `public/downloads/ika-so.apk` (nouvel APK) reste, c'est celui du bouton de l'accueil. Aucune référence à l'ancien nom dans le code.
- **Vérifié :** recherche de références à `Ika-So.apk` (aucune) ; `npm test` ci-dessous.
- **Retour arrière :** `git revert -m 1` du commit de fusion (l'ancien fichier reste dans l'historique).

## Téléchargement de l'application Android : nouvel APK en ligne (17 novembre 2026)

- **À réaliser :** mettre le nouvel APK (`Ika_So.apk`, fourni par le propriétaire) à disposition des utilisateurs.
- **Réalisé :** `public/downloads/ika-so.apk` remplacé par le nouvel APK (SHA-256 `0da6cd2f8db2c9e9a30c66f95479f5cda7e64c00a9b4b053ff6200fe16bc585f`, 13 019 931 octets), servi par le bouton « Télécharger IKA SÔ » de l'accueil (`home-sections.js`, lien `/downloads/ika-so.apk`). Correctif `public/sw.js` : `/downloads/` ne passe plus par le cache du service worker (sinon un visiteur déjà venu recevait l'ancien APK).
- **Vérifié :** fichier identique à celui fourni (SHA-256) ; `npm test` 261 OK / 0 échec ; SW re-estampillé.
- **Non vérifié :** téléchargement réel sur le site après déploiement ; installation sur téléphone ; contenu/signature de l'APK (aucun outil d'analyse d'APK ici).
- **Risques :** `Ika-So.apk` (ancien, majuscules) reste dans le même dossier : deux noms ne différant que par la casse posent problème sur Windows/Mac ; non supprimé sans accord. Le serveur garde le fichier en cache 1 h (`maxAge` de `express.static`) : un téléchargement juste après une mise à jour peut servir l'ancien fichier jusqu'à 1 h. Chaque nouvel APK ajoute ~13 Mo à l'historique Git.
- **Retour arrière :** `git revert -m 1` du commit de fusion.
## Confidentialité, cookies et traceurs — lot A (17 novembre 2026)
**À réaliser** : mission 02. Carte Mapbox seulement après accord « Cartes et services externes » ; brouillon lié au compte ; fiche imprimable sans Mapbox par défaut ; panneau « Gérer mes choix ». Branche `feat/confidentialite-lot-a`, aucune modification de Render ni de la production.
**Réalisé** :
- `public/js/core/consent.js` (nouveau) : choix versionné (`ika-so-consent`, version 1, 183 jours), quatre catégories, toutes refusées par défaut. Refus et absence de choix = plan local.
- `public/js/map/provider.js` : sans accord, aucune requête `/api/config/map` et aucune bibliothèque Mapbox. Les appelants (fiche, localisation, centre, carte d'accueil) sont inchangés.
- `server/routes/index.js` + `pages/localisation.js` : fiche imprimable avec fond Mapbox seulement si `?fond=mapbox` (ajouté après accord). Plan SVG local dans tous les cas.
- `public/js/core/draft.js` (nouveau) : brouillon par compte (`ika-so-draft:<id>`). Ancien brouillon sans compte : rangé au compte qui se déconnecte, sinon retiré. Plus aucun brouillon partagé entre comptes.
- `public/js/components/consent-panel.js` (nouveau) + lien « Gérer mes choix » dans le pied de page (`index.html`, `app.js`). Retrait ou acceptation de « Cartes » : rechargement pour appliquer immédiatement.
- Feuille « Suivi confidentialité » ajoutée à `Important/IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx` (10 feuilles existantes vérifiées identiques).
**Vérifié** :
- `npm test` avec PostgreSQL : 296 réussis, 0 échec (275 existants + 21 nouveaux, `test/confidentialite-lot-a.test.js`).
- Navigateur (mobile 390 px, serveur local) : première visite sans choix, aucune requête vers Mapbox ni service externe, aucune erreur JavaScript, panneau lisible et sans débordement, acceptation puis retrait enregistrés.
**En cours** : parcours « acceptation → carte Mapbox » non vérifié en navigateur (pas de jeton local, pas d'annonce géolocalisée en test).
**À faire** : validation du lot A par le propriétaire sur le site ; puis lot B (Statistiques, suppression de `/api/e` quand la collecte est désactivée), lot C (documentation cookies et prestataires), lot D (preuve serveur, si exigée).
**Risques** : stockage local du choix = pas une preuve juridique ; politique de confidentialité non validée par un juriste (`LEGAL_VALIDATED=false`) ; `MAPBOX_TOKEN` sur Render non vérifié ; les pages rendues côté serveur (quartiers, guides) n'ont pas encore le lien « Gérer mes choix ».
**Correctifs de la vérification finale (17 novembre 2026, 2e passage)** :
- Contournement corrigé : `?fond=mapbox` n'a plus aucun effet côté serveur (la route ne lit plus le paramètre et n'envoie plus de jeton). La fiche charge le fond seulement si le consentement est enregistré dans le navigateur (`public/js/fiche.js`, emplacement `#fond-auto`).
- Tests : 298 réussis avec PostgreSQL (275 existants + 23 nouveaux).
- Navigateur (serveur local, jeton factice, requêtes Mapbox interceptées) : fiche sans accord (0 requête), fiche avec accord (1 requête), retrait (0 requête) ; carte : première visite (0), acceptation (chargement de la bibliothèque), retrait puis navigation (0).
- Brouillons : deux comptes dans le même navigateur, 12 vérifications conformes.
- Non réalisé : rendu réel de Mapbox (aucun jeton local, réseau vers Mapbox bloqué), annonces géolocalisées (aucune donnée de test). Le jeton `/api/config/map` reste visible par conception (jeton public) : restriction à restreindre côté compte Mapbox.
**Mission 04 — validation finale (17 novembre 2026, 3e passage)** :
- Brouillons : l'ancien brouillon sans compte n'est plus supprimé ni attribué automatiquement. Il est proposé à l'utilisateur connecté : récupération (sans écrasement) ou suppression après confirmation. Tests : 24 nouveaux tests du lot A ; navigateur : deux comptes, visiteur anonyme, récupération et suppression conformes.
- Non-régression (navigateur, données réelles de la base de test) : publication complète par le formulaire, localisation par contour, fiche imprimable propriétaire, centre, carte avec repère, favoris, mes annonces, connexion et déconnexion, mobile 390 px. Aucune erreur JavaScript.
- Mapbox réel : non réalisé, aucun jeton de test disponible et api.mapbox.com injoignable. Aucune requête Mapbox avant, pendant ou après consentement dans les parcours simulés.
- Tests : 299 réussis avec PostgreSQL.
- Anomalies restantes : fiche d'une annonce à simple point sans plan ni lien d'impression (existant) ; jeton public visible dans /api/config/map (conception, à restreindre côté Mapbox).
**Rollback** : lot non commité. Après commit : `git revert <sha>` (commit simple) ou `git revert -m 1 <sha>` (commit de fusion), puis `npm run -s stamp-sw`.

## Demande de mise à la une (17 novembre 2026)
**À réaliser** : remplacer le lien vers Réclamations par une demande gratuite envoyée directement à l'équipe, et une interface « Demande de mise à la une » pour les administrateurs (superadmin inclus). Aucun paiement ni tarif lié.
**Réalisé** :
- Migration `070_demandes_mise_a_la_une.sql` (renumérotée : `069` est déjà prise par les réclamations sur `main`) + rollback `070_..._down.sql`. Table `ika_featured_requests`, une seule demande en attente par annonce.
- Service `server/services/featured-requests.js` : création (annonce en ligne possédée, sans demande en attente), liste staff (permission `moderation.review`), décision. Acceptation = mise à la une via l'existant (`moderation.setFeatured`, contrôle de permission conservé) ; refus = motif obligatoire ; verrou de statut contre le double clic.
- Routes `/api/me/featured-requests` (GET, POST) et `/api/staff/featured-requests` (GET, `?status=DONE`), `/api/staff/featured-requests/:id/decision`.
- Notifications : staff (ADMIN, SUPERADMIN, MODERATOR) à la création ; annonceur à la décision.
- Côté annonceur (« Mes annonces ») : bouton « Demander la mise à la une » ouvrant un formulaire (message facultatif, 500 caractères) ; « en attente » après envoi ; aucun bouton si l'annonce est déjà à la une. Le bouton de paiement reste masqué sans tarif.
- Côté admin (`admin.html`, onglet « Demande de mise à la une (n) ») : demandes en attente, « Mettre à la une » (ADMIN et SUPERADMIN), « Refuser » avec motif, traitées récentes.
**Vérifié** : `npm test` 275 tests, 261 pass, 0 échec (sans PostgreSQL de test), dont 4 tests de validation du service. Test réel sur PostgreSQL 16 locale, serveur lancé : création (201), doublon (409), annonce non possédée (404), staff (200), utilisateur simple (403), refus sans motif (400), refus avec motif (200), acceptation (200, annonce à la une 7 jours via le mécanisme existant), notifications staff et annonceur présentes, aucune erreur serveur. Navigateur : bouton, formulaire et état « en attente » côté annonceur ; onglet et liste côté admin, sans erreur JavaScript ni API.
**En cours** : aucun.
**À faire** : contrôle sur le site après déploiement : envoi depuis un téléphone, traitement depuis l'espace admin.
**Risques** : la migration 069 existe dans deux dépôts (réclamations sur `main`, demandes ici) ; seule la 070 est propre à cette tâche. Une annonce à la une n'est pas bloquée côté service si une demande est acceptée à nouveau : la mise à la une est simplement prolongée, comme aujourd'hui. Le libellé « Demande de mise à la une » est à valider.

## Mise à la une : message clair quand aucune formule n'est ouverte (16 novembre 2026)
**À réaliser** : au lieu d'un espace vide, afficher un message clair et un lien de contact direct.
**Cause** : le bouton « Mettre à la une » de « Mes annonces » n'est affiché que si une formule payante est active et que le fournisseur de paiement est configuré. Aucune formule n'a de prix (décision du propriétaire), donc rien n'apparaissait.
**Réalisé** : sur une annonce en ligne sans formule disponible, « Mise à la une : » suivi du bouton « Contactez directement IKA SÔ » (lien vers `#/reclamations`). Aucun tarif fixé, aucune règle de gestion modifiée.
**Vérifié** : `npm test` (271 au total, 257 pass, 0 échec). Test sur serveur et PostgreSQL locaux, annonce simulée en ligne : le lien apparaît, le bouton de paiement est absent, aucune erreur JavaScript ; le clic ouvre la page des réclamations. Rendu mobile contrôlé.
**En cours** : aucun.
**À faire** : décision du propriétaire sur le contenu : la page « Réclamations » est un formulaire (motif et détails), pas une messagerie. Une messagerie directe avec IKA SÔ demande une décision de votre part.
**Risques** : le libellé « Mise à la une : » peut être perçu comme un bouton ; à valider après déploiement.

## Application Android : ajout de photos impossible (16 novembre 2026)
**À réaliser** : permettre d'ajouter des photos d'annonce depuis le téléphone (application Android).
**Cause** : à l'ouverture de la galerie ou de l'appareil photo, `onStop` note l'heure. Au retour, `onStart` recharge l'accueil si l'application est restée plus de 30 s en arrière-plan (règle de mémoire de session), ce qui efface la photo choisie. Au-delà de 60 s, le verrouillage biométrique pouvait aussi se déclencher.
**Réalisé** : `MainActivity.kt` : drapeau `pickerOpen` posé à l'ouverture du sélecteur de fichiers, consommé au retour ; le retour du sélecteur ne recharge plus l'accueil et ne verrouille plus l'application. Version `1.0.4` (versionCode 5) dans `build.gradle.kts`.
**Vérifié** : sur le site (Chromium en émulation mobile, serveur et PostgreSQL locaux) : ajout d'une photo JPEG de 22 Mo puis d'un PNG, compteur « Photos (n/5) » mis à jour, aucune erreur JavaScript ni API. Le bogue est situé côté application, pas côté site.
**En cours** : compilation de l'APK non vérifiée (pas de SDK Android dans l'environnement). Kotlin relu manuellement uniquement.
**À faire** : compiler la version 1.0.4 dans Android Studio, la tester sur téléphone (ajout depuis galerie et appareil photo, après plus de 30 secondes), puis remplacer `public/downloads/Ika-So.apk`.
**Risques** : le même correctif concerne aussi les pièces justificatives (même sélecteur). Le téléphone doit avoir la version 1.0.4 pour que le correctif s'applique.
## Boutons « Retour » retirés du site public : retour du téléphone uniquement (16 novembre 2026)
**À réaliser** : sur demande du propriétaire (capture de la page annonceur : bouton « ← Retour » flottant + lien « ← Retour aux annonceurs »), retirer les boutons Retour ; la navigation arrière se limite au retour du téléphone / du navigateur.
**Réalisé**
- ✅ Barre « Retour » globale supprimée : `#backbar` (`index.html`), `renderBackbar`, pile de navigation `trackNav` / `goBack` / `parentOf` (`chrome.js`, `app.js`). Elle s'affichait sous l'en-tête de toutes les pages sauf l'accueil.
- ✅ Liens « Retour » de pure navigation retirés : « Retour aux annonceurs » (`advertiser.js`), « Retour au catalogue » (`listing.js`, `trust.js`), « Retour à mes annonces » (`localisation.js`), « Retour à mon profil » (`profile-edit.js`), « Retour » du fil de conversation (`inbox.js`), « ← Liste » du détail d'un bien (`compte-unifie.js`).
- ✅ `public/sw.js` : version du cache recalculée (`ika-so-ed276cd8eb`).
- ✅ Test `test/no-back-buttons.test.js` (3 tests) : tout nouveau « Retour » hors liste d'exceptions justifiées fait échouer les tests.
**Volontairement conservés** (pas de la navigation arrière, ou aucune autre sortie) : « Retour à l'accueil » des pages d'erreur / introuvable (`app.js`) et « Retour au profil / à mon profil » / « Retour » des écrans d'erreur (`centre.js`, `complaints.js`, `compte-unifie.js`) ; « Retour » de la facture ouverte (`payments.js`, réaffiche la liste sans changer d'adresse : le retour du téléphone quitterait la page) ; « ← Retour à la connexion » (`password-reset.js`, page ouverte depuis un lien d'e-mail, sans historique). **Hors périmètre, non modifiés** : console d'administration (`admin.js`) et centre de contrôle (`owner/`, dont le bouton « Retour au site » ajouté ce matin à votre demande).
**Vérifié**
- ✅ `npm test` : 271 tests, 257 réussis, 0 échec, 14 ignorés (PostgreSQL absent : non exécutés). Le nouveau test échoue bien si un bouton ou `#backbar` est réintroduit.
- ✅ Navigateur (Chromium), 10 routes × 2 tailles (ordinateur 1114 px, téléphone 360 px) : aucune erreur JavaScript, aucun `#backbar`, aucun bouton « Retour » visible hors écrans d'erreur ; en-tête intact ; rendu de la page Confiance contrôlé visuellement.
- ✅ Retour du téléphone : l'application Android appelle `canGoBack()` → `goBack()` (`MainActivity.kt`), et les écrans de détail (`#/boite/…`, `#/profil?tab=biens&id=…`) changent bien d'adresse.
**Non vérifié / risques**
- ⬜ Les pages avec données (annonceur, annonce, messagerie, localisation, profil public) n'ont pas pu être affichées (pas d'API dans mon environnement) : retrait contrôlé par la syntaxe, le diff et le test, pas à l'écran. À regarder sur le site après déploiement.
- ⚠️ Une page ouverte directement par un lien n'a plus de repli « page parent » : le retour du téléphone sort de l'application (l'Android demande un second appui pour quitter). L'en-tête et la barre du bas restent disponibles.
- ⬜ Les règles CSS `.backbar` / `.pa-back` sont devenues inutilisées et laissées en place (inoffensives).
- ⬜ Étendre aussi à la console d'administration et au centre de contrôle : décision du propriétaire.

## Correctifs mobile n°2 : réclamations, thème sombre, menus, profil à photos cliquables (17 novembre 2026)

- **À réaliser :** 5 remarques du propriétaire (captures téléphone).
- **Réalisé :** (1) **Réclamation « Envoyer »** : cause = `ika_reports.listing_id` était `not null` alors que le formulaire n'envoie pas d'annonce → erreur serveur. Migration **069** (`drop not null`, additive) + script de retour arrière (refuse s'il existe des réclamations sans annonce). Champs du formulaire mis en forme (`label.field`, `input` typé). (2) Espace annonceur : bouton ☰ plus flottant sur le contenu (inséré dans la page, libellé « Menu ») ; bloc « Découvrir Premium » lisible en mode nuit (`espace.css`). (3) Centre de contrôle (admin) : onglets en bande défilante dans la page, plus de liste flottante (`components.css`, `admin.js`). (4) « Espace de visibilité » conforme au mode nuit (`refonte.css`). (5) Mon profil : photo de profil et couverture cliquables, petit menu « Changer / Retirer / Annuler », boutons supprimés, pastille 📷 (`mon-profil.js`, `mon-profil.css`).
- **Vérifié :** `npm test` 257 OK / 0 échec. PostgreSQL local : migrations 001→069 appliquées, insertion d'une réclamation sans annonce OK, rollback 069 refusé s'il y a une telle ligne puis accepté, migration rejouée. Chromium 390 px : formulaire réclamation envoie `{reason, details}` et affiche « Réclamation envoyée » (API simulée) ; onglets admin en ligne ; bandeau/teaser en mode nuit lisibles. SW re-estampillé.
- **Non vérifié :** rendu sur vrai téléphone ; menu des photos du profil (non rendu faute de données API simulables) ; réclamation sur la vraie base Neon (la migration 069 s'applique au démarrage de Render).
- **Risques :** la migration 069 doit s'exécuter au déploiement ; si la réclamation échoue encore, vérifier les journaux Render.
- **Retour arrière :** `git revert -m 1` du commit de fusion (+ script 069 si la colonne doit redevenir obligatoire).

## Correctifs mobile : profil annonceur, Centre de contrôle, menu, fiche annonce, photos (16 novembre 2026)

- **À réaliser :** 5 remarques du propriétaire (captures téléphone).
- **Réalisé :** (1) profil annonceur : sur ≤800 px le contenu de l'onglet passe avant la colonne « Présentation » (`profil.css`). (2) Centre de contrôle : barre du haut sur une seule ligne, tiroir fermé sans ombre ni zone cliquable (`owner.css`). (3) menu du site : bouton « Se déconnecter » (visible si connecté) (`chrome.js`). (4) fiche annonce : bouton « Voir le profil de l'annonceur » supprimé, la carte Annonceur garde « Voir le profil » (même route ; repli si l'API échoue) (`listing.js`). (5) photos : fichier du stockage accepté même sans type MIME (d'après l'extension), décodage de repli via `<img>`, message si fichier non image (`listing-form.js`, `dom.js`).
- **Vérifié :** `npm test` 257 OK / 0 échec ; Chromium 390 px : tiroir Owner s'ouvre/se ferme, bouton déconnexion présent dans le menu, en-tête Owner alignée. SW re-estampillé.
- **Non vérifié :** rendu sur vrai téléphone ; import photo réel depuis le stockage Android (WebView) ; profil annonceur avec données réelles.
- **Risques :** si l'import de photos échoue encore sur l'appli Android, la cause serait dans l'APK (`MainActivity.kt`, sélecteur déjà présent) : un nouvel APK devra être compilé hors de cet environnement.
- **Retour arrière :** `git revert -m 1` du commit de fusion.

## Mon profil : doublons d'identité supprimés (16 novembre 2026)
**À réaliser** : signalement de deux blocs « profil » dans l'interface Mon profil.
**Cause** : « Mon profil » affiche l'identité dans son en-tête, puis réintégrait le module de réglages du compte, qui répétait la carte « Identité », le rôle et le lien « Mon profil public ».
**Réalisé** : `accountSettings(refresh, { embedded: true })` (`account.js`) n'affiche plus, dans « Mon profil », la carte Identité, la rangée de rôles ni le lien « Mon profil public ». Les autres réglages (statut, Premium, préférences, accès) sont conservés. Service worker restamped.
**Vérifié** : `npm test` (268 tests, 254 pass, 0 fail, sans PostgreSQL de test). Test réel sur PostgreSQL 16 locale, serveur lancé, onglet Paramètres : identité, « Mon profil public » et rôle n'apparaissent plus en double ; à 390 px comme à 1280 px ; aucune erreur JavaScript ni API.
**En cours** : aucun.
**À faire** : contrôle sur téléphone après déploiement.
**Risques** : les liens de l'espace (Owner Control Center, Centre Premium, Partenaires) restent dans le module de réglages.

## Centre de contrôle : retour au site et photo du compte (16 novembre 2026)
**À réaliser** : (1) un bouton pour revenir sur le site ; (2) la photo de profil du Owner Control Center liée à celle du compte.
**Réalisé** : bouton « Retour au site » (lien vers `/`) dans la barre du haut, texte masqué sur petit écran. Photo : le centre de contrôle lit la photo du profil public (`/api/me/public-profile`, champ `profile.avatarUrl`, même source que « Mon profil ») et l'affiche dans la barre latérale et en haut ; sans photo, les initiales restent. Styles dans `owner.css`, service worker restamped.
**Vérifié** : `npm test` (268 tests, 254 pass, 0 fail, sans PostgreSQL de test). Test réel sur PostgreSQL 16 locale et serveur lancé : photo téléversée sur le compte, affichée aux deux emplacements dans le centre de contrôle ; bouton retour ramène sur `/` ; pas de débordement horizontal (1280 px et 390 px) ; aucune erreur JavaScript ni API.
**En cours** : aucun.
**À faire** : contrôle visuel par le propriétaire après déploiement.
**Risques** : aucun connu. Le centre de contrôle ne montre la photo qu'après téléversement sur « Mon profil public ».

## Régression corrigée : routes de session et de mot de passe supprimées (16 novembre 2026)
**À réaliser** : vérifier que le Centre de contrôle (`/owner`) fonctionne réellement.
**Constat** : le commit `dfeaf61` (« deux méthodes de connexion », fusionné par `340da2c`) avait supprimé 7 routes de `server/routes/index.js` sans rapport avec la tâche : `GET /api/me` (session), `POST /api/auth/logout`, `POST /api/auth/forgot`, `POST /api/auth/reset`, `POST /api/me/otp`, `POST /api/me/otp/verify`, `POST /api/staff/accounts/:id/reset-link`. Conséquences en production si ce commit y est déployé : session non restaurée à chaque chargement, déconnexion, mot de passe oublié et vérification SMS inopérants. Les tests ne l'ont pas vu.
**Réalisé** : routes restaurées à l'identique (bloc placé après la connexion Google, avant la route de retrait du lien Google). Le reste du commit (Google) est conservé. Nouveau test `test/routes-essentielles.test.js` : 15 contrôles de présence des routes essentielles (échoue sur l'ancienne version : 8 échecs).
**Vérifié** : `npm test` 268 tests, 254 pass, 0 fail (sans PostgreSQL de test). Test sur une vraie base PostgreSQL 16 locale (migrations 1 à 68 appliquées) avec le serveur lancé en mode développement : `/api/me` (sans et avec session), déconnexion, connexion, demande de réinitialisation, réinitialisation (jeton invalide refusé), toutes les routes `/api/staff/owner/*` (tableau de bord, vue d'ensemble, journal, résumé, catalogue, sécurité, traçage, export CSV) : 200 avec données réelles ; accès refusé (403) à un compte non superadmin, 401 sans session.
**Centre de contrôle `/owner`** : page ouverte, les 23 modules du menu ouverts un par un dans le navigateur : aucune erreur JavaScript, aucune erreur API.
**En cours** : aucun.
**À faire** : déploiement Render puis contrôle du site par le propriétaire (connexion, déconnexion, mot de passe oublié, `/owner`).
**Risques** : polices `/fonts/PlusJakartaSans-Variable.woff2` et `Outfit-Variable.woff2` absentes du dépôt (404 dans le navigateur ; le dossier ne contient que `LISEZMOI.txt`). Non traité : décision de l'hébergement des polices.

## Mot de passe : bouton afficher / masquer (16 novembre 2026)
**À réaliser** : permettre de voir ou masquer le mot de passe pendant la saisie.
**Réalisé** : composant `passwordField()` (`public/js/components/ui.js`) ajoutant un bouton « Afficher » / « Masquer » (bascule `type` password ↔ text, `aria-pressed`, `aria-label`). Appliqué à : connexion / inscription (`login.js`), nouveau mot de passe et confirmation (`password-reset.js`), suppression de compte (`account.js`). Style `.pw-toggle` dans `components.css`. Service worker restamped.
**Vérifié** : `npm test` 253 tests, 239 pass, 0 fail (sans PostgreSQL de test). Contrôle Playwright sur la page de connexion : type passe de `password` à `text` puis revient, valeur conservée, `aria-pressed` mis à jour, aucune erreur JS.
**En cours** : aucun.
**À faire** : vérification visuelle par le propriétaire sur le site après déploiement.
**Risques** : aucun connu (ajout purement visuel, aucune donnée ni route modifiée).

## Correctif — en-tête mobile désaligné : bouton « Publier » réapparu (15 novembre 2026)
**À réaliser** : sur téléphone, les éléments de l'en-tête n'étaient plus alignés (logo seul sur une ligne, boutons Publier / thème / Connexion / menu décalés en dessous).
**Cause** : depuis la fusion du 14/11, `components.css` (chargé en dernier) déclare `.btn { display: inline-flex }`. Cette règle a la même priorité que `.header-publish { display: none }` (`modern.css` ≤ 560 px, `refonte.css` ≤ 520 px) mais passe après : le bouton « Publier » (masqué sur mobile, où la barre du bas a déjà « Publier ») s'affichait. Les 4 boutons (333 px) ne tenaient plus à côté du logo dans 328 px disponibles : passage à la ligne, et à 320 px débordement horizontal de la page. Avant la fusion (`9aca944`), « Publier » était masqué et tout tenait sur une ligne.
**Réalisé**
- ✅ `modern.css` et `refonte.css` : sélecteur renforcé `.site-header .header-publish` (priorité supérieure à `.btn`). Comportement d'avant la fusion rétabli à toutes les largeurs ; « Publier » reste visible à partir de 561 px.
- ✅ `public/sw.js` : version du cache recalculée (`ika-so-c21a1bb343`), sinon les téléphones gardent l'ancien CSS.
- ✅ Test `test/css-btn-priorite.test.js` (2 tests) : aucune feuille ne doit masquer un bouton avec une simple classe, sinon `.btn` de `components.css` l'emporte.
**Vérifié** (navigateur Chromium, rendu réel du site, API absente)
- ✅ Mesure à 11 largeurs (320, 360, 390, 412, 480, 520, 540, 600, 768, 1024, 1280 px) : avant correctif 320–412 px = 2 rangées (écart vertical 56 px), en-tête 96 px, débordement à 320 px ; après correctif = 1 rangée (écart 0 px), en-tête 64 px, aucun débordement, à toutes les largeurs. Capture avant/après comparée visuellement.
- ✅ Audit : seul `.header-publish` était concerné ; l'attribut `hidden` reste respecté (`[hidden]{display:none !important}` dans `ika.css`), donc les boutons « Voir plus » ne sont pas touchés.
- ✅ `npm test` : 215 tests, 204 réussis, 0 échec, 11 ignorés (PostgreSQL absent : non exécutés). Le nouveau test échoue bien sur l'ancien CSS.
**Non vérifié / à faire**
- ⬜ Rendu sur votre téléphone après déploiement (recharger la page deux fois pour renouveler le cache du service worker).
- ⬜ Le rendu a été testé avec le navigateur du serveur de test, sans connexion à l'API : le bouton « Connexion » est celui d'un visiteur déconnecté. Un compte connecté (avatar au lieu de « Connexion ») n'a pas été testé.
- ⬜ Application Android : son code (dossier `Android/`) charge le site en ligne (`https://ika-so.onrender.com/`), elle doit donc recevoir le correctif dès le déploiement, sans nouvelle version de l'APK. Non vérifié sur un appareil.

## BUG-002 — retours arrière des migrations 017 à 065, testés sur un vrai PostgreSQL (15 novembre 2026)
**À réaliser** : le registre des anomalies signalait 40 migrations sans script de retour arrière (BUG-002).
**Réalisé** (branche `fix/bug-002-retours-arriere`)
- ✅ 30 scripts créés dans `scripts/rollback/` : 017–019, 029–038, 041, 046–049, 052–057, 059–064. Format identique aux scripts existants : avertissement en tête sur ce qui est supprimé, transaction (tout ou rien), suppression de la ligne dans `_migrations`, jamais de `cascade`.
- ✅ **Défaut existant corrigé** : 9 anciens scripts (028, 039, 042, 043, 044, 045, 050, 051, 058) laissaient leur ligne dans `_migrations` : `npm run migrate` aurait cru la migration toujours appliquée et ne l'aurait pas rejouée. Une ligne `delete from _migrations…` ajoutée à chacun, rien d'autre modifié.
- ✅ Point d'attention traité : les colonnes `price_xof` et `active` de `ika_offers` existaient déjà (migration 008) ; le retour arrière de 032 ne les supprime donc pas.
- ✅ Mode d'emploi : `scripts/rollback/LISEZ-MOI.md` (sauvegarde, ordre du plus récent au plus ancien, scripts qui refusent volontairement).
- ✅ Test automatique `test/rollback-scripts.test.js` (5 tests) : toute nouvelle migration à partir de 017 doit avoir son script.
**Vérifié** (PostgreSQL 16 local, instantané schéma + données après chaque migration)
- ✅ Migrations 001→065 appliquées, puis les 49 retours arrière de 065 à 017 exécutés : après **chacun**, base identique à l'instantané précédent (49/49), aucune ligne `_migrations` résiduelle. Comparateur contrôlé (il détecte bien une différence).
- ✅ Rejeu des migrations 017→065 après le retour complet : état final identique (seuls les horodatages des lignes d'amorçage diffèrent, normalisés).
- ✅ Protection : 038 (signalement RESOLVED), 046 (campagne SIDEBAR) et 052 (annonce « Bureau ») **échouent comme annoncé, base inchangée, ligne `_migrations` conservée**.
- ✅ `npm test` : 213 tests, 202 réussis, 0 échec, 11 ignorés (PostgreSQL absent dans le test automatique : non exécutés). Le test du dépôt est statique ; la preuve sur base réelle est celle ci-dessus, faite hors dépôt.
- ✅ Essais de régression du test statique : script absent, ligne `_migrations` retirée, nouvelle migration sans script → détectés.
**Limites / risques**
- ⚠️ **Non testé sur la base Neon réelle** ni avec ses données de production : un retour arrière supprime des données (avis, consentements, journaux…). Toujours créer une branche Neon avant.
- ⚠️ Volontairement **sans script** : 001–015 (socle) et 016 (factures et suppressions de compte, données comptables et légales) : seule la restauration d'une sauvegarde est sûre.
- ⚠️ Les scripts 039–045, 050, 051, 058 n'ont toujours pas de transaction (non réécrits) ; testés et fonctionnels, mais pas « tout ou rien ».
- ⬜ Le registre Excel n'est pas modifié : BUG-002 y reste « Ouverte » (à passer en « Résolue » après votre validation). Les retours arrière 059 à 064 existent aussi en un seul fichier : `docs/FUSION/ANNULATION_MIGRATIONS_059_064.sql`.

## Correctif — « null » affiché sur la carte annonceur d'une annonce (16 novembre 2026)
**À réaliser** : la carte « Annonceur » de la fiche annonce ne doit plus afficher « null ».
**Cause** : `replaceChildren(...)` écrit le texte « null » pour une valeur `null` (au contraire de `h()`, qui l'ignore). La carte passait `null` quand il n'y avait pas de badge ni de détail de confiance.
**Réalisé** : `public/js/pages/listing.js` (carte annonceur) filtre les éléments absents ; même défaut corrigé dans `public/js/owner/v-activity.js` (« Charger plus » du journal d'activité du Centre propriétaire). Autres appels `replaceChildren` vérifiés : passent `null` seulement en attributs (sans effet).
**Vérifié** : navigateur (Chromium, fiche annonce simulée) : avant « nullVoir le profil », après « Voir le profil » seul ; aucune erreur JavaScript ; `npm test` sans régression.
**Non vérifié** : Centre propriétaire (« Charger plus ») dans un navigateur avec session propriétaire. Site Render : non vérifié.

## Connexion Google depuis l'application Android (16 novembre 2026)
**À réaliser** : permettre la connexion Google dans l'application (Google refuse la connexion dans une WebView).
**Réalisé** (branche `feat/app-connexion-google`)
- ✅ Serveur : migration `068_tickets_connexion_application.sql` (table `ika_login_tickets`, haché, 60 s, usage unique) + retour arrière. Démarrage avec `app=1` : le retour Google ne crée **aucune session dans le navigateur** et renvoie `ikaso://login?ticket=…` ; `GET /api/auth/app-handoff?ticket=…` pose la session dans la WebView. Compte bloqué refusé à l'échange.
- ✅ Application Android **1.0.3** (`versionCode` 4) : le bouton Google ouvre le navigateur du téléphone (navigateur par défaut, choisi hors de l'application pour éviter une boucle) ; le lien `ikaso://login` (filtre d'intention dans le manifeste) ouvre l'échange du ticket dans la WebView ; README mis à jour.
**Vérifié**
- ✅ `npm test` : 253 réussis sur 253 avec PostgreSQL (tests de routes avec faux Google, tests de base réelle : usage unique, expiration, compte bloqué, aucune session créée).
- ✅ 5 casses volontaires sur les tickets (usage unique, expiration, compte bloqué, session créée à tort, démarrage sans marqueur) → toutes détectées.
- ⬜ **Non compilé ni testé sur téléphone** : pas de SDK Android ici. Les modifications Kotlin ont été relues (types, appels), mais la compilation et le parcours complet (navigateur → retour → application connectée) restent à faire sur votre appareil.
**Limites et risques**
- ⬜ Liaison Google depuis « Mon profil » **dans l'application** : non prise en charge (le retour passerait par le navigateur, qui n'a pas la session). Elle reste possible depuis le navigateur du téléphone.
- ⚠️ Un lien `ikaso://` peut, en théorie, être intercepté par une autre application installée qui déclare le même schéma : le ticket (60 s, usage unique) serait alors exposé. Le correctif propre : des liens App Links vérifiés (`/.well-known/assetlinks.json` avec l'empreinte SHA-256 de votre clé de signature) — à faire quand vous aurez la clé.
- ⬜ Le retour Google depuis le navigateur exige que le site soit bien à la même adresse que dans la configuration Google (`PUBLIC_URL`).
**Ce que vous devez faire** : compiler l'APK 1.0.3 (Build ▸ Build APK), tester la connexion Google sur téléphone, puis m'envoyer l'APK signé pour remplacer `public/downloads/ika-so.apk`.

## Deux méthodes de connexion par compte : mot de passe et Google (16 novembre 2026)
**Décisions du propriétaire** : (1) la connexion reste e-mail + mot de passe, Google en plus ; le code SMS (OTP) reste réservé à la vérification du téléphone avant publication (aucune connexion par téléphone créée) ; (2) un compte à mot de passe se relie à Google **depuis « Mon profil », après connexion par mot de passe** (pas de liaison automatique) ; (3) la différence entre les méthodes se voit **dans « Mon profil »**.
**Réalisé** (branche `feat/connexion-google-methodes`)
- ✅ Migration `067_methodes_de_connexion.sql` (`has_password`, additive) + retour arrière `scripts/rollback/067_methodes_de_connexion_down.sql`. Les comptes créés par Google n'ont pas de mot de passe connu (`has_password = false`) et ne peuvent pas se connecter par mot de passe ; « Mot de passe oublié » leur en définit un.
- ✅ Un même compte peut avoir les deux méthodes. Liaison Google depuis le profil : compte connecté + même adresse e-mail + identifiant Google non déjà utilisé ailleurs. Retrait : refusé si le compte n'a pas de mot de passe (sinon l'utilisateur serait enfermé).
- ✅ Connexion Google d'un compte déjà lié : même compte (identifiant Google). Compte à mot de passe non lié : refus avec consigne de se connecter par mot de passe puis de lier depuis « Mon profil ».
- ✅ `GET /api/me` renvoie `authMethods { password, google }` ; `GET /api/auth/google?link=1` (session requise), `DELETE /api/me/google`.
- ✅ « Mon profil » → onglet Paramètres → « Méthodes de connexion » : mot de passe (activé / non défini), Google (lié / non lié), boutons Lier / Retirer (Retirer grisé sans mot de passe), messages de retour.
**Vérifié**
- ✅ `npm test` : 251 réussis sur 251 avec PostgreSQL réel (migrations 066 et 067 appliquées) ; 238 sans base.
- ✅ Base réelle : compte mot de passe, compte Google seul, les deux ; connexion par mot de passe refusée au compte Google seul ; liaison refusée si adresse différente (400) ou identifiant déjà pris (409) ; retrait refusé sans mot de passe ; réinitialisation donne un mot de passe au compte Google ; audit `GOOGLE_LINK`.
- ✅ Routes (faux Google) : liaison sans session refusée, liaison réussie, erreurs renvoyées au profil, retrait.
- ✅ Casses volontaires détectées : refus de retrait sans mot de passe, refus d'adresse différente, contrôle de session pour la liaison, retrait sans lien.
- ✅ Navigateur (session simulée, deux types de compte) : section affichée, boutons corrects, « Retirer » grisé sans mot de passe, aucune erreur JavaScript.
**Non vérifié / limites**
- ⬜ Le vrai échange avec Google (identifiants non posés ici). Le retour de liaison dépend du cookie de session : à tester après configuration.
- ⬜ Application Android : la connexion et la liaison Google sont impossibles dans la WebView (voir section précédente) — pas de changement côté APK.
- Deux gardes sont redondantes (défense en profondeur) : le contrôle `has_password` à la connexion par mot de passe et le contrôle `req.user` de la liaison ; leur suppression ne change aucun résultat testé.
**À faire** : Render : rien de plus que la configuration Google déjà décrite (la migration 067 s'applique seule).
**Risques** : un compte Google seul qui oublie son mot de passe doit passer par « Mot de passe oublié » (e-mail ou SMS).

## Connexion avec Google (16 novembre 2026)
**À réaliser** : permettre de se connecter (ou de créer son compte) avec Google, sur le site, sans changer la connexion par mot de passe.
**Réalisé** (branche `feat/connexion-google`)
- ✅ Flux « code d'autorisation » côté serveur (`server/lib/google-oauth.js`) : le secret ne va jamais au navigateur ; état aléatoire vérifié à temps constant, cookie d'état de 10 min limité à `/api/auth/google`, jeton Google jeté après lecture du profil, e-mail Google exigé « confirmé ».
- ✅ Routes : `GET /api/auth/google` (exige l'acceptation des conditions), `GET /api/auth/google/callback`, `GET /api/config/auth` (indique seulement si Google est activé). Bouton « Continuer avec Google » sur la page de connexion (`public/js/pages/login.js`), messages d'erreur lisibles.
- ✅ Règles de compte (`accounts.loginWithGoogle`) : liaison **par identifiant Google seulement** ; un compte créé avec un mot de passe et la même adresse **n'est pas relié automatiquement** (refus « connectez-vous avec votre mot de passe ») ; nouveau compte = conditions obligatoires ; compte bloqué refusé ; le compte Google reçoit un mot de passe aléatoire inconnu de tous.
- ✅ Migration `066_connexion_google.sql` (colonne `google_sub`, additive) + retour arrière `scripts/rollback/066_connexion_google_down.sql`.
- ✅ Configuration : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (et `PUBLIC_URL` en https). Sans ces trois valeurs, le bouton n'apparaît pas.
**Vérifié**
- ✅ `npm test` : 246 tests, 246 réussis avec PostgreSQL réel (migration 066 appliquée) ; 234 réussis sans base.
- ✅ Tests de routes (faux Google, aucun appel réseau) : refus sans acceptation, état faux ou absent, refus de Google, succès (session posée, cookie d'état effacé, retour à la page demandée), codes d'erreur ; 7 casses volontaires sur le cœur de la sécurité détectées (vérification d'état, échange du code, e-mail confirmé, page d'arrivée sûre, acceptation des conditions).
- ✅ Test de base réelle : création, reconnexion, refus de liaison à un compte à mot de passe, conditions, compte bloqué ; casses détectées sur les conditions et le blocage.
- ✅ Navigateur : bouton présent, aucune navigation sans case cochée, navigation vers `/api/auth/google?terms=1` une fois cochée, mise en page correcte à 400 px, aucune erreur JavaScript.
- ⬜ **Non vérifié : le vrai échange avec Google** (pas d'identifiants ici). Un point : la vérification d'e-mail est aussi couverte par la contrainte d'unicité de la base ; la casse correspondante n'a pas été détectée par les tests, le comportement reste correct.
**Non fait / décisions**
- ⛔ **Application Android** : Google refuse la connexion dans une WebView (erreur 403 « disallowed_useragent »). La règle actuelle ouvre `accounts.google.com` dans le navigateur externe, où le retour ne retrouvera pas le cookie d'état : la connexion Google échouera dans l'APK (« La connexion Google a expiré »). Il faut une évolution Android (onglet personnalisé Chrome + retour par lien de l'application). Non fait.
- ⛔ Comptes existants avec la même adresse : pas de liaison automatique (choix de sécurité). Si vous voulez la liaison, il faut d'abord une vérification de l'adresse de ces comptes : votre décision.
**Ce que vous devez faire**
1. Google Cloud Console → Identifiants → « ID client OAuth » type **Application Web**. Adresse de redirection autorisée : `https://ika-so.onrender.com/api/auth/google/callback`. Écran de consentement : nom « IKA SÔ », e-mail d'assistance, domaine `ika-so.onrender.com`, portées `openid`, `email`, `profile` (non sensibles : pas de vérification Google nécessaire).
2. Render → service → Environment : ajoutez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (secret : ne le mettez pas dans le dépôt). Vérifiez `PUBLIC_URL=https://ika-so.onrender.com`.
3. Redéployez : la migration 066 s'applique seule. Testez sur le navigateur d'un ordinateur puis d'un téléphone.
**Risques** : tant que les trois variables ne sont pas posées, rien ne change pour les utilisateurs. Le bouton ne s'affiche qu'une fois la configuration complète.

## Correctif définitif — « tour en bas » à l'actualisation + mémoire de 30 secondes (15 novembre 2026)
**À réaliser** : à l'actualisation (tirer pour actualiser) l'écran ne doit plus passer par le bas ; après plus de 30 s hors du site, retour direct à l'accueil.
**Cause réelle** (capture du propriétaire) : à chaque rechargement, le pied de page (statique dans `index.html`) s'affichait immédiatement sous une zone vide, avant que la page ne soit construite ; la page grandissait ensuite et se recalait en haut. Le correctif précédent (remontée du défilement) ne traitait pas ce point.
**Réalisé** : site — `<body class="page-loading">` dès le départ, retiré en fin de rendu ; pendant le chargement le pied de page est masqué (`visibility:hidden`) et la zone `#app` occupe l'écran (`refonte.css`) ; mémoire de 30 s (`visibilitychange` : > 30 s absent → accueil, sinon reprise) ; tampon sw `ika-so-8e5f2d9ddf`. Application Android **1.0.2** (`versionCode` 3) — `onPageCommitVisible` remonte en haut ; retour au premier plan après > 30 s ou restauration d'état après > 30 s → accueil (sauf lien reçu : paiement, partage) ; < 30 s → reprise.
**Vérifié** : navigateur réel (Chromium, serveur statique + API simulée lente) : pendant le chargement `page-loading` actif et pied de page masqué, après chargement visible et défilement 0 ; absence simulée de 31 s depuis `#/annonces` → `#/`, absence courte → page conservée ; tests du dépôt. **Non vérifié** : Android (pas de SDK, pas de téléphone) — l'APK doit être recompilé (v1.0.2) ; le site doit être redéployé.
**Risques** : un écran de chargement vide (≈ un écran) est visible sans pied de page pendant le chargement ; le verrouillage biométrique garde son délai de 1 min.

## Application Android — code source ajouté au dépôt, version 1.0.1 (15 novembre 2026)
**À réaliser** : versionner le projet Android Studio fourni par le propriétaire (`IkaSo-Android_V0.zip`) et y corriger l'écran d'accueil qui s'ouvrait en bas.
**Réalisé** : projet copié tel quel dans `Android/IkaSo-Android/` (WebView Kotlin, `com.ikaso.app`, 1.0.0 → **1.0.1**, `versionCode` 2). Seul changement : `MainActivity.kt`, `onPageStarted` remonte la WebView en haut (`v.scrollTo(0, 0)`). Complète le correctif du site (commit `c976c5c`). Le Dockerfile ne copie que `server`, `migrations` et `public` : ce dossier n'a aucun effet sur le déploiement Render.
**Vérifié** : copie complète (30 fichiers), différence limitée aux 2 fichiers ci-dessus. **Non vérifié** : compilation (pas de SDK Android ici), test sur téléphone.
**À faire (propriétaire)** : compiler dans Android Studio (Build ▸ Build APK), signer avec votre keystore, tester, puis remplacer `public/downloads/ika-so.apk` (13 Mo, origine encore non documentée) ; je ne l'ai pas modifié.
**Risques** : l'APK actuellement téléchargeable sur le site reste l'ancienne version tant qu'il n'est pas remplacé.

## Correctif — l'accueil s'ouvrait en bas puis remontait (application Android) (15 novembre 2026)
**À réaliser** : à l'ouverture de l'application, l'écran d'accueil doit apparaître directement en haut.
**Cause** : `render()` (`public/js/app.js`) ne remontait la page (`scrollTo(0,0)`) qu'à la toute fin du rendu, après le chargement de la page ; entre-temps le navigateur de l'application pouvait garder ou restaurer une ancienne position de défilement, d'où l'écran en bas puis la remontée.
**Réalisé** : `history.scrollRestoration = "manual"` (plus de restauration automatique) et `scrollTo(0,0)` dès l'affichage du squelette de chargement, en plus de celui de fin de rendu. Tampon du service worker mis à jour (`ika-so-880f68b99c`) pour que les appareils reçoivent la correction.
**Vérifié** : tests 197 réussis, 0 échec (11 PostgreSQL ignorés) ; `stamp-sw:check` à jour. **Non vérifié** : sur un téléphone Android réel (l'APK n'est pas dans le dépôt). À contrôler par le propriétaire après déploiement ; si le défaut persiste, il vient de l'enveloppe APK elle-même.
**Risques** : le bouton « retour » ne restaure plus la position de défilement d'une page précédente (retour en haut).

## BUG-003 (lot 4) — tests de `aggregation.js` (agrégation journalière) et `fiche.js` (fiche de parcelle) (16 novembre 2026)
**À réaliser** : couvrir par des tests les deux modules purs suivants de `server/lib/`.
**Réalisé** : `test/aggregation-fiche.test.js` (9 tests, sans base) : dates au format AAAA-MM-JJ, plages par défaut et explicites, jour en cours refusé, plage maximale, requêtes d'agrégation sans identité de personne et robots exclus, recalcul d'un jour (idempotent, contrôle consigné), écart signalé, verrou déjà pris ; fiche : titre saisi échappé (pas d'injection HTML), un seul script (`fiche.js`), noindex, superficie au format français, plan SVG, fond Mapbox seulement avec jeton. Aucun code de production modifié.
**Vérifié** : 9 réussis ; 5 casses volontaires → 4 détectées (plage du jour en cours, contrôle de cohérence, exclusion des robots, échappement du titre). La 5e (constante d'échelle de l'aperçu du plan SVG) n'est pas détectée : ce dessin ne sert qu'à l'aperçu et n'affiche aucune mesure, donc ce n'est pas un défaut de test.
**À faire** : `receipt-email.js`, `notifier.js`, `file-storage.js`, `geo.js` (lib), puis les services qui touchent la base (à tester sur PostgreSQL). BUG-003 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-003 (lot 3) — tests de `csv.js` (import d'annonces) et `logger.js` (journaux) (16 novembre 2026)
**À réaliser** : poursuivre la couverture des modules sans test, en commençant par les modules purs.
**Réalisé** : `test/csv-logger.test.js` (8 tests, sans base) : lecture CSV (séparateurs, guillemets, retours à la ligne, BOM), aller-retour sur le modèle officiel `csvTemplate()` (doit passer toutes les règles), colonnes obligatoires et colonne inconnue, limite de 200 lignes, valeurs inconnues signalées par ligne, journaux (niveaux, champs sensibles `ip`/`cookie`/`password`/`email`/`token` retirés, seules les erreurs vont vers les services de suivi, panne d'un service sans effet), middleware de requête (identifiant, en-tête, niveau selon le statut, aucun paramètre de requête journalisé). Aucun code de production modifié.
**Vérifié** : 8 réussis ; 4 casses volontaires (plafond de lignes, contrôle du type, liste des champs sensibles réduite, envoi des avertissements vers le suivi) → chacune détectée ; fichiers restaurés (aucune différence avec `main`). `npm test` : 223 tests, 212 réussis, 0 échec, 11 ignorés (PostgreSQL absent).
**À faire** : `legal.js` (constantes, pas de logique), `receipt-email.js`, `csv`/`geo`/`fiche`/`aggregation`/`notifier`/`file-storage` (lib), puis services `seo`, `cards`, `rights`, `analytics`, `homepage-settings`, `imports`, `properties`, `crm`, `geo`, `engagement`, `moderation`, `listings` : ceux qui touchent la base sont à tester sur PostgreSQL. BUG-003 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-003 (lot 2) — tests des services `duplicates` et `moderation-audit` (15 novembre 2026)
**À réaliser** : poursuivre la couverture de tests des services du serveur.
**Réalisé** : `test/duplicates-moderation-audit.test.js` (5 tests, base simulée, sans PostgreSQL) : doublons (prix invalide sans requête, fourchette ±5 %, exclusion, propriétaire, filtre final par surface, titre identique du même annonceur) et journal de modération (refus sans acteur/action/type, sérialisation des détails, filtres, bornes limit 1–200 et offset ≥ 0). Aucun code de production modifié.
**Vérifié** : 3 casses volontaires (fourchette de prix, plafond de limite, contrôle des champs obligatoires) → chacune détectée ; fichiers restaurés. Limite : le SQL lui-même (`ika_norm`, filtres) n'est pas exécuté ici ; il le sera avec PostgreSQL.
**À faire** : autres services (engagement, moderation, crm, seo, analytics, cards, imports, properties, geo…), de préférence sur PostgreSQL réel. BUG-003 reste « Ouverte ».

## BUG-004 (lot 6) — attribution des permissions : service, routes, écran Superadmin (15 novembre 2026)
**À réaliser** : permettre au Superadmin d'accorder et de retirer des permissions individuelles (suite logique des décisions du lot 4 : sans cela, `offres.tarifs` ne pouvait être accordé à personne).
**Réalisé** (branche `feat/bug-004-lot-6`)
- ✅ **Service** `server/services/permission-grants.js` : `list`, `grant`, `revoke`, réservés à `permissions.grant` (Superadmin). Applique `assertCanGrant` (jamais à soi-même, jamais une permission non délégable, cible modérateur ou administrateur seulement, motif obligatoire), refuse une permission que le rôle donne déjà, durée facultative de 1 à 365 jours (vide = sans échéance), renouvellement = remplacement de l'échéance, **tout octroi et tout retrait écrits dans `ika_audit`** (`PERMISSION_GRANT` / `PERMISSION_REVOKE`, dans la même transaction que l'action).
- ✅ **Routes** : `GET /staff/permissions`, `POST /staff/permissions/grant`, `POST /staff/permissions/revoke` (contrôle dans le service, reconnu par le test des routes `/staff/*`).
- ✅ `assertCanGrant` : ses refus portent maintenant un vrai code HTTP (403 pour les refus de droit, 400 pour les demandes invalides) au lieu d'erreurs sans statut qui auraient donné une erreur 500. Messages inchangés.
- ✅ **Session** : `accounts.me()` renvoie `permissions` (permissions effectives : rôle + attributions non expirées ; vide pour un compte ordinaire ou non actif). Sert uniquement à l'interface ; le serveur contrôle chaque action.
- ✅ **Interface** : nouvel écran « Permissions du personnel » dans le Owner Control Center (`/owner`, menu Système & configuration) : attributions en cours, accorder (personne, permission, motif obligatoire, durée), retirer avec confirmation. Les boutons de prix de l'onglet Paiements (`public/js/admin.js`) s'affichent maintenant selon la **permission réelle** `offres.tarifs` (limite signalée au lot 5 : levée).
**Vérifié**
- ✅ `npm test` avec PostgreSQL : **203 tests, 203 réussis, 0 échec, 0 ignoré**. Nouveau fichier `test/permission-grants.test.js` (6 tests sur la vraie base) : droits (administrateur, modérateur, compte ordinaire refusés), octroi puis retrait avec effet immédiat sur `requirePermission` et sur la session, 12 refus ou erreurs de saisie, durée de 1 jour puis renouvellement, journal d'audit, permissions de session par rôle. 5 casses volontaires (règles d'octroi retirées, octroi non tracé, doublon avec le rôle accepté, échéance non remplacée, retrait sans contrôle de droit) → chacune détectée ; fichiers restaurés.
- ✅ **Contrôle dans un vrai navigateur (Chromium, serveur réel + PostgreSQL, vraies sessions Superadmin / administrateur / modérateur)** : écran vide au départ, entrée de menu, octroi de `offres.tarifs` avec 30 jours (échéance vérifiée à 30,00 j en base), liste et motif affichés, l'administrateur voit alors les boutons de prix, le retrait via l'écran les lui fait perdre, le modérateur et l'administrateur reçoivent 403 sur `GET /staff/permissions`, aucune erreur JavaScript. 13 contrôles sur 13. Captures relues : un défaut de mise en page trouvé (date collée à « par … ») et corrigé. Ce contrôle est un script hors dépôt (Chromium absent de la CI) ; `stamp-sw:check` : à jour.
- ⬜ Site Render : non vérifié (pas d'accès). **Non vérifié** : écran sur téléphone (seule la disposition ordinateur 1360 px a été vue).
**Limites connues**
- La liste des personnes proposées vient de `/staff/accounts` (100 derniers comptes) : un administrateur ancien peut ne pas y figurer. À améliorer avec une recherche par nom.
- Deux mécanismes voisins coexistent : délégations de modules de l'Owner Center (`ika_owner_delegations`, DEC-003) et permissions nommées (`ika_user_permissions`). Aucun n'a été remplacé ; à unifier plus tard sur décision du propriétaire.
**À faire** : migration 065 appliquée automatiquement au déploiement (voir lot 5) ; appels Superadmin restants (`places`, `owner-center`, `owner-delegations`, `advertiser-center`, `setStaffRole`, 2 appels de `routes/index.js`) ; tests des services (BUG-003) maintenant exécutables sur PostgreSQL. BUG-004 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-004 (lot 5) — migration 065, premiers tests sur un vrai PostgreSQL, boutons de prix (15 novembre 2026)
**À réaliser** : lever les prérequis laissés ouverts par le lot 4 (codes absents de la base) et traiter la conséquence visible du changement de droits sur les prix.
**Réalisé** (branche `feat/bug-004-lot-5`)
- ✅ **Migration 065** `migrations/065_permissions_contenu_offres_owner.sql` : ajoute `contenu.gerer`, `offres.tarifs`, `owner.stats` à `ika_permissions` et leurs droits par rôle à `ika_role_permissions`. Additive (aucune table ni colonne modifiée, aucune donnée touchée), relançable (`on conflict do nothing`). Retour arrière : `scripts/rollback/065_permissions_contenu_offres_owner_down.sql`. **Elle s'appliquera automatiquement au prochain démarrage du serveur sur Render** (`server/index.js` : `await migrate(db)`).
- ✅ **Premier environnement PostgreSQL réel dans l'atelier** (PostgreSQL 16 jetable, base `ika_test`) : les 3 tests d'intégration existants, jusque-là ignorés, **passent** (64 migrations appliquées, 2e exécution sans effet, serveur HTTP réel). Nouveau fichier `test/permissions-db.test.js` (3 tests, ignorés sans `DATABASE_URL_TEST`, exécutés par la CI) : concordance stricte base ↔ `server/lib/permissions.js` (codes, non délégables, droits de chaque rôle) ; `requirePermission` avec de vraies lignes (accordée, expirée, dans le futur, compte ordinaire, déclencheur SQL qui refuse `owner.stats` et `permissions.grant`) ; migration 065 rejouée sans effet, retour arrière puis réapplication restaurent exactement l'état.
- ✅ `public/js/admin.js` : les boutons « Fixer le prix » et « Activer / Désactiver » d'une offre ne sont proposés qu'au Superadmin ; les administrateurs voient « Seul le Superadmin modifie les prix, sauf permission accordée à un administrateur ». Le serveur reste le vrai contrôle.
**Vérifié**
- ✅ `npm test` avec PostgreSQL : **197 tests, 197 réussis, 0 ignoré**. Sans PostgreSQL : 197 tests, 191 réussis, 0 échec, 6 ignorés. Casses volontaires contre la vraie base (`owner.stats` délégable dans le code, `contenu.gerer` retiré des droits ADMIN, filtre d'expiration retiré, migration sans `on conflict`) → chacune détectée ; fichiers restaurés. `stamp-sw:check` : à jour (inchangé).
- ⬜ Modification de `admin.js` : syntaxe vérifiée (`node --check`), **rendu non vérifié dans un navigateur** (pas de session administrateur ici). Site Render : non vérifié.
**Limite** : un administrateur à qui `offres.tarifs` serait accordé plus tard ne verrait pas les boutons (l'interface ne connaît que le rôle, pas les permissions individuelles) : à traiter avec l'écran d'attribution (exposer les permissions de la session).
**Comment lancer les tests PostgreSQL dans l'atelier** (utile aux prochains agents) : `initdb` et `pg_ctl` de `/usr/lib/postgresql/16/bin` en tant qu'utilisateur `postgres`, données dans `/var/tmp/` (le dossier de session n'est pas lisible par `postgres`), `-p 54329`, `createdb ika_test`, `npm install --no-save --no-package-lock pg`, puis `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:54329/ika_test npm test`. Rien n'est écrit dans le dépôt.
**Impact sur les lots suivants de BUG-003** : les tests des services qui touchent la base (modération, engagement, CRM…) peuvent désormais être écrits et exécutés pour de vrai.
**À faire** : écran d'attribution des permissions (`assertCanGrant` + écriture dans `ika_user_permissions` + exposition des permissions dans la session) ; appels Superadmin restants (DEC-003).

## BUG-004 (lot 4) — décisions du propriétaire : `contenu.gerer`, `offres.tarifs`, `owner.stats` (15 novembre 2026)
**À réaliser** : appliquer les décisions du propriétaire du 15 novembre (réponses aux questions posées après le lot 3).
**Décisions reçues** : (1) une seule permission `contenu.gerer` pour partenaires, page d'accueil et mise en avant ; (2) nouvelle permission `offres.tarifs` pour modifier le prix d'une offre : Superadmin par défaut, accordable à un administrateur précis ; (3) permission `owner.stats` pour les 56 statistiques Superadmin ; (4) pas de scission de `moderation.review` pour l'instant.
**Réalisé** (branche `feat/bug-004-lot-4`, 3 permissions, 65 appels)
- ✅ `server/lib/permissions.js` : `contenu.gerer` (niveau ADMIN, comme avant), `offres.tarifs` (SUPERADMIN, délégable), `owner.stats` (SUPERADMIN, **non délégable** au début).
- ✅ `partners.js` (6), `homepage-settings.js` (2), `moderation.setFeatured` (1) → `contenu.gerer` ; `stats.js` (56) → `owner.stats` ; `payments.setOffer` (1) → `offres.tarifs`. Les 3 autres actions de paiement restent `payments.manage`. Droits identiques à avant **sauf `setOffer`** (voir ci-dessous).
- ✅ Fausse couche `accounts` de `test/partners.test.js` : `requirePermission` ajouté (5 tests échouaient sinon).
**⚠️ Changement de droits (décidé)** : un administrateur ne peut plus modifier le prix d'une offre (403 « Réservé aux administrateurs. »). Il ne pourra le faire que lorsqu'un Superadmin lui accordera `offres.tarifs` — **or l'écran d'attribution n'existe pas encore** : en attendant, seul le Superadmin modifie les prix. **Constaté dans le code** : `public/js/admin.js` (lignes 452-459) affiche encore les boutons de prix aux administrateurs ; un clic renverra le message de refus du serveur. Aucune modification de l'interface faite (à décider : masquer ces boutons pour les administrateurs). À contrôler sur le site après déploiement.
**Vérifié**
- ✅ `npm test` : 194 tests, 191 réussis, 0 échec, 3 ignorés (PostgreSQL absent). Tests ajoutés : `offres.tarifs` (Superadmin, administrateur refusé, administrateur avec permission accordée, autres paiements inchangés), `owner.stats` (même avec une permission accordée, un administrateur reste refusé), chaque action de paiement demande la bonne permission. Casses volontaires : `owner.stats` rendu délégable → échec ; `setOffer` redescendu à `payments.manage` → échec ; garde retirée de `partners.create` → le test des routes `/staff/*` échoue ; fichiers restaurés.
- ⬜ Site Render : non vérifié (pas d'accès).
**⚠️ Prérequis avant tout octroi individuel (levé ensuite par la migration 065, voir lot 5)** : les 3 nouveaux codes n'étaient **pas en base**. `ika_user_permissions` a une clé étrangère vers `ika_permissions` (migration 025) et un déclencheur sur la colonne « délégable » : il faudra une migration additive (`ika_permissions`, `ika_role_permissions`, avec `on conflict do nothing`), à tester sur PostgreSQL, avec l'écran d'attribution. Volontairement non livrée maintenant : elle ne peut pas être testée ici et une migration en échec au démarrage ferait tomber le site. Le code actuel n'en a pas besoin (aucune permission individuelle n'existe).
**Restent sur l'ancien contrôle par rang (décision non prise ou à examiner)** : SUPERADMIN : `places.js`, `owner-center.js`, `owner-delegations.js`, `advertiser-center.js`, `moderation.setStaffRole`, 2 appels de `routes/index.js` ; `geo.js` et 3 appels de `routes/index.js` à examiner (niveau non lu). Lien avec DEC-003 (Owner Center). BUG-004 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-004 (lot 3) — modération, avis, signalements et candidatures branchés sur les permissions nommées (15 novembre 2026)
**À réaliser** : poursuivre la migration progressive de `requireStaff` vers `requirePermission`, droits inchangés.
**Réalisé** (branche `feat/bug-004-lot-3`, 15 appels, 5 fichiers de service)
- ✅ → `moderation.review` (niveau MODERATOR, comme avant) : `moderation.js` (file d'attente, décision, rejet d'un signalement, masquage d'un commentaire, liste des comptes), `reviews.js` (signalements ouverts, masquer, rejeter), `engagement.js` (signalements d'utilisateurs, 2), `advertiser-profile.js` (masquage des images), `advertiser-applications.js` (lecture d'une pièce, liste équipe, décision).
- ✅ → `moderation.restrict` (MODERATOR) : première garde de `setAccountStatus` (les contrôles ADMIN/SUPERADMIN qui suivent, par rôle de l'acteur, restent inchangés).
**Vérifié**
- ✅ `npm test` : 191 tests, 188 réussis, 0 échec, 3 ignorés (PostgreSQL absent). Test d'équivalence avec `requireStaff` étendu (4 rôles × 3 statuts, y compris l'appel sans niveau = MODERATOR). Casses volontaires : code de permission mal écrit → échec ; garde retirée de `hideComment` → le test des routes `/staff/*` échoue ; fichiers restaurés.
- ✅ La fausse couche `accounts` de `test/advertiser-applications.test.js` (qui n'avait que `requireStaff`) a reçu un `requirePermission` identique : 7 tests de ce fichier échouaient sinon. Aucun autre test touché.
- ⬜ Site Render : non vérifié (pas d'accès).
**Volontairement non migrés** (aucune permission existante ne correspond ; en attribuer une serait une décision de droits)
- ADMIN : `partners.js` (6 : liste, création, modification, statut, suppression, logo), `homepage-settings.js` (2 : image, enregistrement), `moderation.setFeatured` (mise en avant d'une annonce). À définir avec le propriétaire (ex. « partenaires », « page d'accueil », « mise en avant »).
- SUPERADMIN : 56 appels de `stats.js`, `places.js`, `owner-center.js`, `owner-delegations.js`, `advertiser-center.js`, `moderation.setStaffRole`, 2 dans `routes/index.js` ; `geo.js` et 3 appels de `routes/index.js` (à examiner).
**Granularité** : tout le niveau MODERATOR est regroupé sous `moderation.review` pour garder les droits identiques. Pour pouvoir déléguer finement (ex. seulement les avis), il faudra scinder cette permission : décision du propriétaire.
**À faire** : décider des permissions manquantes ci-dessus ; écran d'attribution des permissions ; DEC-003. BUG-004 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-004 (lot 2) — paiements et statistiques branchés sur les permissions nommées (15 novembre 2026)
**À réaliser** : poursuivre la migration progressive de `requireStaff` vers `requirePermission`, sans changer les droits.
**Réalisé** (branche `feat/bug-004-lot-2`, 8 appels, 3 fichiers)
- ✅ `server/services/payments.js` (4) : offres, modification d'une offre, réconciliation, remboursement → `payments.manage` (niveau ADMIN, comme avant).
- ✅ `server/services/stats.js` (4, ceux de niveau ADMIN) : classements, fiche annonceur, comparaison d'annonceurs, vue d'ensemble → `analytics.read` (niveau ADMIN, comme avant). Les 56 appels SUPERADMIN de `stats.js` ne sont pas touchés.
- ✅ Nouveau test de sécurité : tous les codes passés à `requirePermission` dans `server/` doivent exister dans la matrice (une faute de frappe ferait refuser tout le monde sans bruit). Test d'équivalence avec `requireStaff` étendu aux 2 nouvelles permissions.
**Vérifié**
- ✅ `npm test` : 191 tests, 188 réussis, 0 échec, 3 ignorés (PostgreSQL absent). Casse volontaire d'un code (`payments.manag`) → test en échec ; garde retirée de `payments.reconcile` → test des routes `/staff/*` en échec ; fichiers restaurés.
- ⬜ Site Render : non vérifié (pas d'accès depuis l'atelier).
**Constat (non modifié, décision du propriétaire)**
- ⚠️ `setOffer` (modifier le prix d'une offre) est ouvert aux ADMIN aujourd'hui, alors que `docs/etape-1/MATRICE_DROITS.md` classe « Offres et tarifs » en « Superadmin seul » dans l'Owner Center. Les droits actuels sont conservés ; à trancher avant d'aligner (DEC-003).
**À faire** : lots suivants (`partners.js` ×6 ADMIN, `homepage-settings.js` ×2, `moderation.js` mise en avant / restriction, `advertiser-applications.js` ×3, `reviews.js`, `engagement.js`), puis les 56 appels SUPERADMIN de `stats.js` (permission à définir : décision de droits). BUG-004 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-004 (partie 2) — permissions nommées : service `requirePermission` et premier lot branché (15 novembre 2026)
**À réaliser** : brancher les permissions nommées selon `PLAN_ROLES_PERMISSIONS.md` (« Code A ») et `docs/etape-1/MATRICE_DROITS.md`, **sans changer les droits actuels** ; créer l'index `Dossier_Suivi/`.
**Réalisé** (branche `feat/bug-004-permissions-service`)
- ✅ `requirePermission(userId, permission)` ajouté à `server/services/accounts.js`, à côté de `requireStaff` (qui reste en place, aucun appelant modifié d'un coup). Même contrôle et mêmes messages ; droits par rang = ceux de la migration 025 ; s'ajoutent les permissions accordées individuellement (`ika_user_permissions`, non expirées). Refus par défaut : permission inconnue, compte ordinaire, banni, restreint. Une permission non délégable accordée par erreur n'ouvre rien ; une permission accordée ne contourne ni blocage ni restriction.
- ✅ **Premier lot migré** dans `server/services/trust.js` (5 contrôles, seuils inchangés) : révocation de badge → `trust.badge_remove` ; liste noire (consulter, ajouter, retirer) → `trust.blacklist` ; décision sur une pièce → `trust.agency_badge` (agence) ou `trust.proof_review` (document). Les 113 autres appels `requireStaff` ne sont pas touchés.
- ✅ `test/staff-routes-guard.test.js` : `requirePermission` ajouté aux gardes reconnues (limite annoncée dans BUG-008).
- ✅ `Dossier_Suivi/00_INDEX.md` créé : index des documents (rien dupliqué, le suivi reste dans `Important/`).
**Vérifié**
- ✅ `test/permissions-service.test.js` (9 tests) : pour chaque contrôle migré, **4 rôles × 3 statuts de compte**, `requirePermission` donne exactement le même résultat et le même message que `requireStaff` ; permissions individuelles, non délégables, expirées, compte banni/restreint, requêtes inutiles évitées.
- ✅ Essais de régression : 5 casses volontaires (liste noire abaissée au niveau modération, blocage ignoré, compte ordinaire pris en compte, permissions expirées acceptées, toute permission accordée) → chacune fait échouer des tests ; garde retirée de `blacklistAdd` → le test des routes `/staff/*` échoue. Fichiers restaurés.
- ✅ `npm test` : 190 tests, 187 réussis, 0 échec, 3 ignorés (PostgreSQL absent). `stamp-sw:check` : à jour.
**Non vérifié**
- ⬜ Requête SQL `ika_user_permissions` jamais exécutée sur un vrai PostgreSQL (fausse base seulement). La table est vide et aucun code n'y écrit : aucune permission individuelle n'existe, donc **les droits en production sont identiques à ceux d'avant**. Site Render : non vérifié.
**Risques**
- ⚠️ Un modérateur qui appelle une route migrée sans avoir le droit déclenche désormais 1 requête de plus sur `ika_user_permissions` avant le refus 403 ; si la migration 025 manquait en base, ce cas renverrait une erreur 500 au lieu de 403 (la migration 025 est dans les migrations automatiques du démarrage).
**À faire**
- ⬜ Migrer les autres appels par lots (décision sur une annonce, restriction de compte, paiements, audit, statistiques, Premium…), un lot par branche, avec le même test d'équivalence. L'attribution de permissions (écran + `assertCanGrant`) n'est pas encore branchée : aucune permission ne peut encore être accordée.
- ⬜ DEC-003 (modules de l'Owner Center délégables) toujours à confirmer avant de brancher `/staff/owner/*` (matrice : 29 délégables, 12 réservés).
- ⬜ Registre Excel non modifié : BUG-004 reste « Ouverte » (partiel).

## BUG-004 (partie 1) — `can()` : un rôle inconnu est désormais refusé (15 novembre 2026)
**À réaliser** : brancher les permissions nommées (BUG-004). Partie 1 = corriger l'écart relevé dans `can()` (`server/lib/permissions.js`), sans brancher la matrice.
**Réalisé** (branche `fix/bug-004-permissions`, 1 ligne ajoutée dans `can()`)
- ✅ Un rôle absent de la matrice (`USER`, `undefined`, `null`, nom quelconque) est refusé même avec une permission accordée individuellement, comme l'annonçait déjà la documentation. Corrige aussi un plantage latent : un rôle nommé `constructor` ou `toString` provoquait une erreur (`.includes is not a function`) ; `Object.hasOwn` règle les deux cas.
- ✅ Le test « todo » du lot 1 est devenu un vrai test (5 rôles inconnus).
**Vérifié**
- ✅ Le nouveau test **échoue sur l'ancien code** et passe avec le correctif. `npm test` : 181 tests, 178 réussis, 0 échec, 3 ignorés (PostgreSQL absent), 0 « todo ». Aucun fichier du serveur n'importe `permissions.js` : **aucun effet sur le site en production**.
**Pas fait : le branchement lui-même (⛔ décision du propriétaire)**
- ⬜ L'accès équipe repose sur `requireStaff(userId, minimum)` (`server/services/accounts.js`, 113 appels, test de rang MODERATOR < ADMIN < SUPERADMIN). Brancher la matrice demande de choisir, route par route, la permission qui remplace chaque rang : c'est une décision de droits (prérequis de DEC-001 / DEC-003), pas seulement technique. Les tables existent déjà (migration 025 : `ika_permissions`, `ika_role_permissions`, `ika_user_permissions`).
- ⬜ BUG-004 reste « Ouverte » dans le registre Excel (non modifié).

## BUG-003 (lot 1) — tests des modules purs de `server/lib/` (15 novembre 2026)
**À réaliser** : BUG-003 (modules serveur sans test). Lot 1 = les modules purs de `server/lib/`, sans base de données, pour protéger les règles métier avant de les modifier. Aucun changement de code serveur.
**Réalisé** (branche `test/modules-lib-bug-003`, fichier `test/lib-pures.test.js`, 35 tests)
- ✅ Couverts : `slug`, `blacklist`, `digest`, `price-history`, `user-reports`, `error-sink`, `permissions`, `search`, `drafts`, `trust` (partie `lib`). Points protégés : refus de la liste noire (403, message neutre), photos de brouillon limitées à `/media/…` (10 au plus), seuils d'alerte de prix (40 % / 250 % de la médiane), limites de recherche (50 résultats, décalage 10 000), règles d'octroi des permissions (jamais à soi-même, jamais une permission non délégable, motif obligatoire), panne du service de suivi d'erreurs sans effet sur le site.
**Vérifié**
- ✅ `npm test` : 181 tests (146 avant), 177 réussis, 0 échec, 3 ignorés (PostgreSQL absent : non exécutés), 1 « todo » volontaire. `stamp-sw:check` : à jour.
- ✅ Essais de régression : 7 casses volontaires du code (liste noire désactivée, non-délégables accordables, auto-octroi permis, photos externes acceptées, seuil de prix déplacé, limite de recherche retirée, panne du suivi propagée) → **chacune fait échouer exactement 1 test** ; fichiers restaurés ensuite (`git status` : seul le nouveau test apparaît).
**Constat (corrigé ensuite : voir « BUG-004 (partie 1) » ci-dessus)**
- ⚠️ `can()` (`server/lib/permissions.js`) est documentée « rôle inconnu : refus », mais une permission accordée individuellement l'emporte aujourd'hui même pour un rôle inconnu (`can("X", "account.ban", ["account.ban"])` → vrai). Sans effet en production aujourd'hui (le module n'est branché nulle part), à trancher avant de brancher la matrice. Test marqué « todo » (`BUG-004`) qui deviendra un échec utile quand ce sera corrigé.
**À faire**
- ⬜ Lots suivants de BUG-003 (liste recalculée par nom de fichier, à confirmer ; l'audit en annonçait 24) : services `engagement`, `moderation`, `trust`, `crm`, `seo`, `analytics`, `homepage-settings`, `cards`, `imports`, `owner-delegations`, `properties`, `duplicates`, `geo` ; lib `geo`, `file-storage`, `fiche`, `aggregation`, `notifier`, `csv`, `logger`, `receipt-email` ; `seo/render`, `seo/guides`, `routes/seo`, `payments/paydunya`, `payments/cinetpay`. Les services touchent la base : à tester avec PostgreSQL (DEC-002).
- ⬜ Le registre Excel n'a pas été modifié : BUG-003 y reste « Ouverte » (lot 1 sur plusieurs).
- ⬜ `Dossier_Suivi` n'existe pas dans le dépôt : le suivi réel est dans `Important/` ; décision du propriétaire toujours attendue.
**Risques** : aucun pour la production (seul un fichier de test est ajouté, aucun code exécuté par le site). La branche de test `test-acces-ecriture-tmp` créée lors du contrôle d'accès existe encore sur GitHub (suppression refusée par le proxy de l'agent) : à supprimer à la main.

## BUG-008 — contrôle d'accès des routes /staff/* qualifié et verrouillé par test (14 novembre 2026)
**À réaliser** : qualifier route par route les 130 routes `/staff/*` (registre des anomalies, BUG-008 « À qualifier ») et empêcher qu'une route sans garde soit ajoutée sans que cela se voie.
**Réalisé**
- ✅ Analyse : sur 130 routes `/staff/*`, **aucune route sans garde de rôle** n'a été trouvée. Le contrôle est soit dans la route (`requireOwnerModule`…), soit en tête de la fonction de service appelée (`requireStaff`, `guard`, `requireSuper`, ou délégation à une fonction gardée comme `ownerExportCsv` → `ownerOverview`). Aucun changement de code serveur n'a été nécessaire.
- ✅ Test ajouté : `test/staff-routes-guard.test.js` (3 tests). (1) sans connexion, aucune route `/staff/*` n'atteint un service et toutes répondent 401 ; (2) chaque route `/staff/*` a une garde de rôle dans la route ou dans les 8 premières lignes de la fonction de service appelée (fichier de service déduit du nom).
**Vérifié**
- ✅ `npm test` : 146 tests, 143 réussis, 0 échec, 3 ignorés (PostgreSQL absent : non exécutés). `stamp-sw:check` : à jour.
- ✅ Essais de régression (garde retirée puis fichier restauré) : route sans `requireUser` → test 2 échoue ; garde retirée de `places.listForOwner`, de `ownerDelegations.grant` et de `stats.ownerOverview` (via `ownerExportCsv`) → test 3 échoue à chaque fois.
**Limites / à faire**
- ⚠️ Le test vérifie la **présence** d'une garde, pas son **niveau** (SUPERADMIN, ADMIN, modérateur). Les niveaux restent à tester route par route avec de vrais comptes (PostgreSQL) : non fait.
- ⚠️ Test statique : une nouvelle forme de garde (autre nom de fonction) devra être ajoutée à l'expression `GUARD` du test.
- ⬜ Le registre Excel (`IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx`, feuille Anomalies) n'a pas été modifié : BUG-008 y reste « Ouverte » ; à passer en « Résolue (présence des gardes) » après votre validation.
- ⬜ Prochaines anomalies du registre : BUG-001 (3 styles en ligne ; `dom.js` applique déjà les styles texte via `cssText`, compatible avec la politique de sécurité — à requalifier avec un navigateur), BUG-002 (40 migrations sans retour arrière), BUG-003 (24 modules sans test), BUG-004 (permissions nommées non branchées, prérequis de DEC-001/DEC-003), BUG-005 (double authentification absente).

## Fusion de l'archive IKA_SO_Projet_V0_2_FUSION_1 (14 novembre 2026)
**À réaliser** : fusionner l'archive fournie par le propriétaire (ÉTAPE 1 + ÉTAPE 2, plus avancée) avec le dépôt GitHub, sans perdre les acquis GitHub.
**Réalisé** (branche `fusion/etape-1-2`, rapport de l'archive : `docs/FUSION/RAPPORT_FUSION_ETAPE_1_2.md`)
- ✅ Comparaison par empreinte : 305 fichiers identiques, 19 modifiés dans l'archive, 89 nouveaux, 2 seulement sur GitHub. Appliqué : 106 fichiers de l'archive (migrations 059–064, services CRM / délégations / journal de modération / réglages Superadmin / WhatsApp / biens, pages `admin-audit`, `admin-settings`, `crm-leads`, `components.css`, tests, `docs/etape-*`, `docs/rapports_etapes_E2`, `docs/FUSION`, workflow CI `.github/workflows/ci.yml`).
- ✅ **Acquis GitHub conservés** : `public/downloads/ika-so.apk` et `.gitkeep.` ; section « APPLICATION MOBILE OFFICIELLE » de `public/js/pages/home-sections.js` (absente de l'archive, version GitHub gardée) ; ce fichier de suivi.
- ✅ `public/index.html` : version de l'archive (lien `components.css`) ; elle supprime aussi un `<section>` orphelin laissé par les commits Android du 11/11 avant le pied de page.
- ✅ Documents `RAPPORT_ETAPE_0.md`, `RAPPORT_ETAPE_1.md`, `IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx` rangés dans `Important/` (convention du dépôt).
**Vérifié**
- ✅ `npm test` : 143 tests, 140 réussis, 0 échec, 3 ignorés. `stamp-sw:check` : à jour (`ika-so-84a688f7f0`).
- ✅ Routes : 249 avant, 272 après, **0 route perdue**, 23 ajoutées. Syntaxe JS des fichiers modifiés : OK. Aucun secret en dur (`.env.example` : variables WhatsApp commentées).
- ✅ **Migrations 001–064 exécutées sur un PostgreSQL 16 local de test** : 059–064 s'appliquent, se rejouent sans erreur ; `docs/FUSION/ANNULATION_MIGRATIONS_059_064.sql` testé (supprime bien les 5 tables, la colonne `property_id` et les 6 lignes de `_migrations`), puis réapplication OK. Migrations additives (aucune donnée existante modifiée).
**Non vérifié**
- ⬜ `npm install` / vrai Express / vrai pilote `pg` impossibles ici (réseau désactivé) : tests de routes faits avec le mini-routeur de test de l'archive. Test d'intégration PostgreSQL (`DATABASE_URL_TEST`) et démarrage du serveur : non exécutés (le workflow CI les exécutera sur GitHub).
- ⬜ Navigateur (accueil, annonceur, admin-settings, admin-audit, crm-leads ; ordinateur / téléphone), Mapbox, WhatsApp, paiements : non vérifiés. Site Render : non vérifié.
**Risques / à faire**
- ⚠️ Les migrations 059–064 s'appliquent **automatiquement au démarrage** sur Render (`migrate()` dans `server/index.js`). Retour arrière : `git revert` du commit de fusion + `docs/FUSION/ANNULATION_MIGRATIONS_059_064.sql` (après sauvegarde de la base).
- ⬜ Anomalies A-01, A-06, A-07 restantes (voir `IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx`), dont la délégation ADMIN encore bloquée.
- ⬜ APK de 13 Mo (origine et signature non documentées) toujours à documenter.

## Vérification du dépôt et version du service worker (14 novembre 2026)
**À réaliser** : vérifier l'état du dépôt ; corriger tout écart constaté.
**Réalisé**
- ✅ `npm run stamp-sw` relancé : `public/sw.js` passe de `ika-so-8a291ed21a` à `ika-so-653da5bfc9` (1 ligne). Les commits du 11/11 sur `public/index.html` et `public/js/pages/home-sections.js` (section de téléchargement Android) n'avaient pas rafraîchi la version du cache.
**Vérifié**
- ✅ `npm run stamp-sw:check` : version à jour. `npm test` : 122 tests, 119 réussis, 0 échec, 3 ignorés (PostgreSQL absent : non exécutés).
- ⬜ Site Render (`ika-so.onrender.com`) : non vérifié (accès refusé depuis l'environnement de l'agent).
**À faire / Risques**
- ⬜ Après déploiement : contrôler le statut Render et la nouvelle version du cache sur un appareil.
- ⬜ `public/downloads/ika-so.apk` (13 Mo, commit « Add files via upload ») : origine et signature non documentées.
- ⬜ Section Android de l'accueil (commits du 11/11) : non décrite dans ce suivi.
- ⬜ `Dossier_Suivi` absent du dépôt : le suivi est dans `Important/` ; décision du propriétaire attendue.

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

## Mon profil : menu, invitation d'équipe, filtres d'avis (17/11/2026)

Branche : `fix/profil-equipe-avis` (depuis `origin/main` 2cf342b). Non fusionnée dans `main`.

- **À réaliser :** (1) retirer « Profil public » et le remplacer par « Mon profil » ; (2) permettre l'invitation d'équipe depuis son propre profil ; (3) rendre fonctionnels les filtres d'avis Tous / Positifs (4-5) / Négatifs (1-2).
- **Réalisé :** menu compte et tableau de bord sans « Profil public » ; `#/mon-profil-public` redirige vers `#/profil` ; onglet Équipe de « Mon profil » avec recherche d'annonceurs et bouton « Inviter » (rôle facultatif) ; filtres d'avis : la classe active était `primary` (inexistante), remplacée par `btn-primary`.
- **Vérifié :** `node --check` sur les 7 modules modifiés ; `npm run -s stamp-sw:check` OK ; `npm test` avec `DATABASE_URL_TEST` : 276/276 réussis ; navigateur local (390 px) : menu sans lien « Profil public », redirection OK, recherche et invitation envoyée visibles dans « Invitations envoyées », pas de débordement horizontal, filtre « Positifs » envoie `kind=best` et reste actif, aucune erreur JavaScript.
- **En cours :** validation par le propriétaire sur le site réel (aucune fusion dans `main` sans accord écrit).
- **À faire :** après validation, décider de la fusion dans `main` ; la réponse à l'invitation (accepter / refuser) n'a pas été rejouée de bout en bout côté second compte.
- **Risques :** les polices `Outfit` et `PlusJakartaSans` référencées par `public/css/refonte.css` sont absentes de `public/fonts/` (404 en local, préexistant, non traité) ; le compte de test « Agence Recette » et son annonce ont été créés uniquement dans la base de test `ika_test`.
- **Complément (17/11/2026) :** acceptation de l'invitation testée côté second compte (API, `POST /me/team-requests/:id/accept`) : statut `ACCEPTED`, membre visible des deux côtés. Test local uniquement.
- **Fusion (17/11/2026, autorisée par le propriétaire) :** `fix/profil-equipe-avis` fusionnée dans `main` (commit de fusion `57914de`, `--no-ff`, retour arrière : `git revert -m 1 57914de`). Tests locaux 276/276 après fusion. Push `main` vérifié sur le dépôt distant. Déploiement Render : non vérifiable depuis l'environnement de l'agent (site injoignable, code 000) : à contrôler sur le site.
- **Non fusionnées :** `feat/confidentialite-lot-a` (conflits et réserves, aucune fusion sans autorisation écrite), `feat/import-annonces-masse` (conflits, DEC-007 en attente).
## Confidentialité lot A — mission 04-bis (17/11/2026)

Branche : `feat/confidentialite-lot-a`. Commits : `6cd43b0` (code, recette Mapbox préparée). Mise à jour du suivi : commit suivant. **Aucune fusion dans `main`, lot B non démarré.**

- **À réaliser :** lever les réserves de la mission 04 : fiche d'une annonce à simple point GPS (plan de secours), PDF réel, retrait du consentement Mapbox, recette Mapbox préparée sans jeton de production, non-régression, mise à jour du classeur.
- **Réalisé :**
  - Plan de secours `planPointSvg()` dans `server/lib/fiche.js` pour une annonce à point seul (sans contour ni mesure) ; lien d'impression affiché pour un point seul (`public/js/pages/localisation.js`). Contour non obligatoire pour publier.
  - `clearMapboxStorage()` (`public/js/core/consent.js`) appelé au retrait de « Cartes » (`public/js/components/consent-panel.js`) : suppression des seules clés `mapbox*`.
  - `scripts/recette/mapbox-consentement.mjs` (jeton `MAPBOX_TEST_TOKEN` requis, jamais affiché, `access_token` masqué dans le journal) et `Important/PROCEDURE_RECETTE_MAPBOX.md` (statut : préparée, non exécutée).
  - Tests : `test/confidentialite-lot-a.test.js` étendu (29 tests du lot A).
  - Classeur : feuille « Suivi confidentialité » complétée par CF-027 à CF-037 ; autres feuilles vérifiées identiques (signature valeur + style).
- **Vérifié :**
  - `npm test` avec PostgreSQL de test : 304 réussis, 0 échec.
  - PDF réels (Playwright `page.pdf`) : fiche à point seul avec et sans consentement, fiche à contour avec et sans consentement (`?fond=mapbox` ignoré) : PDF valide, 1 page, mention présente, 0 requête Mapbox, aucun jeton dans la page.
  - Modération : annonce en attente 404 au public ; refus sans motif 400 ; validation 200 public ; position GPS publique 200.
  - Navigateur (390 px) : publication, géolocalisation, fiche, centre, favoris, mes annonces, connexion et déconnexion, brouillons (isolation par compte, récupération et suppression explicites) : aucune erreur JavaScript, aucun débordement, 0 requête Mapbox sans consentement.
  - Pages publiques : statut 200, 0 requête Mapbox avant consentement.
  - Exécution à blanc de la recette Mapbox (jeton factice, serveur sans jeton) : 10 réussis, 3 échecs attendus (3a, 3b, 3c).
- **En cours :** recette Mapbox réelle en attente d'un jeton de test restreint fourni hors chat (ou vérification sur le site par le propriétaire).
- **À faire :**
  - Décision propriétaire sur le plan de secours (point seul) et sur la mention obligatoire.
  - Rebaser `feat/confidentialite-lot-a` sur `main` avant toute fusion : `main` distant est à `2cf342b` (12 commits connexion Google / APK / boutons). Conflits constatés par simulation (`git merge-tree`) sur `Important/SUIVI.md`, `public/css/components.css` et `public/sw.js`. Non résolus.
  - Restreindre le jeton Mapbox public aux domaines du site (compte Mapbox, propriétaire).
  - Vérifier la licence de `mapbox-gl` 3.33.0 (R9 de l'audit).
  - Validation juridique (`LEGAL_VALIDATED` reste à `false`).
  - Lot C (services tiers) et lot D (preuve serveur) : non démarrés.
- **Risques :**
  - Rendu réel Mapbox, télémétrie réelle et image statique réelle non vérifiés (aucun jeton de test, `api.mapbox.com` injoignable depuis l'environnement).
  - Le jeton Mapbox public reste visible dans `/api/config/map` par conception tant que la restriction par domaine n'est pas faite côté compte.
  - Le script `regress.js` testait `/fiche` (404) : vérification du bouton d'impression à corriger ; couverte par `ui-recette`.
  - Le dépôt distant a été déplacé (avertissement du remote lors du push) : à mettre à jour côté configuration Git.
## Import en masse Excel (17/11/2026) — branche `feat/import-annonces-masse`

Base : `main` au commit `2cf342b`. Aucune fusion dans `main`. Déploiement : aucun.

- **À réaliser :** ajouter l'import de plusieurs annonces par fichier Excel, avec un bouton « Exporter le modèle Excel » dans « Mon profil > Mes annonces > Importer en masse », réservé aux annonceurs approuvés, à l'équipe et aux numéros vérifiés par SMS.
- **Réalisé :**
  - `server/lib/xlsx.js` : écriture d'un classeur `.xlsx` et lecture de la première feuille, sans dépendance externe. Limites : 400 Ko, 4 Mo décompressés, 1000 lignes, 60 colonnes, CRC contrôlé, fichiers chiffrés refusés.
  - `server/lib/csv.js` : `rowsToListings` (même contrôle que le CSV, numéros de ligne du fichier Excel). `csvToListings` inchangé pour l'appelant.
  - `server/services/imports.js` : `assertCanImport` (même règle que le CSV : annonceur approuvé ou équipe, numéro vérifié), `importStatus`, `importXlsx`, `modeleXlsx` (feuilles « Annonces » et « Valeurs acceptées »), traitement commun `importParsed`.
  - Routes : `GET /api/me/import/statut`, `GET /api/me/import/modele.xlsx`, `POST /api/me/import/xlsx` ; `POST /api/me/import` (CSV) inchangée.
  - Interface : `public/js/components/bulk-import.js` (partagé), intégré dans « Mon profil > Mes annonces » (bloc repliable) et dans l'espace agence (remplace l'ancien bloc CSV, qui reste accessible via le modèle CSV).
  - Tests : `test/import-xlsx.test.js` (14 tests : aller-retour, modèle, fichier produit par openpyxl, fichiers piégés, droit d'import). Fixture : `test/fixtures/import-openpyxl.xlsx`.
- **Vérifié :**
  - `npm test` : 282 réussis, 0 échec (base de test PostgreSQL).
  - Interopérabilité : fichier produit par notre écriture relu par openpyxl ; fichier produit par openpyxl relu par notre lecture (chaînes partagées, nombres, booléens, accents).
  - Navigateur, 390 px : statut du droit affiché, modèle téléchargé en `.xlsx`, fichier fautif refusé avec les lignes concernées (rien créé), fichier correct importé en « En attente » (2 annonces), fichier non Excel refusé avec message clair, compte non approuvé : bouton désactivé et raison affichée, pas de débordement horizontal, aucune erreur JavaScript.
  - Import CSV existant : toujours fonctionnel (contrôle à blanc : 2 annonces, 0 erreur). Visiteur anonyme : 401 sur le modèle et sur le statut.
- **En cours :** rien.
- **À faire :**
  - Décision propriétaire (DEC-007) : exiger aussi la certification d'agence (registre de commerce) pour importer, ou conserver la règle actuelle (annonceur approuvé + numéro vérifié). Le texte demandé mentionne « agences certifiées » ; la règle existante ne l'exige pas.
  - Après un import réussi, la page se recharge et le bloc se referme (BUG-014, mineur).
  - Vérification sur un vrai téléphone Android et dans Excel (non fait : environnement sans Excel).
  - Recette sur le site de production après fusion, sur autorisation écrite.
- **Risques :**
  - Lecteur `.xlsx` maison : surface d'attaque plus large qu'une bibliothèque éprouvée ; limites strictes et tests de fichiers piégés, mais une revue de sécurité est recommandée avant fusion.
  - Limite de 10 imports par heure et par compte (partagée avec le CSV) : les contrôles à blanc comptent aussi.
  - Branche créée depuis `main` (2cf342b) : elle ne contient pas les commits de confidentialité lot A (`feat/confidentialite-lot-a`). Les fichiers communs à traiter au rebase : `Important/SUIVI.md`, `public/sw.js`.
- **Fusions finales (18/11/2026, autorisées par le propriétaire) :** `feat/confidentialite-lot-a` puis `feat/import-annonces-masse` intégrées via `integration/lot-a-import`, puis fusionnées dans `main` (commit `b9f02f6`, `--no-ff`, retour arrière : `git revert -m 1 b9f02f6`). Conflits résolus sans supprimer de ligne : `components.css` (blocs conservés), `SUIVI.md` (sections conservées), classeur (lignes ajoutées, aucune modifiée), `sw.js` re-tamponné. Tests : 311/311. Contrôles navigateur locaux : menu, équipe, import (sans erreur). **DEC-007 reste à arbitrer.** Déploiement Render : non vérifiable depuis l'agent.

## Centre unifié : fusion de l'ancien centre (/admin) dans le Owner Control Center (18/11/2026)

Branche : `feat/owner-center-unifie` (depuis `main` 9d85141). Non fusionnée. Décision propriétaire : DEC-008 = option B.

- **À réaliser :** supprimer l'ancien centre classique (`/admin`) après avoir branché toutes ses fonctionnalités dans `/owner`, et donner l'accès aux ADMIN via les délégations par module.
- **Réalisé (étape 1) :** point d'accès `GET /staff/owner/access` (modules accessibles de l'utilisateur) ; menu `/owner` filtré selon ces modules ; route interdite affiche « Accès réservé » ; matrice `docs/etape-1/matrice-owner-center.json` complétée (segment `access`, 42 segments, 30 délégables).
- **Vérifié :** tests 311/311 ; navigateur : ADMIN délégué voit 2 entrées (Annonces & modération, Confiance) et `#/users` est refusé ; SUPERADMIN voit 25 entrées, sans erreur JavaScript. Ces comptes existent uniquement dans la base de test (`ika_test`).
- **En cours / À faire (étape 2) :** brancher dans `/owner` les fonctionnalités encore présentes seulement dans `/admin` :
  1. Annonces : approuver, refuser avec motif, mettre à la une (`/staff/listings/:id/decision`, `/feature`).
  2. Demandes annonceurs : décider, voir les documents (`/staff/advertiser-applications…`).
  3. Demandes de mise à la une (`/staff/featured-requests…`).
  4. Comptes staff : rôle, statut, lien de réinitialisation (`/staff/accounts/:id/…`), liste noire (`/staff/blacklist`).
  5. Signalements : classer sans suite (`/staff/reports/:id/dismiss`).
  6. Confiance : ouvrir les pièces (`/staff/proofs/:id/file`) — aujourd'hui renvoi vers `/admin`.
  7. Paiements : rapprochement, remboursements, tarifs des offres (`/staff/payments/reconcile`, `/staff/offers`).
  8. Page d'accueil : envoi d'image (`/staff/homepage-image`).
  9. Statistiques : vue d'ensemble, comparaison, classements, fiche annonceur (`/staff/stats/…`).
  Puis : supprimer `public/admin.html` et `public/js/admin.js`, rediriger `/admin` vers `/owner`, retirer les liens (menu compte, console, bouton « classique ») — **uniquement après validation du propriétaire sur le site**.
- **Risques :** les endpoints `/staff/*` existants sont protégés par rôle de staff ; le menu `/owner` ne doit jamais être la seule barrière (le serveur contrôle chaque appel). Les renvois `adminLink` du centre v2 (trust, complaints, payments) doivent disparaître avec leur fonctionnalité.

### Étape 2 — état au 18/11/2026 (branche feat/owner-center-unifie)
- **2A** Demandes annonceurs (Agences & annonceurs) : approuver, demander des informations, refuser ; pièces consultables. Vérifié navigateur SUPERADMIN.
- **2B** Mises à la une (Annonces & modération) : accepter, refuser motivé. Vérifié navigateur.
- **2C** Liste noire (Confiance) et lien de réinitialisation (Utilisateurs). Liste noire vérifiée navigateur ADMIN et SUPERADMIN ; lien de réinitialisation vérifié (dialogue, valeur).
- **2D** Pièces justificatives (Confiance) : voir, accepter (note + nom d'agence), refuser. Acceptation de bout en bout vérifiée (ADMIN délégué et SUPERADMIN).
- **2E** Paiements : offres, rapprochement, remboursements notés. Chargement vérifié ; remboursement et modification de prix **non exécutés** (pas de paiement de test).
- **2F** Page d'accueil : 14 champs, photo importée, annuler. Enregistrement et persistance vérifiés. Aperçu en direct non porté (lien « Voir le site »).
- **2G** Statistiques (menu « Statistiques », module « report ») : rendu et période vérifiés. Fiche et comparaison : routes 200, affichage non vérifié (pas de données).

**Points à trancher avant l'étape 3 (droits ADMIN) :**
- Dans l'ancien centre, un ADMIN pouvait restreindre/bloquer un compte et générer un lien de réinitialisation. Dans le nouveau, la vue Utilisateurs reste réservée au SUPERADMIN : ces actions ne sont donc pas accessibles aux ADMIN délégués. À décider (DEC à ouvrir).
- Les liens « centre de contrôle classique » (actions de l'Annonces, Confiance, Paiements, Utilisateurs) pointent encore vers `/admin` ; ils seront retirés à l'étape 3.

### Étape 2H — actions sur les comptes délégables (18/11/2026, décision propriétaire : option b)
- Module délégable « Utilisateurs » (`users`) ajouté : liste des comptes, restriction / blocage, lien de réinitialisation. Vérification **côté serveur** à chaque appel (`requireOwnerModule`).
- Module « Confiance » (`trust`) appliqué à la liste noire (lecture, ajout, retrait).
- Changement de rôle : toujours réservé au SUPERADMIN (bouton masqué pour les autres).
- Refus d'un module non délégué : désormais HTTP 403 (auparavant 500, car l'erreur n'était pas reconnue par le gestionnaire). Corrige tous les modules du centre.
- Vérifié : tests 311/311 ; ADMIN sans délégation « users » : 403 sur liste et lien de réinitialisation ; avec délégation : 200 ; menu et écran cohérents.
- Non vérifié : restriction/blocage effectif par un ADMIN délégué (action sur compte réel non jouée en test).
- **Vérifié le 18/11/2026 (base de test) :** un ADMIN délégué « Utilisateurs » restreint, bloque puis réactive un compte jetable (200, statut confirmé en base) ; délégation retirée ensuite. Modification d'une offre (prix puis retour à la valeur d'origine, 200).
- **Non vérifié :** remboursement (aucun paiement de test). Fiche et comparaison annonceur à l'écran (aucune donnée d'activité).

### Étape 2I — garde serveur par module pour ADMIN + polices (18/11/2026)
- **À réaliser :** appliquer les propositions : garde par module sur les routes candidatures, offres, paiements, modération, preuves ; polices manquantes (404) ; remboursement et fiche/comparaison à tester.
- **Réalisé :**
  - Helper `requireOwnerGate` (routes/index.js) appelant `ownerDelegations.gate` : ADMIN sans délégation → 403 ; SUPERADMIN et MODERATOR inchangés. 15 routes concernées (featured-requests, advertiser-applications, offres, paiements, file d'attente, annonces, signalements, preuves).
  - Module délégable « payments » ajouté ; route `GET /staff/owner/access` pour afficher seulement les modules attribués.
  - Polices : `@fontsource-variable/outfit@5.3.0` et `@fontsource-variable/plus-jakarta-sans@5.3.0` ajoutées (dépendances validées par le propriétaire), fichiers copiés dans `public/fonts/` (Outfit-Variable.woff2, PlusJakartaSans-Variable.woff2). Service worker re-stampé (`ika-so-069aeb94b2`).
  - Commit `b93293b` poussé sur `feat/owner-center-unifie` (non fusionné dans `main`).
- **Vérifié :** tests 311/311 ; sur base de test, ADMIN délégués « moderation » et « trust » : `/staff/queue`, `/staff/featured-requests` 200 ; `/staff/advertiser-applications`, `/staff/offers`, `/staff/payments/reconcile`, `/staff/accounts` 403. SUPERADMIN : 200 partout. Fichiers polices servis en 200 (font/woff2).
- **Non vérifié :** rôle MODERATOR (aucun compte de test) ; remboursement (aucun paiement de test) ; fiche et comparaison annonceur (aucune donnée) ; production (inaccessible depuis l'agent).
- **En cours :** étape 3 (suppression de `/admin`) — uniquement après validation du propriétaire sur le site réel.
- **À faire :** validation propriétaire du branche sur le site ; autorisation écrite pour fusion dans `main` ; tests remboursement et fiche/comparaison.
- **Risques :** le dépôt distant a signalé un changement d'emplacement (`github.com/bkontao-crypto/Ika-so`) ; le push a réussi mais il est conseillé de mettre à jour l'URL du remote local.
- **Vérifié le 18/11/2026 (base de test) — remboursement :** paiement de test PAID (BOOST_30) ; ADMIN sans délégation « payments » : 403 ; SUPERADMIN : 200, statut passé à REFUNDED avec motif et référence enregistrés. Fiche et comparaison annonceur : toujours non vérifiées (pas de données d'activité).

### Étape 3 — retrait de l'ancien centre `/admin` (18/11/2026, autorisation écrite du propriétaire)
- **Condition vérifiée :** chaque écriture de l'ancien centre (statut et rôle de compte, lien de réinitialisation, décision annonceur, mise à la une, décision de demande, ignorer un signalement, page d'accueil et image) a son équivalent dans le centre unifié, derrière la garde par module. Onglets couverts : file, annonceurs, confiance, signalements, en ligne, paiements, journal, comptes, mise à la une, statistiques.
- **Réalisé :** suppression de `public/admin.html` et `public/js/admin.js` ; `/admin` et `/admin.html` redirigent en 301 vers `/owner` ; liens « centre classique » retirés du centre et de l'en-tête ; liens « Centre de contrôle staff » et « Console » pointent vers `/owner` ; notifications de demande (annonceur, mise à la une) pointent vers `/owner` ; scripts de vérification et documents d'étape 1 mis à jour ; service worker re-stampé (`ika-so-646ad8c514`).
- **Vérifié :** tests 311/311 ; `/admin` et `/admin.html` → 301 vers `/owner` ; `/owner` 200 ; `/js/admin.js` 404 attendu ; polices 200 ; `node --check` sur les fichiers modifiés.
- **Non vérifié :** parcours complet dans le navigateur sur le centre ; production (inaccessible depuis l'agent).
- **Incident de la fusion :** une première fusion dans `main` a été poussée (5eca9ed) pendant que la base de test était arrêtée (14 échecs, sans lien avec le code) ; relance une fois la base remise en route : 311/311.
- **Environnement de test :** la base `ika_test` a été recréée vide sur le cluster redémarré (les données de test antérieures ne sont plus là) ; aucune donnée de production touchée.

### Paiement en ligne activable + demandes Premium à la main (18/11/2026, demande du propriétaire)
- **À réaliser :** réglage superadmin « paiement en ligne ouvert ou fermé » ; approbation manuelle du Premium pour 1 à 3 mois maximum (durée choisie par l'équipe), avec tous les avantages pendant ce temps ; écran de réglage dédié.
- **Réalisé :**
  - Réglage `payments_policy` (superadmin) : `onlineEnabled` (défaut : fermé) et `manualPremiumMaxMonths` (1 à 3, défaut 3). Écran « Réglages paiement » dans le Owner Center (superadmin seul).
  - Paiement en ligne : les formules ne sont proposées et le paiement n'est accepté que si le fournisseur est configuré ET le réglage ouvert.
  - Demandes Premium (table `ika_premium_requests`, migration 071 + script de retour arrière) : l'annonceur demande 1 à N mois ; l'équipe (superadmin, ou administrateur délégué « Paiements ») approuve pour 1 à N mois ou refuse avec motif. L'approbation ajoute les jours au Premium, trace dans `ika_premium_grants` et le journal, et prévient l'annonceur.
  - Owner Center « Paiements & finances » : panneau « Demandes Premium » (approuver / refuser).
  - Page « Devenir Premium » : demande à la main quand le paiement en ligne est fermé ; statut de la demande affiché.
  - Test unitaire des bornes de la politique ; service worker re-stampé.
- **Vérifié (base de test, API) :** réglage enregistré ; `/offers` → fermé, durée max renvoyée ; demande 3 mois refusée (400) quand max = 2 ; demande en double refusée (409) ; approbation 1 mois → Premium actif, jours ajoutés, grant tracé ; approbation hors limite refusée (400) ; refus avec motif OK ; ADMIN sans délégation « Paiements » : 403 ; avec délégation : 200 ; réglage réservé au superadmin : 403 pour l'administrateur. Navigateur : écran de réglage et panneau des demandes rendus sans erreur ; page Devenir Premium affichée sans erreur (mobile).
- **Non vérifié :** paiement en ligne réel (aucun fournisseur de paiement configuré en test) ; enregistrement du réglage par le bouton de l'écran (testé via l'API seulement) ; production.
- **Risques :** tant que le fournisseur de paiement n'est pas configuré, « paiement en ligne ouvert » n'a aucun effet réel (les demandes restent manuelles). Vérifier la configuration du fournisseur avant d'ouvrir le paiement.

### Mise à la une à la main : durée de 1 à 3 mois (18/11/2026, demande du propriétaire)
- **Réalisé :** réglage `manualFeaturedMaxMonths` (1 à 3, défaut 1) dans « Réglages paiement » ; à l'acceptation d'une demande de mise à la une, l'équipe choisit 1 à N mois (1 mois = 30 jours) ; la durée est enregistrée sur l'annonce (`featured_until`) ; les formules payantes gardent leur durée propre.
- **Vérifié :** tests 315/315 (dont bornes du réglage) ; API : acceptation hors limite refusée (400) ; `make_interval` contrôlé en base.
- **Non vérifié :** acceptation d'une demande réelle de bout en bout (aucune demande de test créée), affichage navigateur de la liste avec la durée.
- **À faire :** décider si les formules payantes de mise à la une doivent aussi proposer 30, 60 ou 90 jours (actuellement 7 et 30 jours, à créer dans « Abonnements & formules »).

### Personnalisation du site regroupée (18/11/2026, demande du propriétaire)
- **Réalisé :** les trois écrans « Paramètres plateforme », « Page d’accueil » et « SEO, logo & pages légales » sont remplacés par un seul écran « Personnalisation du site » (onglets : Identité & contact, Page d’accueil, Référencement, Logo, Pages légales, Sécurité). Les anciennes adresses (#/settings, #/homepage, #/seo) ouvrent l’onglet correspondant. Les formulaires et leurs enregistrements sont inchangés (mêmes routes).
- **Vérifié :** tests 315/315 ; navigateur (superadmin) : les six onglets s’affichent, une seule section visible à la fois, anciennes adresses OK, aucune erreur console.
- **Non vérifié :** enregistrement effectif de chaque section depuis l’écran (routes inchangées, non rejouées une à une) ; production.

## Personnalisation du site : audit des réglages (session du 2026-11-18)
- **À réaliser :** vérifier que chaque réglage de « Personnalisation du site » est relié à l'API, supprimer les doublons.
- **Constat :** l'ancienne page `/admin-settings.html` (non liée) n'était chargée par aucune page : couleurs et modules du superadmin n'avaient aucun effet ; les textes d'accueil (`welcome_title/subtitle`) n'avaient aucune cible dans le site (doublon de la page d'accueil).
- **Réalisé :**
  - Onglet « Apparence & modules » ajouté à la personnalisation (couleurs principale/accent, modules CRM et Premium) ; enregistrement via `PUT /staff/superadmin-settings/main` en conservant les autres clés.
  - Carte et WhatsApp affichés comme « non reliés » (pas de bouton fictif).
  - Libellé de la couleur d'accent de l'accueil précisé (accueil seulement).
  - `public/js/app.js` charge `bootstrap-settings.js` : couleurs et masquage des liens `data-module` appliqués au site public, réappliqués au rendu des pages.
  - Suppression de `public/admin-settings.html` et `public/js/pages/admin-settings.js` (orphelins) ; `/admin-settings(.html)` redirige en 301 vers `/owner#/customize`.
  - Service worker re-estampillé (`ika-so-43c6e19c37`).
- **Vérifié :** `npm test` 315/315 (exit 0) ; `node --check` OK ; redirections 301 ; `bootstrap-settings.js` servi 200 ; `/api/superadmin-settings/public` 200.
- **En cours :** test navigateur de l'onglet « Apparence & modules » et de l'application réelle des couleurs (non fait).
- **À faire :** validation propriétaire ; branchement réel de la carte et de WhatsApp si voulu ; décider si les textes d'accueil restent stockés (aucun effet actuellement).
- **Risques :** la couleur saisie remplace le thème en mode sombre (variables inline `--leaf`/`--gold`). Le masquage du module Premium ne masque que les liens, pas la route `#/premium`.

## Fusion dans main (2026-11-18)
- **Réalisé :** `feat/devenir-premium` fusionné dans `main` (commit `1357423`, sur `origin/main` `82214dc` qui contenait la nouvelle Boîte et l'appel Passez Premium). Sw re-estampillé.
- **Vérifié :** `npm test` 315/315 sur l'état fusionné (exit 0) ; push `main` sans force.
- **Retour arrière :** `backup/main-avant-fusion-2026-11-18` pointe sur `82214dc` (état de `main` avant fusion). Tag non poussé (refusé par le dépôt).
- **À faire :** vérification réelle sur le site par le propriétaire ; mise à jour du tableau Excel (lignes ajoutées uniquement).

## Android : connexion Google native (branche feat/android-google-natif, 2026-11-18)
- **À réaliser :** connexion Google dans l'application sans ouvrir le navigateur.
- **Réalisé :** route serveur `POST /api/auth/google/native` (vérifie l'ID token via tokeninfo, audience = GOOGLE_CLIENT_ID, pose la session) ; app Android 1.0.5 (versionCode 6) : sélecteur de compte Credential Manager, `NativeGoogleSignIn.kt`, bouton Google sans navigateur.
- **Vérifié :** `npm test` 318/318 (exit 0) dont tests des revendications ID token ; compilation Android NON vérifiée (pas de SDK Android dans l'environnement).
- **En cours :** APK à construire dans Android Studio par le propriétaire (GOOGLE_WEB_CLIENT_ID à fournir ; client Android OAuth avec le SHA-1 de la clé).
- **À faire :** « Lier Google » depuis le profil passe encore par le navigateur (non traité).
- **Risques :** Google refuse les WebViews : toute connexion hors sélecteur natif reste bloquée.

## Certification Premium en 3 étapes (branche feat/premium-etapes-validation, 2026-11-20)
- **À réaliser :** dossier Premium : téléphone vérifié → demande avec les champs existants → délai d'étude annoncé → notification à l'approbation ; côté admins, 3 étapes (1 Étude, 2 Vérification, 3 Confirmation) réalisables en parallèle, chaque validation tracée (qui, quand) ; si le paiement Premium est ouvert, les étapes viennent après paiement ; bouton « Activer le paiement Premium » personnalisable.
- **Réalisé :** migration 075 (table `ika_premium_request_steps`, colonnes `paid`, `review_due_at`, rollback fourni) ; services `completeStep` / `undoStep` (motif obligatoire, audit `PREMIUM_STEP_DONE/UNDONE`) ; approbation impossible tant que 3/3 non validées ; routes `/staff/premium-requests/:id/steps/:step[/undo]` ; Centre owner : cartes de dossier avec 3 étapes, qui/quand, « Finaliser (certifier) » ; Boîte staff « étapes x/3 » et retard ; page `devenir-premium` : délai annoncé, date limite, progression, historique ; réglages paiement : texte du bouton, note, délai (1–30 j).
- **Vérifié :** `npm test` 373 réussis / 0 échec ; flux complet sur PostgreSQL local (création, étape en double refusée, approbation anticipée refusée, annulation avec motif, approbation, lignes d'audit) ; captures navigateur : panneau owner et page utilisateur (mode manuel et mode paiement ouvert).
- **Non vérifié :** production ; paiement réel (non ouvert) ; notifications reçues sur appareil.
- **Décisions à confirmer par le propriétaire :** (a) un même admin peut valider les 3 étapes (pas de règle « deux personnes ») ; (b) dossier refusé après paiement : le Premium payé reste actif, remboursement à traiter à part ; (c) « paiement en ligne ouvert » sert de bouton « Activer le paiement Premium » ; (d) paiement ouvert ⇒ Premium actif requis avant le dossier ; (e) les noms d'admins ne sont pas montrés à l'utilisateur ; (f) notification utilisateur seulement à la décision finale.
- **À faire :** vérification réelle par le propriétaire ; mettre à jour les anciennes sections mentionnant RCCM/titre.
- **Risques :** aucun remboursement automatique ; migration 075 appliquée au démarrage (rollback disponible).

### Décisions du propriétaire sur les 3 étapes (21 novembre 2026) — branche feat/premium-decision-sms
- **Tranchées par le propriétaire :** (a) oui, un même admin peut valider les 3 étapes, sans obligation (plusieurs admins possibles) ; (c) oui, le réglage « paiement en ligne ouvert » sert de bouton « Activer le paiement Premium » ; (e) oui, les noms d'admins restent visibles côté équipe seulement ; (f) l'utilisateur n'est notifié qu'à la décision finale, par notification interne, SMS et WhatsApp si disponible ; (b) un dossier refusé après paiement laisse le Premium payé actif, sans remboursement automatique : **un suivi de remboursement, avec des étapes, sera fait** (voir « À faire »).
- **Relu dans le code (déjà conforme, aucune modification) :** (a) `completeStep` n'impose aucune règle « deux personnes » ; (e) la vue annonceur (`userView`) n'expose que l'avancement `progress`, jamais `done_by` ; (f) `completeStep` / `undoStep` ne notifient pas, seules les décisions (`decide`) le font ; (b) `decide` REJECT ne touche pas à `premium_until`.
- **Réalisé :** `server/lib/notifier.js` : le type `PREMIUM` (décision finale seulement : approuvé, certifié, refusé) part aussi par SMS, texte générique (jamais le motif), avec les règles existantes : opt-in de la personne, numéro confirmé par vrai SMS, fournisseur SMS configuré, 5 SMS par jour.
- **Vérifié :** `node --test` sur `notifier-premium`, `premium-etapes`, `premium-certification` : 13 réussis, 0 échec (nouveau test : SMS sans motif ; aucun SMS sans opt-in, sans numéro confirmé ou en mode démonstration). `npm test` complet : non exécuté (dépendances non installables ici). Rendu navigateur et SMS réel : non exécutés.
- **WhatsApp : non branché.** Un message WhatsApp envoyé à l'initiative de l'entreprise exige un modèle (template) approuvé par Meta et peut être facturé : service payant, à valider par le propriétaire avant tout branchement (`createWhatsApp.sendTemplate` existe déjà côté code).
- **À faire (attend le propriétaire) :** (1) suivi de remboursement avec étapes pour un dossier refusé après paiement : étapes à confirmer (proposition : 1 Demande enregistrée et paiement vérifié, 2 Remboursement fait chez le fournisseur, 3 Confirmation à l'utilisateur ; même principe que les 3 étapes Premium, traçabilité par personne ; s'appuie sur `markRefunded` / `refund_confirmed_at` de `payments.js`) ; (2) WhatsApp : valider le coût et le modèle de message.
- **Risques :** faibles (un type de notification de plus par SMS, uniquement pour ceux qui ont activé les SMS). Retour arrière : `git revert -m 1 <fusion>`, aucune migration.

### Suivi de remboursement Premium (21 novembre 2026) — branche feat/premium-remboursement-suivi
- **À réaliser :** décision (b) du propriétaire : un dossier refusé après paiement laisse le Premium payé actif ; le remboursement n'est pas automatique ; il est suivi avec des étapes. Le propriétaire a répondu « Continuez » à ma proposition d'étapes : **étapes retenues = proposition (1 Paiement vérifié, 2 Remboursement effectué, 3 Annonceur informé), à confirmer par le propriétaire.**
- **Réalisé :** migration 076 (`ika_premium_refunds`, `ika_premium_refund_steps`) + retour arrière `scripts/rollback/076_premium_remboursements_down.sql` ; `premium-requests.js` : refus d'un dossier payé ouvre un suivi (une seule fois par dossier), `completeRefundStep` / `undoRefundStep` (étapes indépendantes, trace de la personne, motif obligatoire au retrait, audit `PREMIUM_REFUND_STEP_DONE/UNDONE`), la 3e étape validée clôt le suivi et notifie l'annonceur (seule notification, décision finale) ; `listForStaff` renvoie `refunds` ; routes `POST /staff/premium-refunds/:id/steps/:step[/undo]` (délégation `payments`, comme les étapes Premium) ; Centre owner : panneau « Remboursement à suivre » par dossier. Les noms d'admins restent côté équipe.
- **Vérifié :** `node --test test/*.test.js` : 393 tests, 379 réussis, 0 échec (reste : tests base ignorés) ; 3 nouveaux tests (ouverture au refus payé seulement, étapes et notification à la 3e, retrait et suivi clôturé). **PostgreSQL 16 réel** : toutes les migrations 001-076 appliquées ; insertion, doublon d'étape ignoré, requête de liste, clôture, retrait, contraintes (étape 4 et statut invalides refusés), suppression en cascade, retour arrière puis réapplication.
- **Non vérifié :** routes HTTP (dépendances non installables ici, serveur non lancé) ; rendu navigateur du panneau ; envoi réel du SMS/notification ; site déployé.
- **Limites :** le suivi ne rembourse rien chez le fournisseur : l'étape 2 est une validation manuelle (le remboursement réel se fait chez le fournisseur ; `payments.markRefunded` reste séparé). Les dossiers payés refusés AVANT cette version n'ont pas de suivi (aucun backfill).
- **À faire :** confirmation des étapes par le propriétaire ; vérification réelle sur le site (refuser un dossier payé de test, valider les 3 étapes) ; WhatsApp toujours en attente de validation (service payant).
- **Risques :** migration 076 appliquée au démarrage (rollback fourni). Retour arrière : `git revert -m 1 <fusion>` puis le script de rollback si la migration a été jouée.

### Conditions officielles + exceptions tracées (« jurisprudence ») (21 novembre 2026) — branche feat/regles-exceptions
- **À réaliser (demande du propriétaire) :** aucune condition figée dans le code. Deux couches : (1) **conditions officielles**, décidées par le superadmin ; (2) **exceptions** (jurisprudence) qui lèvent une condition pour un compte, par décision du superadmin ou des admins, avec **traçabilité de qui a validé, visible dans la fiche du compte du Owner Center**.
- **Réalisé :**
  - Migration 077 (`ika_rule_exceptions` : compte, condition, motif obligatoire, auteur, date, durée facultative, révocation avec auteur et motif ; une seule exception active par compte et condition ; rien n'est supprimé) + retour arrière `scripts/rollback/077_exceptions_regles_down.sql`.
  - `server/lib/account-rules.js` : conditions officielles (réglage superadmin `account_rules`) = numéro confirmé pour le Premium (oui par défaut), **étapes exigées** pour approuver (1, 2, 3 par défaut, au choix du superadmin), **qui peut accorder une exception** (superadmin seul par défaut, ou aussi les administrateurs). **Valeurs par défaut = comportement d'avant : rien ne change tant que le superadmin ne décide pas autrement.**
  - `server/services/rule-exceptions.js` : `saveOfficial` (superadmin, avant/après tracés `RULES_UPDATE`), `grant` / `revoke` (rôle décidé par le superadmin, motif obligatoire, audit `RULE_EXCEPTION_GRANT/REVOKE`), `activeKeys`, `listForUser`.
  - Application : `premium-requests.js` (numéro, étapes exigées, étapes levées par exception ; l'audit d'approbation enregistre `rules` : étapes exigées, étapes levées, exceptions utilisées) et `payments.js` (numéro avant paiement Premium, même règle).
  - Routes : `GET/PUT /staff/rules` ; `POST /staff/owner/users/:id/rule-exceptions` et `POST /staff/rule-exceptions/:id/revoke` (délégation « users ») ; `GET /staff/owner/users/:id/analysis` renvoie aussi `premiumFiles`, `ruleExceptions`, `rules`.
  - Owner Center : écran **« Conditions & exceptions »** (superadmin ; lecture seule pour les autres) ; **fiche du compte** : panneaux « Dossiers Premium et validations » (qui a validé quelle étape et quand, décision, suivi de remboursement) et « Exceptions aux conditions » (accorder, révoquer, historique). Les noms restent côté équipe.
- **Vérifié :** `node --test test/*.test.js` : 400 tests, 386 réussis, 0 échec (reste : tests base ignorés) ; 8 nouveaux tests `regles-exceptions` (valeurs par défaut, droits superadmin/admin, étapes exigées modifiées sans toucher au code, exception tracée dans l'audit, unicité et révocation, qui peut accorder, numéro levé par la règle ou par exception). Le test qui lisait le code source a été adapté (appel du numéro désormais conditionné par la règle). **PostgreSQL 16 réel** : migrations 001-077 ; requêtes du service (accorder, doublon refusé, liste avec noms, historique du compte, étapes levées), révocation puis ré-attribution, retour arrière puis réapplication.
- **Non vérifié :** routes HTTP (serveur non lancé, dépendances non installables ici ; syntaxe contrôlée) ; rendu navigateur des deux panneaux et de l'écran ; site déployé.
- **Limites / à décider :** (1) **Étapes de remboursement** (3) et **règle « paiement ouvert ⇒ Premium actif avant le dossier »**, **un dossier en attente à la fois**, **durée 1 à 3 mois**, **accès au centre = Premium actif + numéro confirmé**, **plafonds (annonces, etc.)** restent dans le code : à passer en conditions officielles au fil des besoins (même mécanisme : une clé dans `account-rules.js` + une exception possible). (2) Une exception ne couvre aujourd'hui que : numéro non confirmé, et chacune des 3 étapes. (3) Aucune exception n'est notifiée à l'annonceur.
- **Risques :** le superadmin peut désormais décocher toutes les étapes : l'approbation devient possible sans validation (choix assumé, tracé `RULES_UPDATE`). Migration 077 appliquée au démarrage. Retour arrière : `git revert -m 1 <fusion>` puis le script de rollback si la migration a été jouée.

### Onglet « Découvrir » : publications de la communauté (21 novembre 2026) — branche feat/decouvrir-publications
- **À réaliser (demande du propriétaire) :** zone « Nouvelle publication » plus avancée (texte, photos, vidéos, comme Facebook) pour que tout compte, annonceur ou non, publie un vœu (maison, terrain…), une information ou une actualité ; un autre utilisateur ou annonceur peut les joindre pour discuter ; ce n'est pas une annonce ; nouvel onglet « Découvrir » séparé des annonces professionnelles.
- **Réalisé :**
  - Migration 078 (+ retour arrière `scripts/rollback/078_decouvrir_down.sql`) : `ika_publications` étendue (type `ACTUALITE` / `RECHERCHE` « Je cherche » / `INFORMATION`, type de bien, quartier, statut publiée/masquée, masquage tracé), `ika_publication_photos`, `ika_publication_reports`, et conversations rattachables à une publication (`ika_threads.publication_id`, `listing_id` devient facultatif, une conversation par publication et par visiteur).
  - Backend : `server/services/discover.js` (fil public paginé avec filtres, publication, signalement, modération), `server/lib/discover.js` (types, détecteur de numéro de téléphone), `engagement.sendToPublication` (même messagerie que pour une annonce : blocages, plafonds, notification), lecture des photos (`file-storage.js` : publique tant que la publication n'est pas masquée, toujours visible de l'auteur et de l'équipe), `orphan-files.js` (une photo de publication n'est jamais orpheline), routes `GET /discover`, `GET /discover/settings`, `POST /me/discover`, `POST /discover/:id/contact`, `POST /discover/:id/report`, `GET /staff/discover/reports`, `POST /staff/discover/:id/hide|restore` (module « modération »).
  - **Réglages du superadmin** (écran « Conditions & exceptions », rien en dur) : Découvrir ouvert ou fermé, photos par publication (0 à 6, défaut 4), publications par compte et par 24 h (défaut 5), numéro confirmé exigé pour publier (défaut non).
  - Interface : composeur partagé (`components/post-composer.js` : type, texte, bien et quartier facultatifs, photos réduites dans le navigateur) utilisé dans Découvrir et dans le profil ; page `#/decouvrir` (filtres type et bien, « Écrire », « Signaler », « Supprimer » pour l'auteur) ; entrée « Découvrir » dans le menu du haut et le menu mobile ; la conversation s'ouvre dans la messagerie existante ; Owner Center : écran « Publications Découvrir » (signalées ou masquées, masquer avec motif obligatoire, rétablir, nom et date conservés dans l'audit) ; plan du site mis à jour (S43) ; version du cache hors connexion régénérée.
  - Règles de contenu : pas de numéro de téléphone dans le texte (+223, 76 00 00 00, 76000000 refusés ; les prix « 25 000 000 » passent), pas de lien direct d'achat ; contact uniquement par la messagerie.
- **Vérifié :** `node --test test/*.test.js` : 408 tests, 394 réussis, 0 échec (8 nouveaux dans `decouvrir.test.js` : détecteur, réglages, publication, refus, plafonds du superadmin, signalement, modération tracée, messagerie sur publication). **PostgreSQL 16 réel** : migrations 001-078 ; le SQL réel capturé des nouvelles fonctions (fil avec masquées, comptes bloqués et bannis exclus, filtres, file de modération, création, masquage, rétablissement, conversation sur publication sans doublon, lecture de conversation, lecture des photos public / auteur / équipe), cascade à la suppression, contrainte de sujet, retour arrière puis réapplication. **Navigateur** (Chromium, API simulée) : page Découvrir mobile et ordinateur (1280 et 1110 px), composeur rempli, fenêtre « Écrire », visiteur non connecté ; aucune erreur JavaScript.
- **Non vérifié :** serveur réel (dépendances non installables ici ; routes HTTP et authentification non exécutées), envoi réel d'une photo, écrans Owner Center (syntaxe seulement), site déployé. Les captures utilisaient une API simulée.
- **Limites / décisions à prendre :**
  1. **Vidéos non prises en charge.** Les fichiers sont stockés dans PostgreSQL (Neon), limités à 2 Mo ; une vidéo exige un stockage dédié (service payant) : à valider par le propriétaire avant tout branchement.
  2. **Modération après publication** : une publication est visible tout de suite ; l'équipe agit sur signalement. Une validation avant publication est possible si le propriétaire la veut.
  3. **Les anciennes publications de profil apparaissent dans Découvrir** (type « Actualité »), car c'est la même table.
  4. La barre du bas du mobile reste à 5 entrées (règle du code) : Découvrir est dans le menu mobile, pas dans la barre ; à arbitrer si le propriétaire veut l'y mettre.
  5. Les photos ajoutées à la page publique d'un annonceur ne s'y affichent pas encore (elles apparaissent dans Découvrir et dans le profil de la personne).
  6. Les exceptions par compte (jurisprudence) ne couvrent pas encore Découvrir.
- **À faire :** vérification réelle par le propriétaire sur le site (publier avec photo, écrire depuis un autre compte, signaler, masquer côté Owner Center) ; décisions 1 à 4 ci-dessus.
- **Risques :** migration 078 appliquée au démarrage de Render ; le retour arrière supprime les publications « Je cherche » / « Information », leurs photos, signalements et conversations ouvertes depuis une publication (les annonces et les actualités simples restent). Retour arrière : `git revert -m 1 <fusion>` puis `scripts/rollback/078_decouvrir_down.sql`.

### Cadre du profil dans la carte « Annonceur » de la fiche annonce (21 novembre 2026) — branche feat/fiche-annonceur-photo
- **À réaliser (demande du propriétaire) :** afficher le cadre du profil (couverture et photo) dans la carte profil annonceur de la fiche d'une annonce.
- **Réalisé :** `public/js/pages/listing.js` + `public/css/components.css` : la carte « Annonceur » reprend le cadre du profil public (couverture, photo ou initiales à défaut, nom, rôle, puis avis, niveau de confiance et « Voir le profil »). Aucune modification du serveur : l'API `/advertisers/:id` fournit déjà `profile.coverUrl` et `profile.avatarUrl`, et ne les renvoie pas si l'annonceur ou la modération a masqué ses images. Version du cache hors connexion régénérée.
- **Vérifié :** tests complets sans échec ; navigateur (API simulée) : carte avec photo et couverture, sans image (dégradé et initiales), thème sombre, mobile ; aucune erreur JavaScript.
- **Non vérifié :** rendu avec de vraies photos de profil sur le site déployé ; affichage ordinateur de la fiche.
- **À faire :** vérification réelle par le propriétaire. Interprétation retenue de la demande : « cadre du profil » = couverture + photo de profil ; à corriger si le propriétaire attendait autre chose.
- **Risques :** faibles (affichage seulement). Retour arrière : `git revert -m 1 <fusion>`, aucune migration.
