# SUIVI D'ÉVOLUTION — IKA SO (ordonnances consolidées v1.0)

Ce fichier complète `SUIVI.md` (historique du projet, conservé tel quel). Il suit l'exécution des ordonnances du 3 novembre 2026.

## Règles de conduite permanentes (en vigueur depuis le 4 novembre 2026, confirmées et précisées le 4 novembre 2026)
1. **À chaque réponse**, livrer le projet complet (archive) avec les documents de suivi, mis à jour **à partir du 4 novembre 2026** (date, phase, réalisé / en cours / restant, preuves, limites).
2. **Chaque question est posée avec des propositions de recommandations** conformes aux règles du métier immobilier, **numérotées par ordre de priorité** (1 = recommandation principale). Le propriétaire répond par le numéro choisi.
3. **Décision bloquante** : si l'agent n'arrive pas à trancher, il recherche sur le web ce que font les acteurs déjà présents sur le marché et les règles du métier, puis propose des recommandations numérotées (voir `RECOMMANDATIONS_METIER.md`), en précisant la fiabilité des sources.
4. Ne rien déclarer terminé sans preuve ; ne modifier ni code ni base sans autorisation de phase.

## Livraison n° 32 — 10 novembre 2026 — Rappel 30 jours avant la suppression des pièces de demandes annonceur
**Décision du propriétaire :** « Oui » au rappel envoyé au titulaire avant l'échéance de conservation (livraison 31).
**RÉALISÉ (tests de logique, base simulée) :** (1) migration **051** `documents_expiry_notified_at` (additive, retour arrière `scripts/rollback/051_…_down.sql`) ; (2) `notifyExpiringDocuments()` : demandes approuvées ou refusées dont l'échéance tombe dans les 30 jours, **un seul rappel par échéance** (l'UPDATE … RETURNING marque d'abord, puis notifie : pas de doublon entre deux instances), aucun rappel pour une échéance déjà passée, un échec de notification n'empêche pas les autres ; notification « Vos pièces jointes seront supprimées le jj/mm/aaaa » avec lien vers « Devenir annonceur » ; (3) le renouvellement remet le rappel à zéro (nouvelle échéance, nouveau rappel possible) ; (4) minuterie de 6 h dans `server/index.js` (même principe que les résumés d'alertes ; non destructive : **elle n'efface rien**, la suppression reste la commande manuelle `scripts/retention.mjs`).
**PREUVES :** `test/advertiser-applications.test.js` (20 tests) ; 5 fichiers de test de l'archive : tous réussis ; `stamp-sw --check` à jour.
**LIMITES :** migrations 050 et 051 jamais exécutées sur PostgreSQL ; tant que la 051 n'est pas appliquée, la minuterie journalise une erreur (`rappels_pieces_echec`) sans autre effet ; notification dans le site seulement (pas d'e-mail ni SMS dédié : les canaux d'alerte existants s'appliquent selon les préférences du compte) ; rappel envoyé une fois : si le titulaire n'ouvre pas ses notifications, les pièces seront quand même supprimées à la prochaine purge manuelle.
**RESTANT :** appliquer 050 puis 051 sur Render ; lancer la purge manuelle quand vous le décidez ; essai PostgreSQL et navigateur.
**Fichiers :** créés `migrations/051_application_documents_reminder.sql`, `scripts/rollback/051_application_documents_reminder_down.sql` ; modifiés `server/services/advertiser-applications.js`, `server/index.js`, `test/advertiser-applications.test.js`.

