# Changelog — Owner Control Center (07/11/2026)

## Ajouts
- Endpoint `GET /staff/owner/overview` (indicateurs réels annonces, utilisateurs, activité, finances).
- Onglet « Owner Control » dans le centre de contrôle (SUPERADMIN uniquement).
- Protection du dernier SUPERADMIN actif (impossible de le rétrograder).
- Fichier Excel de suivi : `SUIVI_EVOLUTION_OWNER_CONTROL.xlsx`.
- Rapport d’audit : `RAPPORT_AUDIT_OWNER_CONTROL.md`.

## Corrections / améliorations précédentes incluses
- Couleurs de bannière réglables.
- Palette forêt/lime/sable.
- Boutons de prévisualisation.
- Rollback migration 028.
- Tests couleurs.

## Fichiers modifiés
- `server/services/stats.js`
- `server/services/moderation.js`
- `server/routes/index.js`
- `public/js/admin.js`
- `SUIVI.md` (note palette)
- Nouveaux : rapports, Excel, rollback.

## Itération 1.1 (exécution continue)
- Endpoint `GET /staff/owner/crm` : contacts et visites récents.
- Endpoint `GET /staff/owner/export.csv` : export des indicateurs Owner.
- Boutons « Exporter CSV » et « Voir CRM » dans l’onglet Owner Control.
- Fichier Excel de suivi mis à jour.

## Itération 1.2
- Endpoint `GET /staff/owner/agencies` : agences / annonceurs vérifiés.
- Endpoint `GET /staff/owner/listings.csv` : rapport des annonces.
- Boutons « Rapport annonces » et « Voir agences » dans Owner Control.

## Itération 1.3
- Paramètres généraux : `GET/PUT /staff/owner/settings` (nom, email, téléphone, devise) — écriture SUPERADMIN.
- Santé technique : `GET /staff/owner/health` (base, compteurs, uptime).
- Boutons « Paramètres » et « Santé technique » dans Owner Control.

## Itération 1.4
- Pipeline CRM : `POST /staff/owner/visits/:id/status` (PENDING/ACCEPTED/DECLINED/CANCELLED).
- Réclamations : `GET /staff/owner/complaints` (signalements annonces et utilisateurs).
- Journal des sauvegardes : migration 029 + `GET/POST /staff/owner/backups`.
- Boutons « Réclamations » et « Journal sauvegardes » dans Owner Control.

## Itération 1.5
- Notifications collectives : `POST /staff/owner/broadcast` (titre, message, cible ALL / STAFF / AGENCIES).
- Bouton « Notification collective » dans Owner Control (SUPERADMIN).

## Itération 1.6
- Rapport complet : `GET /staff/owner/report` (overview + agences + réclamations + santé).
- Paramètres SEO : `GET/PUT /staff/owner/seo` (titre, description, mots-clés).
- Boutons « Rapport complet » et « Paramètres SEO » dans Owner Control.

## Itération 1.7
- Assistance IA : `GET /staff/owner/ai` — doublons potentiels, prix atypiques, rafales de publications.
- Bouton « Assistance IA » dans Owner Control.

## Itération 1.8
- Abonnements : `GET /staff/owner/subscriptions` — offres, paiements par statut, récents.
- Bouton « Abonnements » dans Owner Control.

## Itération 1.9
- Régions / quartiers : `GET /staff/owner/regions` — répartition des annonces (publiées, vente, location).
- Bouton « Régions » dans Owner Control.

## Itération 1.10
- Rapport PDF natif : `GET /staff/owner/report.pdf` — génération PDF du rapport Owner.
- Bouton « Rapport PDF » dans Owner Control.

## Itération 1.11
- Surveillance avancée : `GET /staff/owner/monitoring` — mémoire, uptime, Node, paiements en attente, signalements, dernières actions d'audit.
- Bouton « Surveillance avancée » dans Owner Control.

## Itération 1.12
- Marketing avancé : migration 030 (table ika_campaigns).
- `GET /staff/owner/marketing` : campagnes + annonces à la une.
- `POST /staff/owner/campaigns` : création de campagne (SUPERADMIN).
- Boutons « Marketing » et « Nouvelle campagne » dans Owner Control.

## Itération 1.13
- Pipeline CRM complet : migration 031 (ika_crm_pipeline) — 7 étapes (NEW → CONTACTED → VISIT_PLANNED → VISIT_DONE → NEGOTIATION → WON / LOST).
- Endpoints : GET/POST /staff/owner/pipeline, POST /staff/owner/pipeline/:id/stage.
- Données graphiques : GET /staff/owner/charts (annonces et contacts par jour).
- Boutons « Pipeline CRM » et « Graphiques » dans Owner Control.