## Livraison n° 31 — 10 novembre 2026 — Conservation des pièces de demandes annonceur : une année renouvelable
**Décision du propriétaire :** les pièces jointes aux demandes annonceur (pièce d'identité, RCCM, autres) sont conservées **une année, renouvelable**.
**RÉALISÉ (tests de logique, base simulée) :** (1) migration **050** `documents_expire_at` (additive, retour arrière `scripts/rollback/050_…_down.sql`) ; les demandes déjà approuvées ou refusées reçoivent une échéance = date de décision + 1 an ; (2) à l'approbation ou au refus, l'échéance est posée à +1 an (aucune échéance pour « informations demandées », la demande reste ouverte) ; (3) **renouvellement** par le titulaire (`POST /me/advertiser-applications/:id/documents/renew`) : repart d'aujourd'hui pour un an, jamais cumulé, seulement sur ses propres demandes décidées dont les pièces sont encore là ; bouton « Conserver une année de plus » et date de suppression affichés dans « Devenir annonceur » ; (4) **purge** ajoutée à `server/lib/retention.js` (commande manuelle existante `node scripts/retention.mjs`, simulation par défaut, `--apply --confirm=PURGER`) : fichiers effacés, liste des pièces vidée, **décision et note de l'équipe conservées**.
**PREUVES :** `test/advertiser-applications.test.js` (17 tests) ; 5 fichiers de test de l'archive : tous réussis ; `stamp-sw --check` à jour.
**LIMITES :** migration 050 et requêtes de purge jamais exécutées sur PostgreSQL ; la purge reste **manuelle** (règle du projet : jamais de minuterie) : sans lancement de `scripts/retention.mjs`, rien n'est supprimé ; aucun rappel envoyé au titulaire avant l'échéance (seul l'affichage dans « Devenir annonceur ») ; le renouvellement est illimité tant que le titulaire le demande ; durée à faire valider par un juriste malien.
**RESTANT :** appliquer la migration 050 (Render : à chaque mise à jour) ; rappel avant échéance (notification) si vous le souhaitez ; essai PostgreSQL et navigateur.
**Fichiers :** créés `migrations/050_application_documents_retention.sql`, `scripts/rollback/050_application_documents_retention_down.sql` ; modifiés `server/services/advertiser-applications.js`, `server/routes/index.js`, `server/lib/retention.js`, `public/js/pages/advertiser-apply.js`, `public/sw.js`, `test/advertiser-applications.test.js`.

## Livraison n° 30 — 10 novembre 2026 — Pièces facultatives pour toutes les demandes annonceur (particulier et agence)
**Décision du propriétaire :** dans « Devenir annonceur », pour un particulier comme pour une agence, le registre de commerce et les autres pièces sont **facultatifs**.
**RÉALISÉ (tests de logique, base simulée) :** (1) formulaire : aucune pièce obligatoire ; particulier : pièce d'identité et « RCCM ou autre justificatif » ; agence : RCCM (circuit des pièces d'agence, inchangé) + pièce d'identité + autre justificatif ; fichiers contrôlés avant l'envoi, si une pièce échoue la demande est quand même enregistrée et le message le dit ; (2) pièces rangées dans `ika_advertiser_applications.documents` (colonne de la migration 049, **aucune migration nouvelle**), fichier dans `stored_files`, 5 pièces au plus, photo ou PDF de 700 Ko au plus ; (3) routes `POST /me/advertiser-applications/:id/documents` (limitée à 10 par heure) et `GET /staff/advertiser-applications/:id/documents/:documentId` (équipe, lecture journalisée `VIEW_APPLICATION_DOCUMENT`, seulement une pièce réellement jointe à cette demande, `no-store`) ; (4) une demande « informations complémentaires demandées » compte comme demande ouverte : le candidat la complète (message de l'équipe affiché, bouton « Ajouter une pièce ») au lieu d'en créer une seconde ; (5) l'équipe voit les boutons « Voir » de chaque pièce, ou « Aucune pièce jointe (facultatif) » ; l'approbation n'exige aucune pièce ; (6) **le nettoyage manuel des fichiers orphelins** (`server/lib/orphan-files.js`) tient compte des pièces de demandes, sinon il les aurait supprimées ; (7) **droits des personnes** (`rights.js`) : l'export inclut les demandes (étiquette et type des pièces, jamais le contenu) ; la suppression du compte supprime les demandes et les fichiers joints.
**PREUVES :** `test/advertiser-applications.test.js` (14 tests) ; 5 fichiers de test de l'archive : tous réussis ; `stamp-sw --check` à jour.
**LIMITES :** requêtes (dont `jsonb_array_elements` du nettoyage) jamais exécutées sur PostgreSQL ; envoi et ouverture de fichiers jamais essayés dans un navigateur ; pas de suppression d'une pièce par le candidat ; pièces d'une demande non purgées après décision (durée de conservation à fixer avec le juriste : pièce d'identité).
**RESTANT :** essai PostgreSQL et navigateur ; durée de conservation des pièces d'identité ; test de la suppression de compte avec pièces de demande (modifiée mais non testée : la suite `droits-*` n'est pas dans cette archive).
**Fichiers :** modifiés `server/services/advertiser-applications.js`, `server/routes/index.js`, `server/lib/orphan-files.js`, `server/services/rights.js`, `public/js/{admin.js,pages/advertiser-apply.js}`, `public/sw.js`, `test/advertiser-applications.test.js`.

## Livraison n° 29 — 10 novembre 2026 — Décision sur la modification d'annonces ; RCCM des agences relié à la demande
**Décision du propriétaire :** un compte qui a déjà des annonces **peut les modifier** même sans demande annonceur approuvée. La restriction de la livraison 28 sur `listings.update` est **retirée** ; seule la création d'annonce (et l'import CSV, qui crée) exige l'approbation.
**RÉALISÉ (tests de logique, base simulée) :** (1) la demande « agence » propose le dépôt du **RCCM** (photo ou PDF, 700 Ko) ; il passe par le circuit existant des pièces (`/me/proofs`, type AGENCE, contrôle ADMIN, badge « Agence vérifiée » seulement après acceptation) : aucune nouvelle table, la colonne `documents` de la migration 049 reste inutilisée ; si l'envoi du RCCM échoue, la demande est quand même enregistrée et le message l'indique ; (2) la liste de l'équipe affiche l'état du dernier RCCM du candidat (aucun / à contrôler / accepté / refusé), sans exposer le fichier ; l'approbation de la demande n'exige pas le RCCM (le badge « Agence vérifiée » reste une décision séparée).
**PREUVES :** `test/advertiser-applications.test.js` (9 tests) ; 5 fichiers de test de l'archive : 41 tests, 0 échec ; `stamp-sw --check` à jour.
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; envoi de fichier jamais essayé dans un navigateur ; l'identification entre la demande et la pièce se fait par compte (dernier RCCM du compte), pas par un lien direct.
**RESTANT :** essai PostgreSQL et navigateur ; décider si l'approbation d'une agence doit exiger un RCCM accepté.
**Fichiers :** modifiés `server/services/{listings,advertiser-applications}.js`, `public/js/{admin.js,pages/advertiser-apply.js}`, `public/sw.js`, `test/advertiser-applications.test.js`.

## Livraison n° 28 — 10 novembre 2026 — Demandes annonceur : restriction de publication complétée, notifications, tests
**Phase :** suite du fichier `IKA_SO_Suivi_Projet.xlsx` (lignes « Devenir annonceur », « Publication », « Agences »).
**RÉALISÉ (tests de logique, base simulée) :** (1) la restriction « annonceur approuvé » s'applique aussi à la **modification d'une annonce** (`listings.update`, qui la remet en modération) et dès le **contrôle à blanc de l'import CSV** (`imports.importCsv`) ; (2) identifiant de demande aléatoire (`randomUUID`) au lieu de `Date.now()` ; (3) décision : une demande déjà traitée ne se retraite pas, motif obligatoire pour refuser ou demander des infos, action filtrée sur une liste fermée, **journal d'audit** et **notification** au candidat (échec de notification sans effet sur la décision) ; (4) bouton « Demander des infos » dans l'admin ; (5) l'écran de publication renvoie vers `#/devenir-annonceur` quand l'API refuse faute d'approbation (le brouillon est conservé) ; (6) `advertiser-apply.js` ajouté au préchargement du service worker (absent avant).
**DÉFAUT CORRIGÉ (présent dans la v28) :** `public/js/pages/advertiser.js` avait une virgule à la place d'un point-virgule (ligne 142) : **erreur de syntaxe**, la page du profil public annonceur ne pouvait pas se charger, et `test/advertiser-profile-page.test.js` échouait.
**PREUVES :** `test/advertiser-applications.test.js` (8 tests) ; suite des 5 fichiers de test de l'archive : tous réussis ; `node scripts/stamp-sw.mjs --check` à jour.
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; écrans jamais vus dans un navigateur ; seuls 5 fichiers de test sont dans cette archive (les suites des livraisons précédentes n'y figurent pas) ; un compte USER ayant déjà des annonces mais sans demande approuvée ne pourra plus les modifier (comportement voulu, à confirmer) ; justificatifs d'agence (colonne `documents`) toujours non branchés.
**RESTANT :** dépôt des justificatifs d'agence ; essai PostgreSQL et navigateur.
**Fichiers :** modifiés `server/services/{listings,imports,advertiser-applications,index}.js`, `public/js/{admin.js,pages/publish.js,pages/advertiser.js}`, `public/sw.js` ; créé `test/advertiser-applications.test.js`.

## Livraison n° 27 — 7 novembre 2026 — Réclamations : notes internes invisibles du plaignant (constat n° 1 de la livraison 26)
**Phase :** conformité et confidentialité, option 2 choisie par le propriétaire.
**RÉALISÉ (tests de logique, base simulée) :** migration `040_complaint_comment_visibility.sql` (colonne `visible_to_complainant`, **défaut = note interne**, anciens commentaires de l'équipe devenus internes) + retour arrière ; lecture côté plaignant : **ses propres commentaires et les réponses que l'équipe lui a rendues visibles, jamais les notes internes**, réponses de l'équipe étiquetées « (Équipe Ika So) » ; colonnes **explicites** (plus de `select *` : l'affectation interne n'est plus renvoyée) ; côté équipe : `addComplaintComment(..., visibleToComplainant)` visible **seulement si exactement `true`**, question posée à l'écran (« réponse visible » ou « note interne »), choix inscrit au journal ; identifiants de commentaires **aléatoires** (constat n° 2 : plus de télescopage).
**PREUVES :** `test/complaints-visibility.test.js` (10 tests) ; suite complète ici : 447 tests, 446 réussis, 0 échec, 1 ignoré (Express de substitution, pas de PostgreSQL).
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; écrans du personnel et du plaignant à base de fenêtres du navigateur (`prompt`, `confirm`), jamais vus en vrai ; les autres identifiants à base de `Date.now()` dans `stats.js` (réclamations, sauvegardes, offres, campagnes…) restent à remplacer ; le plaignant n'est pas notifié d'une réponse.
**RESTANT :** essai PostgreSQL (bloquant) ; retours arrière 029 à 038 ; 041 deux emplacements Superadmin, 042 MFA (renumérotées) ; avis juridique ; erreurs 500 des anciennes validations `/staff/owner/*`.
**Fichiers :** créés `migrations/040_complaint_comment_visibility.sql`, `scripts/rollback/040_complaint_comment_visibility_down.sql`, `test/complaints-visibility.test.js` ; modifiés `server/services/stats.js`, `server/routes/index.js`, `public/js/admin.js`, `public/js/pages/complaints.js`, `public/sw.js` (version), `PLAN_ROLES_PERMISSIONS.md`, suivis.

## Livraison n° 26 — 7 novembre 2026 — Droits des personnes : newsletter et réclamations (écart n° 2 de la livraison 25)
**Phase :** conformité (loi n° 2013-015 : accès et suppression). Option 2 choisie par le propriétaire.
**RÉALISÉ (tests de logique, base simulée) :** dans `server/services/rights.js` — **export** : consentement newsletter (date), réclamations déposées par le compte (motif, détail, statut, résolution), commentaires de réclamation écrits par le compte ; **suppression de compte** : consentement newsletter **effacé** (y compris quand la ligne utilisateur est conservée pour la comptabilité), commentaires de réclamation **anonymisés** (auteur retiré, texte remplacé par « commentaire supprimé à la demande de son auteur »), réclamations **détachées** de la personne (auteur et détail retirés) sans supprimer le dossier ; le suivi de la modération reste.
**Écart supplémentaire trouvé et corrigé :** les réclamations d'annonces (`ika_reports`, avec le texte libre de la personne) n'étaient **ni exportées ni traitées** à la suppression, déjà avant l'archive avancée (elles dataient de ma version).
**PREUVES :** `test/droits-reclamations.test.js` (7 tests : export paramétré par compte, suppression avec et sans historique de paiement, dossier conservé, aucun effet si mot de passe ou confirmation faux, cohérence avec les migrations 003, 033, 038, 039) ; suite complète ici : 437 tests, 436 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; le choix « anonymiser plutôt que supprimer » les commentaires et réclamations est le mien (garder l'historique du dossier) : **à confirmer avec le juriste** ; la politique de confidentialité ne mentionne pas encore la newsletter.
**Nouveaux constats (non corrigés) :** (1) `myComplaintDetail` renvoie **tous** les commentaires d'une réclamation au plaignant, y compris ceux écrits par le Superadmin (notes internes ?) : à décider (notes internes ou réponses publiques) ; (2) les identifiants de commentaires (`"cc_" + Date.now()`) peuvent se **télescoper** si deux sont créés dans la même milliseconde ; (3) les anciennes validations de `/staff/owner/*` renvoient encore une erreur 500.
**RESTANT :** essai PostgreSQL (bloquant) ; retours arrière 029 à 038 ; deux emplacements Superadmin (040) et MFA (041) ; avis juridique.
**Fichiers modifiés :** `server/services/rights.js`, `test/droits-reclamations.test.js` (nouveau), suivis.

## Livraison n° 25 — 7 novembre 2026 — Reprise du projet avancé (Owner Control v1.2.1) : audit de réception
**Phase :** 0 (audit) appliquée à l'archive `Ika_So_Owner_Control_v1_2_1.zip` transmise par le propriétaire (« Projet avancé »). Cette version devient la **base de travail** ; elle contient tout mon travail jusqu'à la livraison 24 (246 fichiers identiques) et ajoute le travail d'une autre session : migrations **028 à 039**, centre « Owner Control » (58 routes `/staff/owner/*`), pipeline CRM, réclamations, marketing, newsletter, sauvegardes `pg_dump` automatiques, réglages d'accueil, langues et redirections.
**Vérifié ici :** suite complète 430 tests, 429 réussis, 0 échec, 1 ignoré (Express de substitution, pas de PostgreSQL) ; tampon du service worker à jour ; les 58 routes `/staff/owner/*` passent par `requireUser` ; migrations 028 à 039 additives, sauf 038 qui remplace la contrainte de statut de `ika_reports` (élargie à OPEN, IN_PROGRESS, RESOLVED, CLOSED, DISMISSED) ; collecte d'événements toujours **éteinte** par défaut.
**Écarts relevés :**
1. **Fichiers de carte absents** de l'archive (`public/vendor/mapbox-gl.js` et `.css`) : sans eux le fond Mapbox ne s'affiche plus (le plan local prend le relais). **Restaurés** depuis votre archive précédente dans cette livraison.
2. **Droits des personnes** : `ika_newsletter_optin` (consentement newsletter) et `ika_complaint_comments` (auteur) ne sont ni dans l'export ni dans la suppression du compte ; pour un compte ayant un historique de paiement, la ligne utilisateur est conservée (anonymisée), donc le **consentement newsletter subsiste**. **Corrigé en livraison 26.**
3. **Retours arrière** écrits seulement pour 028 et 039 ; **029 à 038 n'en ont pas** (l'ordonnance § 2 les exige).
4. **Deux emplacements Superadmin** : non implémentés (seule la protection du dernier SUPERADMIN existe) ; permissions 025 toujours non branchées sur `requireStaff` ; MFA absente.
5. **Numérotation** : 028 à 039 sont prises ; mes migrations prévues passent à **040 (deux emplacements Superadmin) et 041 (MFA)** (`PLAN_ROLES_PERMISSIONS.md` mis à jour).
6. **Aucune migration (011 à 039) n'a jamais tourné sur PostgreSQL**, ni `pg_dump`, ni la newsletter réelle, ni l'interface dans un navigateur : l'autre session le dit elle-même.
7. Anomalies déjà notées par l'autre session : sauvegarde sur le serveur et non chiffrée ; langues, catégories et campagnes sans effet public ; version du consentement non incrémentée quand les textes légaux changent ; période fixe de 30 jours sur les graphiques ; pas de lien de désabonnement cliquable ; anciennes validations de `/staff/owner/*` qui renvoient une erreur 500.
**Fichiers modifiés par cette livraison :** `public/vendor/*` (restaurés), `PLAN_ROLES_PERMISSIONS.md`, `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. Aucun code applicatif modifié.

## Livraison n° 24 — 7 novembre 2026 — Fiche détaillée d'un annonceur et comparaison de deux annonceurs
**Phase :** 4 (§ 12.2 de l'ordonnance), option 3 choisie par le propriétaire.
**RÉALISÉ (tests de logique) :** `advertiserSheet` et `compareAdvertisers` dans `server/services/stats.js` ; routes `GET /staff/stats/advertisers/:id` et `GET /staff/stats/compare` (**ADMIN et SUPERADMIN**) ; dans l'onglet Statistiques, boutons « Fiche » et « Comparer » sur chaque ligne des classements d'agences et d'autres annonceurs.
**Contenu de la fiche :** identité (nom public, type, agence vérifiée ou non, état du compte et motif, inscription, téléphone et vérification par SMS, **dernière session enregistrée**), annonces par statut, performance de la période (indice, vues, favoris, clics de contact, taux par vue) **comparée à la période précédente**, 5 meilleures annonces, avis (nombre, moyenne), signalements (annonces et compte, ouverts / total), **décisions de l'équipe sur ce compte** (sanctions, photos masquées, changements de rôle).
**Comparaison :** deux annonceurs, mêmes jours, mêmes pondérations, 3 meilleures annonces chacun ; refus de comparer un annonceur avec lui-même.
**Vie privée (§ 16.3) :** **chaque consultation de fiche, et chaque côté d'une comparaison, est inscrite au journal** (`VIEW_ADVERTISER_SHEET`, visible dans l'onglet Journal) ; aucune lecture des événements bruts ; décisions retrouvées par identifiant exact (pas de motif LIKE).
**PREUVES :** `test/stats.test.js` (30 tests au total) ; suite complète ici : 305 tests, 304 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** « dernière session » = dernière session encore enregistrée (une déconnexion peut l'avoir supprimée) : ce n'est pas une dernière connexion certaine ; pas de pays / ville de l'annonceur, pas de fréquence de connexion, pas de taux de conversion complet (demandes de visite et transactions déclarées non agrégées) ; requêtes jamais exécutées sur PostgreSQL (colonnes `ika_reviews`, `ika_reports`, `ika_audit.note` d'après les migrations) ; écran jamais vu en vrai.
**RESTANT :** essai PostgreSQL et navigateur (bloquant) ; avis juridique (accès du personnel aux statistiques individuelles : question 8 du dossier) ; purge de rétention ; agrégats de demandes de visite et de J'aime / commentaires ; 028 Superadmin, 029 MFA.
**Fichiers modifiés :** `server/services/stats.js`, `server/routes/index.js`, `public/js/admin.js`, `test/stats.test.js`, suivis.

## Livraison n° 23 — 7 novembre 2026 — Pondérations des classements réglables par le Superadmin
**Phase :** 4, option 3 choisie par le propriétaire (§ 12.1 de l'ordonnance : « pondération configurable »).
**RÉALISÉ (tests de logique) :** réglages `ranking_weight_view` / `_favorite` / `_contact` dans `ika_settings` (aucune migration) ; `setWeights` : **SUPERADMIN seulement** (un administrateur est refusé sans écriture), entiers de 0 à 100, **un clic de contact doit peser plus qu'une vue**, au moins un poids non nul, **motif obligatoire**, ancien → nouveau réglage et motif inscrits au **journal** dans la même transaction ; route `POST /staff/stats/weights` (limitée) ; bouton « Modifier les pondérations » visible du seul Superadmin dans l'onglet Statistiques ; les classements et leurs définitions utilisent les poids en vigueur et indiquent « valeurs par défaut » ou « réglées par le Superadmin » ; une valeur invalide en base retombe sur le défaut (1 / 3 / 5).
**PREUVES :** `test/stats.test.js` (23 tests au total) ; suite complète ici : 298 tests, 297 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** interface à base de fenêtres de saisie du navigateur (comme le reste du centre de contrôle), jamais vue en vrai ; un changement s'applique aux classements à venir comme aux passés, puisque les classements se recalculent à l'affichage sur les agrégats ; requêtes jamais exécutées sur PostgreSQL.
**RESTANT :** essai PostgreSQL et navigateur (bloquant) ; avis juridique ; purge de rétention ; fiche détaillée et comparaison d'annonceurs ; 028 Superadmin, 029 MFA.
**Fichiers modifiés :** `server/services/stats.js`, `server/routes/index.js`, `public/js/admin.js`, `test/stats.test.js`, suivis.

## Livraison n° 22 — 7 novembre 2026 — Classements d'annonces et d'annonceurs
**Phase :** 4 (analyses détaillées), option 3 choisie par le propriétaire.
**RÉALISÉ (tests de logique) :** `rankings` dans `server/services/stats.js` + route `GET /staff/stats/rankings` (ADMIN et SUPERADMIN) ; trois classements dans l'onglet « Statistiques » : **annonces**, **agences** et **autres annonceurs** (particuliers, démarcheurs) séparés, comme l'exige l'ordonnance ; l'agrégation journalière compte aussi les **favoris ajoutés par annonce** (nouveau métrique `listing.favorites`, même version de méthode : un jour recalculé est réécrit en entier).
**Formules (documentées à l'écran, section « Comment lire les classements ») :** indice de performance = vues × 1 + favoris ajoutés × 3 + clics de contact × 5 (le contact pèse plus qu'une vue) ; taux d'interaction = (favoris + clics de contact) ÷ vues × 100, **affiché seulement à partir de 20 vues**. Les chiffres d'un annonceur additionnent ceux de ses annonces. Seuls les noms publics apparaissent ; le nom commercial d'une agence non vérifiée n'est pas mis en avant (« en cours de vérification »).
**Écart avec l'ordonnance (à signaler) :** le taux d'engagement prévu (§ 14.1) se calcule sur les **visiteurs uniques estimés**, qui ne sont pas mesurés (consentement) : le taux affiché est donc un **taux par vue**, et le dit. J'aime, commentaires et partages ne sont pas dans l'indice (pas de métrique agrégée pour eux à ce stade). Pondérations = constantes du code, pas encore réglables (§ 12.1 demande « configurable »).
**PREUVES :** `test/stats.test.js` (17 tests au total) ; suite complète ici : 292 tests, 291 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; écran jamais affiché dans un navigateur ; classements vides tant que la collecte est éteinte ; pas de fiche détaillée par annonceur, pas de comparaison de deux annonceurs, pas de classement par ville ou type de bien, pas d'export.
**RESTANT :** essai PostgreSQL et navigateur (bloquant) ; avis juridique ; purge de rétention ; pondérations réglables ; fiche annonceur et comparaisons ; 028 Superadmin, 029 MFA.
**Fichiers modifiés :** `server/services/stats.js`, `server/lib/aggregation.js`, `server/routes/index.js`, `public/js/admin.js`, `test/stats.test.js`, suivis.

## Livraison n° 21 — 7 novembre 2026 — Premier tableau « Statistiques » du centre de contrôle
**Phase :** 3 (tableaux de bord), option 3 choisie par le propriétaire.
**RÉALISÉ (tests de logique) :** `server/services/stats.js` + route `GET /staff/stats/overview` (**ADMIN et SUPERADMIN seulement**, refus sans aucune lecture) ; onglet « Statistiques » du centre de contrôle (invisible pour les modérateurs). Période : 7 / 30 / 90 derniers jours **complets**, comparaison avec la période précédente de même durée ; 5 indicateurs (vues d'annonces, clics de contact, favoris ajoutés, inscriptions, annonces publiées) ; jour par jour (31 derniers jours) ; 10 annonces les plus vues avec leur titre public ; définitions de chaque indicateur. **Lit uniquement `ika_agg_daily`** (jamais les événements bruts) : test automatique.
**Libellés honnêtes affichés :** « Collecte des visites non démarrée » (seul l'historique réel est disponible) ; « Aucune agrégation faite » ; « Chiffres arrêtés au … » ; contrôles de cohérence en écart ; « pas un nombre de visiteurs » ; « un clic ne prouve ni appel, ni message, ni transaction ».
**PREUVES :** `test/stats.test.js` (9 tests) ; suite complète ici : 284 tests, 283 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** requêtes jamais exécutées sur PostgreSQL ; écran jamais affiché dans un navigateur (barres de progression, mise en page des lignes) ; tant que la collecte est éteinte il ne montre que inscriptions et annonces publiées après avoir lancé `node scripts/aggregate.mjs --apply` ; pas de période libre dans l'écran (le serveur l'accepte), pas de filtres par pays, ville ou type de bien, pas d'export PDF/Excel.
**RESTANT :** essai PostgreSQL et navigateur (bloquant) ; avis juridique ; purge de rétention ; filtres et exports ; classements d'annonceurs et d'annonces ; 028 Superadmin, 029 MFA.
**Fichiers créés :** `server/services/stats.js`, `test/stats.test.js`. **Modifiés :** `server/services/analytics.js` (état des interrupteurs), `server/services/index.js`, `server/routes/index.js`, `public/js/admin.js`, `public/css/ika.css`, `public/sw.js` (version), suivis.

## Livraison n° 20 — 7 novembre 2026 — Agrégation journalière manuelle (migration 024)
**Phase :** 2 (fondations analytiques). Le propriétaire transmet le dossier au juriste ; le développement continue sur la partie qui n'en dépend pas.
**RÉALISÉ (tests de logique) :** `server/lib/aggregation.js` et `scripts/aggregate.mjs` : **manuel**, simulation par défaut, `--apply` pour écrire, `--days=N` (3 derniers jours complets par défaut, jour en cours refusé) ou `--from/--to` (400 jours au plus). 6 indicateurs journaliers : actions par type, vues par annonce, clics de contact par annonce, événements de robots (qualité, comptés à part), inscriptions et annonces publiées (**historique réel**, disponible sans collecte). Réécriture **idempotente** d'un jour (suppression puis écriture, même version de méthode), verrou consultatif contre l'exécution en double, **contrôle de cohérence consigné** (somme des agrégats = événements hors robots) ; aucune requête ne lit une identité de personne ; jamais branché sur une minuterie ni au démarrage.
**PREUVES :** `test/aggregation.test.js` (11 tests : plan des jours, requêtes, ordre verrou / suppression / écriture / contrôle, écart consigné, garde-fous du script) ; suite complète ici : 275 tests, 274 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** requêtes SQL jamais exécutées sur PostgreSQL (colonnes `ika_users.created_at` et `ika_listings.published_at` supposées d'après le code existant : à confirmer par l'essai) ; sans collecte active, seuls les deux indicateurs d'historique produisent des lignes ; aucun écran ne lit encore les agrégats ; pas de table des visiteurs uniques (exige un identifiant de visiteur).
**RESTANT :** essai PostgreSQL (bloquant) ; avis juridique et formalité APDP ; écran des compteurs et premiers tableaux du centre de contrôle (lecture des agrégats) ; purge de rétention des événements (12 mois) ; 028 Superadmin, 029 MFA.
**Fichiers créés :** `server/lib/aggregation.js`, `scripts/aggregate.mjs`, `test/aggregation.test.js`. **Modifiés :** suivis.

## Livraison n° 19 — 6 novembre 2026 — Consentement individuel aux statistiques (fait dans le temps restant)
**Phase :** 2. Le propriétaire demande de terminer ce qui peut l'être : choix de la partie du dossier juridique qui ne dépend pas du texte final du juriste.
**RÉALISÉ (tests de logique) :** migration `027_consentement_statistiques.sql` + retour arrière ; service : sans accord enregistré (ou refus) une action d'un compte connecté est comptée **sans identifiant de compte** ; refus = identifiant retiré des actions passées, dans la même transaction ; accord « true » strict (jamais implicite) ; version du texte enregistrée ; routes `GET/PUT /me/analytics-consent` (connexion exigée, limitées) ; case « Statistiques d'usage » dans **Profil**, **non cochée**, facultative, disponible même collecte éteinte ; export et suppression de compte couvrent le consentement. Ferme le point 7 de la liste de contrôle du dossier juridique.
**PREUVES :** 22 tests dans `test/analytics-events.test.js` ; suite complète ici : 264 tests, 263 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** texte de l'écran **provisoire** (à remplacer par celui du juriste) ; jamais exécuté sur PostgreSQL ni vu dans un navigateur ; la collecte reste éteinte, ne pas l'activer.
**RESTANT :** (de votre côté) essai PostgreSQL et téléphone ; avis juridique et formalité APDP ; puis écran des compteurs, purge de rétention, agrégation (024), 028 Superadmin et 029 MFA (renumérotées : 026 profil, 027 consentement).
**Fichiers créés :** `migrations/027_consentement_statistiques.sql`, `scripts/rollback/027_consentement_statistiques_down.sql`. **Modifiés :** `server/services/analytics.js`, `server/routes/index.js`, `server/services/rights.js`, `public/js/pages/account.js`, `public/sw.js` (version), `test/analytics-events.test.js`, `docs/juridique/dossier-activation-statistiques.md`, `PLAN_ROLES_PERMISSIONS.md`, suivis.

## Livraison n° 18 — 6 novembre 2026 — Dossier pour le juriste (activation des statistiques)
**Phase :** 2 (suite de la livraison 17), option 3 choisie par le propriétaire.
**RÉALISÉ :** `docs/juridique/dossier-activation-statistiques.md` : ce que le logiciel fait (vérifié dans le code), 10 questions au juriste classées, durées proposées (D-3 option A), **texte d'annexe à la politique de confidentialité**, **texte du bandeau de consentement** (Accepter / Refuser de même importance) et du réglage du profil, liste de contrôle technique, procédure d'activation et d'arrêt ; ligne 19 ajoutée à `plan-conformite.md`. Côté code : l'export « Télécharger mes données » inclut les événements d'usage du compte et la suppression du compte les efface (`rights.js`, test ajouté).
**Vérification en ligne (6 novembre 2026) :** existence de la loi n° 2013-015 (modifiée en 2017), de l'APDP, de ses mises en demeure (plus d'une centaine de structures) et d'amendes ; sources = presse et sites de synthèse (fiabilité moyenne), le texte officiel n'a pas été relu : à confirmer par le juriste.
**PREUVES :** 15 tests dans `test/analytics-events.test.js` ; suite complète ici : 257 tests, 256 réussis, 0 échec, 1 ignoré (mêmes limites : pas de PostgreSQL, Express de substitution).
**LIMITES :** ce n'est pas un avis juridique ; textes proposés non validés ; bandeau et réglage du profil **non écrits** (ils attendent la rédaction du juriste) ; si l'interrupteur était allumé aujourd'hui, un compte qui refuserait ne pourrait pas encore être exclu du rattachement (point 7 de la liste de contrôle) : **ne pas activer**.
**RESTANT :** avis juridique ; formalité APDP ; bandeau et réglage ; purge de rétention ; écran des compteurs ; essai PostgreSQL (bloquant).
**Fichiers créés :** `docs/juridique/dossier-activation-statistiques.md`. **Modifiés :** `server/services/rights.js`, `test/analytics-events.test.js`, `docs/juridique/plan-conformite.md`, suivis.

## Livraison n° 17 — 6 novembre 2026 — Émission des événements analytiques (interrupteur éteint)
**Phase :** 2 (fondations analytiques), option 3 choisie par le propriétaire.
**RÉALISÉ (tests de logique) :** `server/lib/analytics-events.js` (liste blanche identique à la migration 023, nettoyage, classes d'appareil / robot / origine) ; `server/services/analytics.js` (émission en meilleur effort, jamais bloquante, jamais attendue) ; `ANALYTICS_ENABLED` (config, `.env.example`, **false par défaut**) ; branchement dans les routes de 13 événements : `user_registered`, `user_login` (après mot de passe accepté), `user_logout`, `listing_view`, `listing_created`, `listing_favorite_added/removed`, `phone_clicked` / `whatsapp_clicked` (annonce et profil), `comment_created`, `report_created` (annonce, conversation, profil), `message_sent`, `visit_requested`.
**Garde-fous :** double interrupteur (environnement ET réglage `analytics_enabled` en base) : éteint = aucune écriture ; « Ne pas suivre » et GPC respectés (à confirmer avec le juriste) ; aucune adresse IP, aucun cookie, aucune adresse de page d'origine, aucun texte saisi, métadonnées en liste blanche ; pas de visiteur anonyme ni de pays (colonnes nulles) ; robots enregistrés mais marqués ; échec d'écriture avalé et compté (`stats()`).
**PREUVES :** `test/analytics-events.test.js` (14 tests) ; suite complète ici : 256 tests, 255 réussis, 0 échec, 1 ignoré. Mêmes limites : pas de PostgreSQL, Express de substitution.
**LIMITES :** rien n'est collecté tant que l'interrupteur est éteint (c'est voulu) ; l'insertion SQL n'a jamais tourné sur PostgreSQL ; `page_view`, sessions, visiteurs uniques et pays ne sont pas émis (ils exigent un identifiant de visiteur, donc consentement et avis juridique).
**RESTANT :** avis juridique, mise à jour de `docs/juridique/projet-confidentialite.md` et bandeau de consentement **avant** d'activer ; événements `listing_updated`, `listing_published`, `listing_archived`, `payment_completed`, `verification_completed`, `comment_deleted` ; sessions et visiteurs ; tâche d'agrégation (024) ; tableaux de bord du centre de contrôle.
**Fichiers créés :** `server/lib/analytics-events.js`, `server/services/analytics.js`, `test/analytics-events.test.js`. **Modifiés :** `server/config.js`, `server/index.js`, `server/services/index.js`, `server/routes/index.js`, `.env.example`, suivis.

## Livraison n° 16 — 6 novembre 2026 — Masquage de photo de profil par la modération + feuille de route à jour
**Phase :** 6 (suite de la livraison 15).
**RÉALISÉ (tests de logique) :** `setImagesHidden` (modération : motif obligatoire, journal dans la même transaction, refus d'un compte ordinaire sans écriture) ; route `POST /staff/profiles/:id/images` ; bouton « Masquer ses photos de profil » dans l'onglet Confiance du centre de contrôle (les signalements de profil y sont lisibles) ; une nouvelle photo envoyée par le titulaire rétablit l'affichage. Aperçu visuel du profil avec données fictives produit à partir du vrai code (artefact publié) : **vos retours sur le rendu sont attendus**.
**PREUVES :** 24 tests dans `test/profil-public.test.js` ; suite complète ici : 242 tests, 241 réussis, 0 échec, 1 ignoré. Mêmes limites que la livraison 15 (pas de PostgreSQL, Express de substitution, pas de navigateur réel).
**FEUILLE DE ROUTE (état) :**
| Étape | État |
|---|---|
| Phase 0 audit ; Phase 1 spécification ; Phase 2 fondations analytiques (021-024) | Écrites, **non éprouvées sur PostgreSQL** |
| Comptes : permissions 025 + module de règles | Écrites et testées en logique ; **non éprouvées sur PostgreSQL** |
| Profil public à onglets, photos, contact, litige, masquage (026) | Écrit et testé en logique ; à éprouver (PostgreSQL, téléphone) |
| Branchement de `requireStaff` sur les permissions | **En attente** de la preuve PostgreSQL de 025 |
| 028 deux emplacements Superadmin ; 029 MFA progressive | À faire, après la ligne précédente |
| Émission des événements analytiques (interrupteur éteint) | **Écrite** (livraison 17), testée en logique ; collecte active seulement après avis juridique |
| Agrégation journalière manuelle (024) | **Écrite** (livraison 20), testée en logique, non éprouvée sur PostgreSQL |
| Premier tableau « Statistiques » (lit les agrégats) | **Écrit** (livraison 21), testé en logique, non éprouvé |
| Sessions, visiteurs uniques, filtres, exports, classements | À faire |
| Badges « Promoteur vérifié » / « Particulier certifié » | Bloqué : procédure de vérification à définir |
**RESTANT immédiat (de votre côté) :** sauvegarde, `npm install`, `npm test` avec `DATABASE_URL_TEST`, démarrage, profil sur téléphone ; coller le résultat complet.
**Fichiers modifiés :** `server/services/advertiser-profile.js`, `server/routes/index.js`, `public/js/admin.js`, `test/profil-public.test.js`, `SUIVI.md`, suivis.

## Livraison n° 15 — 5 novembre 2026 — Profil public à onglets (couverture, photo, présentation, avis, contact, litige)
**Phase :** 6 (espaces utilisateurs), sur décision du propriétaire (« faites tout ») : profil façon réseau social, un seul but : l'acheteur sait de qui vient l'annonce, son expérience, ses antécédents constatés, peut donner un avis ou signaler en cas de litige. Chaque compte a le même profil, avec des limites par rôle ; couverture, photo et présentation possibles mais **jamais obligatoires**.
**RÉALISÉ (code écrit ; preuves = tests ci-dessous) :**
- Migration `026_profil_public.sql` (additive) + retour arrière ; `server/lib/advertiser-profile.js` (règles par rôle : propriétaire direct = présentation et contact ; démarcheur = + zones ; agence = + année, adresse, horaires, adresse et horaires affichés seulement si l'agence est vérifiée) ; `server/services/advertiser-profile.js` ; 6 routes (`/me/public-profile` GET/PUT, image, image/delete, `/advertisers/:id/contact`, `/advertisers/:id/report`) toutes avec compte connecté et limitation de débit.
- Page `advertiser.js` refaite en 5 onglets : **Tous**, **Annonces**, **Avis** (filtres Tous / Positifs 4-5 / Négatifs 1-2, donner un avis, réponse, signalement d'avis), **Contacter** (Appeler / WhatsApp seulement si l'annonceur l'autorise, connexion exigée, jamais de numéro écrit sur la page), **Plus** (antécédents constatés, à propos, conseils avant d'acheter, signaler l'annonceur, partager). Page `profile-edit.js` (route `#/mon-profil-public`) pour modifier son profil ; lien depuis « Profil ».
- Antécédents : uniquement des faits comptés (annonces publiées, vendues ou louées, refusées par la modération, première annonce). Les signalements en cours ne sont **pas** publics (ils ne prouvent rien avant examen).
- Signalement d'annonceur : même file que les signalements issus des conversations, déjà visible dans l'onglet Confiance du centre de contrôle.
- Images de profil : mêmes contrôles que les photos d'annonces (type réel, 2 Mo) ; lisibles publiquement sauf masquées ou compte bloqué ; titulaire et personnel les voient toujours ; le nettoyage des fichiers orphelins les protège ; export et suppression des données personnelles les couvrent.
- Maquette Gemini : gardée comme référence visuelle seulement (chiffres en dur, badge toujours affiché et icônes externes refusés).
- **Anomalie corrigée** : `scripts/stamp-sw.mjs` ne faisait rien, sans message, dans un dossier dont le nom contient des espaces (ou une lettre de lecteur Windows) ; le numéro de version du cache hors connexion n'était donc peut-être pas mis à jour chez vous. Corrigé, avec test `test/stamp-sw.test.js`.
**PREUVES :** `test/profil-public.test.js` (20 tests : règles par rôle, vue publique sans numéro, contact, signalement, photos, migration, routes, page) ; suite complète ici : 237 tests, 236 réussis, 0 échec, 1 ignoré (base). Poids : `advertiser.js` 6,0 Ko et `profile-edit.js` 2,0 Ko compressés (limite 8) ; CSS 8,9 Ko (limite 10).
**LIMITES (à lire) :** (1) Rien n'a été exécuté sur PostgreSQL : migrations 021 à 026 et requêtes SQL du profil non éprouvées sur une vraie base. (2) Les tests de routes ont tourné ici avec un Express de substitution, pas le vrai. (3) Interface jamais affichée dans un vrai navigateur (pas de capture) : mise en page, onglets au clavier, téléversement des photos à vérifier chez vous sur téléphone. (4) La migration 026 s'applique seule au démarrage : **sauvegarde avant** (`scripts/backup.sh`).
**RESTANT :** essai sur PostgreSQL et sur téléphone ; masquage d'une photo de profil par la modération (colonne prête, bouton du centre de contrôle à ajouter) ; affichage des clics de contact de profil dans les statistiques ; « Promoteur vérifié » / « Particulier certifié » toujours impossibles sans procédure de vérification ; puis `requireStaff`, 027 (deux emplacements Superadmin), 028 (MFA).
**Fichiers :** créés `migrations/026_profil_public.sql`, `scripts/rollback/026_profil_public_down.sql`, `server/lib/advertiser-profile.js`, `server/services/advertiser-profile.js`, `public/js/pages/profile-edit.js`, `test/profil-public.test.js`, `test/stamp-sw.test.js` ; modifiés `public/js/pages/advertiser.js`, `account.js`, `app.js`, `sw.js` (version), `public/css/ika.css`, `server/routes/index.js`, `server/services/index.js`, `reviews.js`, `rights.js`, `server/lib/file-storage.js`, `orphan-files.js`, `scripts/stamp-sw.mjs`, suivis, plans.

## Livraison n° 14 — 5 novembre 2026 — Plan du profil annonceur à onglets
**Phase :** 2 (conception). Demande : cahier des charges « profil annonceur » + maquette HTML (Gemini).
**RÉALISÉ :** audit de la page existante (`advertiser.js`, `publicProfile`) ; `PLAN_PROFIL_ANNONCEUR.md` : écarts, défauts de la maquette (chiffres et badge en dur, icônes externes), conception additive, tests. Preuve : fichier livré. **Aucun code, aucune migration.**
**EN COURS :** attente du choix de périmètre (question posée) ; attente de la sortie complète de `npm test` (fichier `routes` seul, puis suite avec `DATABASE_URL_TEST`).
**RESTANT :** inchangé pour les comptes (preuve PostgreSQL, `requireStaff`, 026 Superadmin, 027 MFA) ; profil annonceur à onglets selon la décision.
**Fichiers créés :** `PLAN_PROFIL_ANNONCEUR.md`. **Modifiés :** suivis.

## Livraison n° 13 — 5 novembre 2026 — Deuxième `npm test` chez le propriétaire
**Phase :** 2 (vérification).
**RÉALISÉ (preuve : sortie collée) :** les 5 tests de scripts shell sont bien **ignorés avec leur motif** sous Windows (plus d'échec) ; les 7 tests `permissions (025)` passent à nouveau ; tous les tests visibles sont réussis ou ignorés, aucun échec affiché.
**EN COURS :** (1) `DATABASE_URL_TEST` toujours non défini : tests PostgreSQL ignorés, migrations 021 à 025 toujours non éprouvées sur une vraie base. (2) La sortie s'arrête, identique dans les deux essais, après le 2e test de « routes sans base de données » ; les lignes de fin (totaux) manquent. Cause inconnue : sortie coupée au collage, ou test 3 qui ne se termine pas sur votre machine (avec un Express de substitution, ici, les 9 tests de ce fichier passent). À vérifier en lançant ce fichier seul.
**RESTANT :** inchangé (preuve PostgreSQL, puis `requireStaff`, 026, 027).
**Fichiers modifiés :** suivis seulement. Aucun code.

## Livraison n° 12 — 5 novembre 2026 — Tests de scripts adaptés à Windows
**Phase :** 2 (qualité des tests).
**RÉALISÉ :** `test/ops-scripts.test.js` : les 5 tests de `backup.sh` / `restore-check.sh` sont **ignorés (et non réussis)** quand `bash` est indisponible (Windows), avec le motif affiché. Sous Linux ils s'exécutent comme avant. Preuve : exécution ici sous Linux, 5 réussis ; le comportement sous Windows n'a pas été exécuté (à confirmer par votre `npm test`).
**EN COURS :** attente de votre `npm test` avec `DATABASE_URL_TEST`.
**RESTANT :** inchangé (preuve PostgreSQL de 021 à 025, puis `requireStaff`, 026, 027).
**Fichiers modifiés :** `test/ops-scripts.test.js`, suivis. Aucun code de l'application.

## Livraison n° 11 — 5 novembre 2026 — Résultat de `npm test` chez le propriétaire (Windows)
**Phase :** 2 (vérification de la livraison n° 10).
**RÉALISÉ (preuve : sortie collée par le propriétaire) :** `npm test` s'exécute avec les vrais modules ; les 7 tests `permissions (025)` passent ; le budget de performance, la carte, les paiements simulés, la géométrie et la configuration passent.
**EN COURS :** la sortie reçue est coupée après « routes sans base de données » : le total final (réussis / échecs) n'est pas connu.
**Constats :** (1) 5 échecs dans `test/ops-scripts.test.js` (`backup.sh`, `restore-check.sh`) : ces tests lancent la commande `bash`, absente ou non fonctionnelle sous Windows ; ce n'est pas un défaut du code, ces scripts sont faits pour le serveur Linux. (2) Tous les tests PostgreSQL sont **ignorés** (`DATABASE_URL_TEST non défini`) : la migration 025 et les migrations 021 à 024 n'ont donc **pas** été éprouvées sur une vraie base.
**RESTANT :** lancer les tests avec `DATABASE_URL_TEST` (base locale `ika_so_test` uniquement, réinitialisée par les tests) ; décider du traitement des 5 tests de scripts sous Windows (les ignorer sous Windows ou les lancer sous WSL/Git Bash) ; puis branchement de `requireStaff`, 026, 027.
**Fichiers modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. Aucun code.

## Livraison n° 10 — 4 novembre 2026 — Migration 025 (permissions) et module de règles
**Phase :** 2 (comptes). Décisions du propriétaire : option 1 (rôles/permissions, deux Superadmin, MFA) ; MFA **progressive** (Superadmin dès l'activation, Admin et Modérateurs après 14 jours).
**RÉALISÉ :** `migrations/025_permissions.sql` (3 tables, 14 permissions, amorçage = droits actuels, trigger refusant l'octroi individuel des permissions non délégables, aucun octroi à soi-même) ; `scripts/rollback/025_permissions_down.sql` ; `server/lib/permissions.js` (refus par défaut, règles d'octroi) ; `test/permissions.test.js`. Preuve : 7/7 tests de ce fichier passent ; équivalence vérifiée avec les rangs actuels ; le SQL est confronté au module (mêmes permissions, mêmes rôles, mêmes drapeaux).
**EN COURS :** 025 écrite mais **jamais exécutée sur PostgreSQL** (aucun PostgreSQL dans cette session). Elle s'appliquera seule au prochain démarrage du serveur : **sauvegarder d'abord** (`scripts/backup.sh`).
**RESTANT :** exécuter 025 et son retour arrière sur PostgreSQL ; brancher `requireStaff` sur les permissions (façade) ; 026 (deux emplacements, attribution après votre confirmation de la liste réelle) ; 027 (MFA TOTP, codes de récupération) ; activation progressive ; avis juriste.
**Limites :** suite complète = 174 réussis, 7 en échec **déjà avant cette livraison** (paquet `express` absent, pas de réseau) ; à relancer après `npm install`.
**Fichiers créés :** les 4 ci-dessus. **Modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. Aucun code existant modifié.

## Livraison n° 9 — 4 novembre 2026 — Plan rôles, permissions, Superadmin, MFA
**Phase :** 2 (conception, option 1 choisie par le propriétaire).
**RÉALISÉ :** `PLAN_ROLES_PERMISSIONS.md` (état réel du code, migrations 025 à 027, retours arrière, risques, tests). Preuve : fichier livré.
**EN COURS :** attente du mode d'obligation de la MFA (question posée) ; validation du plan.
**RESTANT :** écrire et tester les migrations 025 à 027 et le code ; liste réelle des SUPERADMIN (requête en lecture seule à exécuter chez vous) ; désignation des deux titulaires ; avis juriste.
**Limites :** plan non testé ; aucune exécution.
**Fichiers créés :** `PLAN_ROLES_PERMISSIONS.md`. **Modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Code, migrations, base : aucune modification.**

## Livraison n° 8 — 4 novembre 2026 — Règles de conduite consignées
**Phase :** 2 (documentaire uniquement).
**RÉALISÉ :** règles 1 à 3 ci-dessus précisées (questions numérotées par priorité, réponse par numéro, recherche web en cas de blocage). Preuve : ce fichier et `CHANGELOG.md`.
**EN COURS :** attente de la décision sur la prochaine étape (question posée dans la réponse de cette livraison).
**RESTANT :** inchangé par rapport à la livraison n° 7.
**Fichiers modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Code, migrations, base : aucune modification.** **Tests :** aucun exécuté (changement documentaire).

## Livraison n° 7 — 4 novembre 2026 — Migrations 021 à 024 implémentées

**Phase :** 2 (implémentation du schéma), autorisée par le propriétaire (« Implémentez les migrations »).
**RÉALISÉ :** `migrations/021_pays_parametres.sql`, `022_audit_admin.sql`, `023_evenements_sessions.sql`, `024_agregats_controles.sql` ; retours arrière `scripts/rollback/021` à `024_*_down.sql` ; `test/analytics-migrations.test.js` (7 tests). Preuve : suite complète 340/340 sur PostgreSQL 16 ; retour arrière 024→021 puis rejeu vérifiés ; rejeu du SQL sans erreur (idempotent) ; tables existantes et `ika_settings.featured_max` intactes.
**Choix de conception :** collecte désactivée par défaut (`analytics_enabled = 'false'`) ; l'audit est en ajout seul (UPDATE, DELETE, TRUNCATE refusés) sauf `ika_admin_audit_purge()` (refuse une date de moins d'un an, se trace elle-même) ; types d'événements en liste blanche ; aucune clé étrangère vers les comptes ; durées 12 mois / 5 ans / 5 ans stockées dans `ika_settings`.
**RESTANT :** **aucun code applicatif n'écrit encore dans ces tables** (émission, agrégation, interface : phases suivantes) ; activation interdite avant avis juriste/APDP ; bandeau de consentement ; mise à jour de `docs/juridique/projet-confidentialite.md` ; essai sur une copie de la base de production avant déploiement ; `backup.sh` de bout en bout.
**Limites :** testé sur une base de développement vide, pas sur des volumes réels ; performance des index non mesurée.
**Fichiers créés :** 4 migrations, 4 scripts de retour arrière, `test/analytics-migrations.test.js`. **Fichiers modifiés :** `PLAN_MIGRATIONS_021_024.md`, `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Code applicatif : aucune modification.**
**Déploiement :** les migrations s'appliquent au démarrage. Faire une sauvegarde avant ; retour arrière dans l'ordre 024, 023, 022, 021.
**Prochaine étape :** émission des événements côté serveur (interrupteur éteint), puis agrégation et indicateurs.

## Livraison n° 6 — 4 novembre 2026 — Corrections de l'audit (A-01, A-02, A-09, A-11)

**Phase :** 0 (corrections de preuve), autorisées par le propriétaire (« Corrigez »).
**RÉALISÉ :** suite complète exécutée sur PostgreSQL 16 : 333/333 après correction d'un test (`test/budget.test.js`) ; `npm ci` valide ; retour arrière 020 et rejeu vérifiés ; sauvegarde/restauration (`pg_dump`/`pg_restore`) vérifiée sur base jetable ; palette réelle documentée ; format des identifiants documenté. Détail : tableau « Statut des anomalies » dans `AUDIT_INITIAL_IKA_SO.md`.
**EN COURS :** validation de la Phase 2.
**RESTANT :** `backup.sh` et `restore-check.sh` de bout en bout (besoin de `rclone`, clé `age`, destination distante) ; anomalies A-03 à A-08, A-10, A-12 (fonctionnalités, phases suivantes) ; avis juriste ; désignation des deux Superadmin.
**Limites :** tests exécutés en environnement de développement, pas en production ; paiements réels jamais testés ; installation sur téléphone réel non testée.
**Fichiers modifiés :** `test/budget.test.js`, `AUDIT_INITIAL_IKA_SO.md`, `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Migrations, base : aucune modification.**
**Tests :** 333 réussis, 0 échec (`DATABASE_URL_TEST` défini).
**Prochaine étape :** autorisation d'implémenter les migrations 021 à 024, ou ouverture d'une phase de fonctionnalités (MFA/permissions).

## Livraison n° 5 — 4 novembre 2026 — Décisions D-1 à D-6 validées, plan des migrations

**Phase :** 2 (conception) — plan de migrations rédigé, en attente d'autorisation d'implémentation.
**RÉALISÉ :** décisions D-1 à D-6 validées par le propriétaire (voir ci-dessous) ; `PLAN_MIGRATIONS_021_024.md` (contenu, dépendances, retours arrière en texte, déploiement, tests). Preuve : fichiers livrés.
**EN COURS :** validation de la Phase 2 ; désignation des deux Superadmin.
**RESTANT :** exécution réelle des tests et de `backup.sh`/`restore-check.sh` (prérequis bloquants) ; avis juriste/APDP ; autorisation d'implémenter 021 à 024.
**Limites :** SQL du plan non testé ; durée alignée sur 12 mois dans `ARCHITECTURE_ANALYTICS.md` § 7.
**Fichiers créés :** `PLAN_MIGRATIONS_021_024.md`. **Fichiers modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`, `ARCHITECTURE_ANALYTICS.md` (durée 12 mois). **Code, migrations, base : aucune modification.**
**Prochaine étape :** au choix du propriétaire : exécuter la suite de tests sur PostgreSQL (levée du prérequis), ou corriger les anomalies A-01 à A-12.

## Décisions D-1 à D-6 (4 novembre 2026, option A retenue)
- D-1 : téléphone + e-mail conservés ; Google seul ajouté, en option ; numéro vérifié obligatoire pour publier ; avis juridique avant production.
- D-2 : pièces jointes prudentes (images, PDF, notes vocales courtes) ; 20 fichiers/jour compte ordinaire, 60/jour agence ou Premium ; alerte à 70 % de la capacité de la base ; scans de titres fonciers limités aux deux membres.
- D-3 : conservation équilibrée : événements bruts et sessions 12 mois, agrégats 5 ans, audit 5 ans (à valider par le juriste) ; bandeau de consentement avec refus aussi simple que l'acceptation.
- D-4 : Superadmin secondaire = personne de confiance distincte, avec ses propres téléphone, e-mail et appareil.
- D-5 : extension ultérieure à la zone UEMOA, un pays à la fois, avec référent local, règles foncières du pays et avis données.
- D-6 : liste imposée de documents fonciers, toujours « déclaré, non vérifié » ; lettre d'attribution jamais présentée comme titre ; pas de « sécurisé » ni « garanti » sans vérification.

## Livraison n° 4 — 4 novembre 2026 — Recherche métier et nouvelles règles de conduite

**Phase :** 2 en attente de validation ; recherche d'appui aux décisions bloquantes.
**RÉALISÉ :** `RECOMMANDATIONS_METIER.md` (cadre foncier malien, protection des données, constats de marché, six décisions D-1 à D-6 avec options et recommandation) ; règles de conduite consignées. Preuve : fichiers livrés.
**EN COURS :** attente des réponses aux décisions D-1 à D-6 ; validation des Phases 1 et 2.
**RESTANT :** avis juridique (APDP, conservation, consentement, types de documents fonciers) ; tests réels sur PostgreSQL ; identité des deux Superadmin.
**Limites :** sources de marché commerciales et non vérifiables ; textes juridiques non lus en intégralité ; aucun avis de juriste.
**Fichiers créés :** `RECOMMANDATIONS_METIER.md`. **Fichiers modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Code, migrations, base : aucune modification.**
**Prochaine étape :** selon les réponses, plan détaillé des migrations 021 à 024 avec retour arrière.

## Livraison n° 3 — 4 novembre 2026 — Phase 2 (conception analytique)

**Phase :** 2 en cours (documents rédigés, en attente de validation).
**Éléments examinés :** spécification Phase 1, schéma existant (`ika_audit`, `ika_sessions`, `ika_contact_events`, tables métier).

**RÉALISÉ**
- `ARCHITECTURE_ANALYTICS.md` : flux, source de vérité par indicateur, sessions, agrégation, qualité, audit, vie privée, **plan de sauvegarde, migrations 021 à 024 et retour arrière**, plan de tests.
- `MODELE_DONNEES_ANALYTIQUES.md` : schéma proposé (non appliqué), événements autorisés, correspondance avec l'existant.
Preuve : fichiers livrés.

**EN COURS :** validation des Phases 1 et 2 par le propriétaire.

**RESTANT**
- Prérequis bloquants avant toute migration : exécution réelle de la suite sur PostgreSQL, essai réel de `backup.sh` et `restore-check.sh`.
- Avis juriste/APDP (collecte, durées, bandeau) avant activation.
- Implémentation des migrations 021 à 024 (non commencée), puis `CATALOGUE_INDICATEURS.md` et tableaux de bord (Phase 3).

**Fichiers créés :** `ARCHITECTURE_ANALYTICS.md`, `MODELE_DONNEES_ANALYTIQUES.md`. **Fichiers modifiés :** `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`. **Code, migrations, base : aucune modification.**
**Tests :** aucun nouveau (conception) ; plan de tests défini dans l'architecture § 9.
**Risques :** décision de conception « source de vérité par indicateur » à confirmer ; dimensionnement non éprouvé ; pays déduit de l'IP dépend de l'hébergeur.
**Progression :** Phase 1 ≈ 90 % · Phase 2 (conception) ≈ 85 % · implémentation 0 %.
**Prochaine étape :** validation, puis plan détaillé des migrations 021 à 024 avec scripts de retour arrière (à écrire, pas à exécuter sans autorisation).

## Livraison n° 2 — 4 novembre 2026 — Phase 1 (conception) + règle de livraison

**Date :** 4 novembre 2026 · **Phase :** 0 terminée (audit), 1 en cours (conception, en attente de validation)

**Éléments examinés :** archive `Ika_So_Version_1.zip` (serveur, 20 migrations, frontend, tests, docs, scripts), ordonnances consolidées v1.0.

**RÉALISÉ**
- `AUDIT_INITIAL_IKA_SO.md` : inventaire, classification, 12 anomalies, 6 contradictions, stratégie. Preuve : fichier ; `test/rules.test.js` 16/16.
- `SPECIFICATION_SUPERADMIN.md` : deux emplacements Superadmin, permissions, collecte minimale, catalogue d'indicateurs, pièces jointes (2 Mo), questions ouvertes. Preuve : fichier.
- Décisions du propriétaire intégrées (voir ci-dessous).

**EN COURS**
- Validation de la spécification par le propriétaire.

**RESTANT**
- Désigner les deux titulaires Superadmin ; décision ferme sur la connexion tierce ; quotas de pièces jointes ; durées de conservation (juriste) ; sous-régions.
- Exécution réelle de la suite complète (Express, pg, PostgreSQL) : **jamais faite**.
- Phase 2 : `ARCHITECTURE_ANALYTICS.md`, `MODELE_DONNEES_ANALYTIQUES.md`, puis plan de sauvegarde/rollback avant toute migration.

**Fichiers créés :** `AUDIT_INITIAL_IKA_SO.md`, `SPECIFICATION_SUPERADMIN.md`, `SUIVI_EVOLUTION_IKA_SO.md`, `CHANGELOG.md`.
**Fichiers modifiés :** aucun. **Code, migrations, base : aucune modification.**
**Migrations :** aucune. **Tests :** `rules.test.js` 16/16 ; suite complète non exécutée.

**Anomalies restantes :** A-01 à A-12 (voir l'audit). Aucune corrigée à ce stade (volontaire : Phase 0/1).
**Risques :** validation uniquement par substituts ; perte simultanée des deux Superadmin (aucun canal de secours, délai d'une semaine) ; collecte analytique non rétroactive ; textes juridiques provisoires.

**Progression :** Phase 0 100 % · Phase 1 ≈ 85 % (rédigée, non validée) · Phases 2 à 8 : 0 %.
**Prochaine étape :** validation de la spécification, puis Phase 2 (documents).

## Décisions du propriétaire (4 novembre 2026)
- Superadmin secondaire = récupération du principal ; délai de sécurité **une semaine** ; aucun canal de secours hors plateforme.
- Plusieurs comptes `SUPERADMIN` en base ; le choix du principal est laissé à l'agent, **confirmation sur la liste réelle exigée avant tout changement de rôle**.
- Collecte minimale pseudonymisée et à durée limitée : acceptée (avis juriste/APDP requis avant production).
- Connexion tierce : envisagée sous conditions (minimisation, confidentialité, validation juridique) ; décision ferme attendue.
- Pièces jointes en messagerie : acceptées, **2 Mo maximum**.
- Stockage : budget limité et modération des fichiers ; stockage PostgreSQL conservé avec quotas.
- Périmètre : Mali, puis sous-régions, puis panafricain.
- **Règle de livraison :** à chaque réponse, livrer le projet complet avec les documents de suivi.