## Itération 1.14
- Gestion autonome des formules : migration 032 (prix + actif) + endpoints GET/POST /staff/owner/offers et toggle.
- Journal des restaurations : table ika_restore_log + GET/POST /staff/owner/restores.
- Boutons « Formules », « Nouvelle formule » et « Journal restaurations » dans Owner Control.

## Itération 1.15
- Workflow réclamations : POST /staff/owner/complaints/:id/resolve (résolution + affectation).
- Alertes d'incident : migration 033 (ika_incidents) + GET/POST /staff/owner/incidents et résolution.
- Boutons « Incidents » et « Nouvel incident » dans Owner Control.

## Itération 1.16
- Pages légales : GET/PUT /staff/owner/legal (CGU, confidentialité, mentions légales).
- Sitemap : GET /sitemap.xml (annonces publiées + pages principales).
- Boutons « Pages légales » et « Sitemap » dans Owner Control.

## Itération 1.17
- Aide à la rédaction IA : POST /staff/owner/ai/write — suggestions de titres et description selon catégorie, transaction, quartier, prix, surface, pièces.
- Bouton « Aide rédaction IA » dans Owner Control.

## Itération 1.18
- Logo : GET/PUT /staff/owner/logo (URL du logo).
- Newsletters : migration 034 (ika_newsletters) + GET/POST /staff/owner/newsletters et envoi.
- Boutons « Logo », « Newsletters » et « Nouvelle newsletter » dans Owner Control.

## Itération 1.19
- Catégories : migration 035 (ika_categories) + GET /staff/owner/categories et toggle.
- Tendances : GET /staff/owner/trends — prix médians par catégorie, top quartiers.
- Boutons « Catégories » et « Tendances » dans Owner Control.

## Itération 1.20
- Langues : migration 036 (ika_languages) + GET /staff/owner/languages et toggle.
- Redirections : table ika_redirects + GET/POST /staff/owner/redirects.
- Boutons « Langues », « Redirections » et « Nouvelle redirection » dans Owner Control.

## Itération 1.21
- Sauvegardes automatiques : migration 037 + scheduler (toutes les 24h) + POST /staff/owner/backup/auto.
- Alertes automatiques : vérification toutes les 15 min (DB, paiements en attente, signalements) + POST /staff/owner/incidents/check.
- Scheduler démarré au lancement de l'application.
- Boutons « Sauvegarde auto » et « Vérifier incidents » dans Owner Control.

## Itération 1.22
- Workflow riche des réclamations : migration 038.
- Endpoints : GET /staff/owner/complaints/:id, assign, comment, resolve, close.
- Statuts : OPEN → IN_PROGRESS → RESOLVED → CLOSED.
- Commentaires internes avec historique.
- Interface enrichie dans Owner Control.

## Itération 1.23
- Interface client des réclamations : GET/POST /me/complaints, détail, commentaires.
- Page /reclamations avec formulaire et historique.
- Lien « Mes réclamations » dans l'espace compte.

## v1.25 — Sauvegarde réelle, réglages publics, newsletter honnête (07/11/2026)

### Sauvegardes
- `server/lib/backup.js` : vrai `pg_dump` (format custom), contrôle `pg_restore --list` + SHA-256, fichier 0600 dans `BACKUP_DIR` (0700), rotation `BACKUP_KEEP`. Mot de passe transmis par variables `PG*`, jamais dans la ligne de commande.
- Migration 039 : statut (`LOGGED` note seule / `OK` fichier vérifié / `FAILED`), nom, taille, empreinte, date de vérification, erreur.
- Échec = ligne `FAILED` + incident CRITICAL. Plus de « sauvegarde » qui n'écrit qu'une ligne.
- `POST /staff/owner/backups/:id/verify` : contrôle d'intégrité (pas une restauration complète).
- Scheduler démarré par `server/index.js` (plus par `createApp`), minuteries `unref`, pas de doublon sous 20 h.
- Dockerfile : client PostgreSQL installé, dossier `backups` inscriptible.

### Site public
- SEO (titre, description, mots-clés) et logo appliqués à l'accueil ; logo et mots-clés sur les pages rendues ; CGU, confidentialité et mentions légales saisies publiées (`/mentions-legales` nouvelle) ; redirections appliquées en 301 ; cache 30 s, repli si la base est illisible.
- `/api/sitemap.xml` (URLs `#/`) redirige vers `/sitemap.xml` (URLs indexables).
- Non encore lus par le public : langues, catégories, campagnes.

### Newsletter
- `SENT` seulement après envoi réel ; refus sans fournisseur e-mail ou sans abonné consentant ; abonnement dans « Mon compte » (table `ika_newsletter_optin`).

### Sécurité / qualité
- Redirections : internes seulement (avant : toute adresse, donc redirection ouverte) ; logo validé.
- Graphiques : vrai graphique SVG au lieu de `alert()`.
- Service worker : `complaints.js` ajouté au préchargement (test `budget.test.js` en échec avant) ; re-tamponné.
- Tests : `test/backup-reel.test.js` (39) ; `owner-control.test.js` adapté.

## v1.24 — Conformité Owner Control (07/11/2026)

### Sécurité
- Toutes les fonctions `/staff/owner/*` exigent SUPERADMIN (34 fonctions passées de ADMIN à SUPERADMIN).
- `POST /staff/owner/backup/auto` et `POST /staff/owner/incidents/check` n'exigeaient aucune authentification : désormais `autoBackupNow` / `autoCheckIncidentsNow` (SUPERADMIN, journalisés). Le scheduler continue d'appeler `autoBackup` / `autoCheckIncidents` en interne.

### Corrections
- `resolveComplaint` : statut `RESOLVED` (et non `DISMISSED`).
- `complaintsOverview` : inclut les réclamations `IN_PROGRESS`.
- `public/sw.js` re-tamponné (`ika-so-82adad2042`) : les tests de version du service worker repassent.

### Tests
- Nouveau `test/owner-control.test.js` : 46 contrôles d'accès, workflow des réclamations, sauvegardes/incidents automatiques, scheduler, pipeline CRM, routes anonymes (les 2 tests HTTP nécessitent `npm install`).

### Suivi
- Feuilles de suivi réalignées : `SUIVI_FONCTIONNALITES_UTILISATEUR_02.xlsx`, `SUIVI_EVOLUTION_OWNER_CONTROL_03.xlsx`.
- Les migrations 033 et 038 ajoutent les mêmes colonnes à `ika_reports` : conservées telles quelles (déjà appliquées possible ; `if not exists`).

## v2.0 — Owner Control Center moderne + traçabilité complète (08/11/2026)

### Nouveau
- Page `/owner` (SUPERADMIN) conforme à la maquette : 5 indicateurs avec évolution, graphique d'activité interactif (annonces, contacts, inscriptions), santé technique, dernières opérations, alertes prioritaires, accès rapides. Thème clair/sombre, palette Ctrl+K, menu mobile, alertes (cloche).
- **Mouvements du site** (`#/activity`) : journal unifié de 20 sources (inscriptions, connexions, annonces, favoris, commentaires, contacts, messages sans contenu, visites, avis, signalements, pièces, paiements, campagnes, newsletters, CRM, incidents, sauvegardes, actions de l'équipe, fréquentation). Filtres période / catégorie / recherche / acteur, volumes par jour, rythme horaire, comptes les plus actifs, mode Direct (15 s), export CSV.
- **Dossiers de traçage** (`#/trace/listing/ID`, `#/trace/user/ID`) : fiche + chronologie complète d'une annonce ou d'un compte.
- **Journal d'audit** (`#/audit`) : actions de l'équipe, consultations et exports inscrits.
- 21 modules de la maquette câblés sur les endpoints existants.

### Serveur
- `server/lib/activity-feed.js` (sources, requêtes paramétrées, fusion exacte à la microseconde, libellés, CSV sûr), `server/services/owner-center.js`.
- Routes : `GET /staff/owner/dashboard`, `/activity`, `/activity/catalog`, `/activity/summary`, `/activity/trace`, `/activity/export.csv`, `GET/PUT /staff/owner/security-log`.
- Migration **042** : `ika_security_log` (connexion, déconnexion, inscription, échec ; sans IP, sans e-mail, sans agent brut) + index de lecture. Retour arrière : `scripts/rollback/042_owner_activity_down.sql`.
- Lien « Ouvrir le nouveau centre » dans l'ancien onglet Owner Control de `/admin`.

### Garde-fous
- Tout est réservé au SUPERADMIN (contrôle refait côté serveur). Contenu des messages jamais lu. Traçage et export inscrits dans `ika_audit`. Export CSV protégé contre l'injection de formules. Sources dont la migration manque : signalées, jamais d'erreur globale. Indicateur indisponible = « — », jamais un faux zéro.
- Tests : `test/owner-center.test.js` (12 tests, fausse base).
