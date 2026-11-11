# Ika So

L'immobilier au Mali, plus accessible. Pilote à Bamako : terrains et logements.
Pile : Node.js 22, Express, PostgreSQL, CSS et JavaScript natif. Deux dépendances seulement : `express` et `pg`.
Aucune ressource externe : pas de CDN, pas de script tiers, pas de marque tierce.

## Lancer en local

```bash
npm install
createdb ika_so            # PostgreSQL 15 ou 16
cp .env.example .env       # valeurs par défaut = poste local (NODE_ENV=development) ; renseignez DATABASE_URL
npm run dev                # lit .env, applique les migrations puis écoute sur http://localhost:8080
```

Le fichier `.env` contient des secrets : il ne se commite pas et ne se met dans aucune archive envoyée à un tiers (`.gitignore` et `.dockerignore` l'excluent déjà). Avant une mise en ligne : `node scripts/check-env.mjs`.

Hors production, le premier inscrit devient super administrateur et le code SMS s'affiche à l'écran (mode démonstration, sans badge « vérifié »).

## Production

Variables : voir `.env.example`. Points obligatoires :
- `NODE_ENV=production`, `DATABASE_URL`, HTTPS devant l'application (Cloudflare ou autre) ;
- SMS Twilio (`SMS_PROVIDER=twilio` + 3 identifiants), sinon la vérification du numéro est refusée ;
- premier administrateur : `BOOTSTRAP_ADMIN=true` + `BOOTSTRAP_ADMIN_EMAIL=votre@adresse`, à retirer ensuite.

## Organisation

- `server/lib` : règles métier (`rules.js`), sécurité, erreurs, en-têtes HTTP.
- `server/services` : comptes, annonces, modération. Toute la logique et tout le SQL (requêtes paramétrées).
- `server/routes` : routes fines. `server/app.js` : Express, session, protections.
- `migrations/` : versionnées, appliquées au démarrage et par `npm run migrate`.
- `server/lib/file-storage.js` : stockage durable des fichiers dans PostgreSQL/Neon.
- `public/` : interface (mobile d'abord) et centre de contrôle `/admin.html`.

## Tests

```bash
npm test                              # règles, sécurité HTTP ; parcours complet si DATABASE_URL_TEST est défini
DATABASE_URL_TEST=postgresql://… npm test   # base jetable : elle est VIDÉE à chaque lancement
```

## Sécurité en bref

Mot de passe haché (scrypt) ; session = cookie opaque `HttpOnly`, `SameSite=Lax`, `Secure` en production, seul son hachage est en base ; bannissement = sessions fermées ; écritures refusées hors de notre origine ; CSP stricte (`'self'` partout) ; numéro du propriétaire jamais dans les données publiques (il sort par « Appeler » ou « WhatsApp », compté) ; aucune adresse IP stockée.

## Pas encore fait

Voir `SUIVI.md` (état du projet, ce qui reste), `docs/phase-*.md` (rapports) et `docs/decisions.md`.

## Exploitation (phase 1)

- Journaux : une ligne JSON par événement sur la sortie standard (`LOG_LEVEL` pour le niveau). Jamais d'IP, de cookie, de mot de passe ni de contenu de requête. Chaque réponse `/api` porte `X-Request-Id`, repris dans le journal et dans les erreurs 500 : citez-le pour retrouver l'incident.
- Santé : `GET /api/health` (200 si la base répond, 503 sinon).
- Erreurs du navigateur : envoyées à `/api/client-error` (message et lieu seulement) et journalisées en `warn`.
- Docker : `docker build -t ika-so .` puis `docker run -e DATABASE_URL=… -p 8080:8080 ika-so`.
- Intégration continue : `.github/workflows/ci.yml` (PostgreSQL 16, `npm test`).
- PostgreSQL : le paquet « contrib » est requis (extensions `unaccent` et `pg_trgm`).
- `npm test` inclut le budget de performance et le contrôle « aucun CDN ».
- Frontend : `public/js/core` (état, routeur), `components`, `pages` (chargées à la demande).

## Phase 6 — pages publiques et import

- `PUBLIC_URL` (ex. `https://ika-so.example`) : adresse publique utilisée dans `/sitemap.xml` et les liens canoniques. À définir en production.
- Pages lisibles sans JavaScript : `/quartiers`, `/quartier/:slug`, `/a/:id`, `/agences`, `/guides`.
- Import CSV (agences) : modèle sur `/modele-import.csv`, 200 lignes et 400 Ko au plus, tout ou rien.

## Phase 5 — paiements (socle)

- `PAYMENT_PROVIDER` : vide = paiements fermés (défaut). `fake` = démonstration, refusé en production. Un vrai agrégateur s'ajoute dans `server/payments/providers.js` (contrat expliqué en tête du fichier).
- `PAYMENT_WEBHOOK_SECRET` : secret de signature des confirmations (jamais dans le code).
- Les offres démarrent inactives et à prix 0 : l'administrateur fixe le prix dans `/admin.html`, onglet « Paiements ».
- Contrôles : `npm test` (dont `test/securite.test.js`) ; accessibilité : `node scripts/verification/a11y.mjs` (voir en-tête du fichier).
- Sauvegarde chiffrée hors serveur : voir « Sauvegardes et restauration » ci-dessous. Les scripts ne doivent pas être exécutés dans le service web Render ni viser une base de production pour un test de restauration.



## Sauvegardes et restauration (procédure renforcée)

Les sauvegardes ne doivent pas rester uniquement sur le disque du service web Render : ce disque peut être éphémère. La sauvegarde doit être exécutée depuis un runner de confiance (poste d'administration sécurisé ou tâche planifiée dédiée) et copiée vers un stockage distant indépendant.

### Prérequis

- `pg_dump`, `pg_restore`, `age`, `rclone` et `sha256sum` installés sur le runner.
- Une destination distante `rclone` configurée (par exemple un bucket objet compatible S3/R2) ; exemple de chemin : `r2:ika-so-backups/production`.
- Une paire de clés `age` : seule la clé publique est utilisée pour chiffrer ; la clé privée de restauration est conservée hors du serveur et hors du stockage de sauvegarde.
- `DATABASE_URL` fournie comme secret au runner. Ne jamais l'inscrire dans le dépôt, les journaux ou une commande partagée.

### Créer une sauvegarde

```bash
DATABASE_URL="$DATABASE_URL" \
BACKUP_REMOTE="r2:ika-so-backups/production" \
BACKUP_AGE_RECIPIENT="age1..." \
scripts/backup.sh
```

Le script produit un dump PostgreSQL au format custom, vérifie que `pg_restore` peut lire l'archive, chiffre le dump avec `age`, génère un SHA-256, envoie le dump chiffré et son empreinte vers `BACKUP_REMOTE`, puis compare le contenu distant avec `rclone check --download`. Il échoue si une variable ou une commande requise manque. Il ne conserve aucun dump en clair après la fin du script et ne supprime pas automatiquement les anciennes sauvegardes distantes : la rétention doit être configurée explicitement côté stockage après validation de la politique et des obligations de conservation.

### Tester une restauration

**Utiliser exclusivement un serveur PostgreSQL de test isolé**, jamais `DATABASE_URL` de production. L'URL d'administration doit pointer vers une instance jetable où le compte peut créer puis supprimer une base. Télécharger localement le fichier `.dump.age` et son fichier `.sha256`, puis fournir la clé privée `age` depuis un emplacement sécurisé :

```bash
RESTORE_TEST_ADMIN_URL="postgresql://.../postgres" \
BACKUP_AGE_IDENTITY="/chemin/protege/age-identity.txt" \
RESTORE_TEST_ALLOW_CREATE_DATABASE="YES_I_UNDERSTAND_THIS_IS_A_DISPOSABLE_TEST_SERVER" \
scripts/restore-check.sh "/chemin/ika-so-....dump.age"
```

Le script exige une confirmation explicite que le serveur est jetable, vérifie l'empreinte, déchiffre dans un répertoire temporaire, restaure dans une nouvelle base au nom généré, vérifie que la base restaurée répond et contient des tables applicatives, puis supprime la base temporaire. Il ne compare pas la sauvegarde à la base de production et ne prend pas `DATABASE_URL` comme cible. La base d'administration fournie reste néanmoins une ressource sensible : ne renseigner qu'une instance de test dédiée.

Cette vérification prouve qu'une archive peut être restaurée dans cet environnement de test ; elle ne remplace pas un exercice périodique de reprise complet, la vérification des pièces `stored_files`, ni une procédure de récupération testée après incident.

## Stockage durable des fichiers (Render + Neon)

Render peut remplacer le système de fichiers local lors d'un redémarrage ou d'un nouveau déploiement. Ika So ne doit donc pas utiliser le disque local du service web pour conserver les photos ou justificatifs des utilisateurs.

- La migration `migrations/009_stored_files.sql` crée `stored_files` dans PostgreSQL et rattache les justificatifs privés à cette table.
- Les photos d'annonces et les justificatifs de vérification foncière/agence sont enregistrés en binaire (`BYTEA`) dans la base configurée par `DATABASE_URL` ; le serveur Render ne conserve pas ces fichiers sur son disque. La table accepte aussi les mêmes formats pour de futurs logos et documents, mais les formulaires correspondants ne sont pas encore tous raccordés.
- Lorsqu'une annonce est modifiée, une URL `/api/media/:id` n'est réutilisable que si le fichier est déjà rattaché à cette même annonce et à son propriétaire ; les chemins `/media/` statiques sont limités à des noms de fichiers simples pour éviter les chemins de traversée.
- Les anciennes photos et pièces encodées en data URL sont transférées par cette migration lorsqu'elles respectent les formats et limites. **La valeur d'origine est conservée** dans les colonnes `legacy_*` (`ika_proofs.legacy_file_data`, `ika_listings.legacy_image_url`, `ika_listing_photos.legacy_url`), tant que la migration n'est pas validée en réel ; les lignes illisibles sont ignorées et restent intactes. La migration `010_media_index.sql` ajoute les index utilisés par la lecture des images.
- Les images publiques sont servies par `GET /api/media/:id` : cache navigateur privé de 5 minutes avec ETag pour les annonces publiées, jamais de cache pour les annonces non publiées ; ce chemin a son propre compteur de débit (1 200 requêtes/min/adresse), distinct des 240 requêtes/min des autres routes. Les PDF et pièces justificatives restent accessibles uniquement par le parcours de contrôle réservé au personnel.
- Formats autorisés : JPEG, PNG, WebP et PDF ; taille maximale de stockage : 2 Mo par fichier (les justificatifs conservent également leur limite métier actuelle de 700 Ko).
- Pour Render, conserver `DATABASE_URL` pointant vers une base PostgreSQL persistante, par exemple Neon. Ne jamais pointer cette variable vers une base temporaire qui serait recréée.
- Les sauvegardes PostgreSQL/Neon doivent être planifiées et une restauration doit être testée. Le stockage en base protège des redémarrages Render, mais ne remplace pas une sauvegarde.
- Pour une croissance importante du volume photo, prévoir ultérieurement un stockage objet compatible S3 (par exemple Cloudflare R2) et garder PostgreSQL pour les métadonnées.

Avant d'appliquer la migration `009_stored_files.sql`, exécuter le précontrôle suivant sur une copie restaurée de la base (après les migrations 001 à 008) :

```bash
psql "$DATABASE_URL_TEST" -X -v ON_ERROR_STOP=1 -f scripts/preflight-stored-files.sql
```

Ce rapport en lecture seule (à exécuter après les migrations 001 à 008) repère les anciennes data URLs mal formées, les MIME non pris en charge, les justificatifs dont le MIME déclaré diffère de celui de la data URL, les contenus base64 invalides et les fichiers dépassant 2 Mio. Toute ligne `BLOCKER` doit être examinée avant la migration. Le statut `candidate_compatible` est seulement un contrôle préliminaire de syntaxe/taille : il ne vérifie pas la signature binaire réelle du fichier. Ne pas lancer la migration sur Neon tant que le précontrôle et une répétition complète sur PostgreSQL jetable ne sont pas concluants.

Après déploiement, vérifier dans les journaux que la migration `009_stored_files.sql` est appliquée, puis créer une annonce avec photo, redémarrer le service Render et vérifier que la photo reste visible.

### Diagnostic en lecture seule du stockage des fichiers

Après application de la migration `009_stored_files.sql`, un diagnostic SQL permet de repérer les références médias manquantes, les justificatifs sans contenu, les anciennes data URLs, les tailles incohérentes, les fichiers réutilisés entre plusieurs annonces et les fichiers sans référence connue.

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/audit-stored-files.sql
```

Le script ouvre une transaction `READ ONLY` et ne contient aucune opération de modification. Il ne supprime ni ne corrige rien. Les fichiers dits « non référencés » sont seulement des candidats à examiner : ils peuvent appartenir à une fonctionnalité future ou à une relation non couverte par ce diagnostic. Ne jamais les supprimer automatiquement. Exécuter d'abord sur une copie ou une base de test ; sur Neon, ne l'utiliser qu'après vérification du nom de la base et avec un compte SQL en lecture seule.

### Nettoyage manuel des fichiers orphelins

Commande d'administration, **jamais automatique** (ni au démarrage, ni par minuterie, ni par une route). Simulation par défaut :

```bash
DATABASE_URL=… npm run files:orphans                                   # simulation : liste, ne supprime rien
DATABASE_URL=… npm run files:orphans -- --apply --confirm=SUPPRIMER    # supprime un lot
```

Options : `--min-age-hours=72` (24 au minimum : protège un téléversement en cours) et `--limit=200` (1 000 au maximum, un lot par exécution). Un fichier n'est supprimé que s'il n'est référencé ni par une annonce, ni par une galerie, ni par un justificatif ; ces références sont revérifiées au moment de supprimer. Chaque suppression laisse une trace `ORPHAN_FILES_DELETE` dans `ika_audit`. Avant de supprimer : sauvegarde vérifiée, puis lire la simulation et `scripts/audit-stored-files.sql`.

### Version du cache hors connexion

La version du service worker est calculée depuis le contenu des fichiers du site : après toute modification de `public/`, lancer `npm run stamp-sw` (un test échoue tant que ce n'est pas fait).

## Déploiement sur Render + Neon (pas à pas)

1. **Verrou des dépendances (une fois, poste connecté)** : `npm install`, puis versionner `package-lock.json`. Le Dockerfile et la CI utilisent `npm ci` et échouent sans ce fichier.
2. **Variables d'environnement Render**

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` (obligatoire : sans lui le serveur refuse de démarrer) |
| `DATABASE_URL` | URL Neon **avec `?sslmode=require`** |
| `TRUST_PROXY` | `1` (Render place un proxy devant l'application ; sans cela tous les visiteurs partagent les mêmes compteurs anti-abus) |
| `PUBLIC_URL` | adresse publique du site, sans « / » final |
| `BOOTSTRAP_ADMIN` + `BOOTSTRAP_ADMIN_EMAIL` | pour créer le premier super administrateur (voir ci-dessous) |
| `SMS_PROVIDER`, `TWILIO_*` | si les SMS réels sont ouverts |
| `PAYMENT_PROVIDER` (cinetpay, paydunya) et ses clés ; `SMS_PROVIDER` ; `EMAIL_PROVIDER` | seulement à l'activation du fournisseur : voir `docs/fournisseurs.md` (tout est éteint par défaut) |

3. **Commande de démarrage** : `npm start` (applique les migrations en attente avant d'ouvrir le port). **Chemin de contrôle de santé** : `/api/health`.
4. **Migrations sensibles (009)** : lancer d'abord `npm run migrate` seul avec `DATABASE_URL` pointant sur une *copie restaurée* de Neon, après le précontrôle et avec une sauvegarde vérifiée. La migration est tolérante aux données mal formées (les lignes illisibles sont laissées intactes) et conserve les valeurs d'origine dans `ika_proofs.legacy_file_data`, `ika_listings.legacy_image_url` et `ika_listing_photos.legacy_url` ; comparer les nombres avant/après avec `scripts/audit-stored-files.sql`.
5. **Premier administrateur** : poser `BOOTSTRAP_ADMIN=true` et `BOOTSTRAP_ADMIN_EMAIL`, démarrer, **créer aussitôt le compte avec cette adresse** (l'adresse n'est pas vérifiée : tant que le compte n'existe pas, quiconque s'inscrit avec elle devient super administrateur), puis retirer ces deux variables.
6. **Après déploiement** : annonce avec photo, justificatif, redémarrage puis redéploiement Render, vérifier que les fichiers persistent.

## Interface et identité visuelle

L'accueil utilise une présentation responsive bleu profond/bleu vif, blanc et accent or : navigation latérale sur écran large, navigation compacte sur mobile, bandeau immobilier, recherche et cartes d'annonces. Les images du bandeau proviennent des visuels immobiliers déjà inclus dans `public/media/`. La refonte est visuelle : elle conserve les routes, les appels API, les contrôles d'accès et les données existantes. Les indicateurs chiffrés de la maquette de référence ne sont pas simulés ; les annonces continuent d'être chargées depuis l'API.

## Icônes

Les icônes sont des SVG en ligne (`public/js/icons.js`), sans fichier ni service externe, et prennent la couleur du texte. Elles sont posées automatiquement devant les libellés par `public/js/decorate.js` d'après les règles de `public/js/icon-rules.js` (texte du libellé → nom d'icône). Pour en ajouter une : l'ajouter dans `icons.js`, puis une règle dans `icon-rules.js` ; un libellé sans règle reste sans icône. Après toute modification de `public/`, lancer `npm run stamp-sw`.

## Brouillon d'annonce côté serveur

`migrations/011_listing_drafts.sql` ajoute `ika_listing_drafts` (additive, aucune table existante modifiée). Routes : `GET`, `PUT` et `DELETE /api/me/draft` (connecté ; `PUT` limité à 120 par 10 minutes et par compte). Le contenu est nettoyé par liste blanche (`server/lib/drafts.js`), plafonné à 20 Ko, sans règle métier : la validation se fait à la soumission. Appliquer avec `npm run migrate`.

## Historique de prix

`migrations/012_price_history.sql` ajoute `ika_listing_price_history` (additive) et reprend les annonces publiées. `GET /api/listings/:id` renvoie `priceHistory` (20 points au plus, du plus récent au plus ancien, vide s'il n'y a pas eu de changement). Appliquer avec `npm run migrate`.

## Alertes groupées (résumé quotidien)

`migrations/013_alert_digest.sql` ajoute `ika_alert_prefs` et `ika_alert_pending` (additive). Routes : `GET` et `PUT /api/me/alert-prefs` (`{ "mode": "INSTANT" | "DAILY" }`). Le serveur lance toutes les 15 minutes `engagement.flushDigests()` ; elle peut aussi être appelée à la main. Appliquer avec `npm run migrate`.

## Blocage et signalement dans la messagerie

`migrations/014_user_blocks_reports.sql` ajoute `ika_user_blocks` et `ika_user_reports` (additive). Routes : `POST /api/me/threads/:id/block`, `/unblock`, `/report` (`{ reason, details }`) ; côté équipe, la file `userReports` est dans `GET /api/staff/trust` et `POST /api/staff/user-reports/:userId/dismiss` écarte les signalements d'une personne. Appliquer avec `npm run migrate`.

## Remboursements, rapprochement, expiration

`migrations/015_payment_refunds.sql` ajoute des colonnes à `ika_payments` (`refunded_at`, `refund_reason`, `refunded_by`, `refund_ref`, `refund_confirmed_at`) et deux index ; aucune colonne existante n'est modifiée. `POST /api/staff/payments/:id/refund` accepte `{ reason, refundRef? }` et est rejouable. Le webhook accepte `status: "REFUNDED"` (remboursement complet). `GET /api/staff/payments/reconcile` renvoie en plus `expired`, `refunded`, `refundsToConfirm` et `refundable`. Les paiements en attente depuis plus de 24 h passent à `EXPIRED` (minuterie horaire quand les paiements sont activés). Appliquer avec `npm run migrate`.

## Mise en ligne

- `npm run check-env` : contrôle la configuration de production avant ouverture (n'affiche aucun secret).
- `docs/exploitation.md` : déploiement, premier démarrage, sauvegardes, surveillance, incidents.

## Droits des personnes et textes juridiques (lot 8)
- Inscription : case « J'accepte les conditions et la politique de confidentialité » obligatoire ; la version acceptée (`server/lib/legal.js`, `LEGAL_VERSION`) et la date sont enregistrées (migration 016). Changez `LEGAL_VERSION` à chaque modification des textes.
- « Mon profil » : **Télécharger mes données** (`GET /api/me/export`) et **Supprimer mon compte** (`POST /api/me/delete`, mot de passe + mot `SUPPRIMER`). Un compte ayant des paiements est anonymisé (les factures sont conservées avec le nom du client à l'émission).
- Pages `/confidentialite` et `/conditions` : rendues depuis `docs/juridique/projet-*.md`. La bannière « texte provisoire » reste affichée tant que `LEGAL_VALIDATED` vaut `false` dans `server/lib/legal.js` : ne le passez à `true` qu'après relecture par un juriste malien.
- Badge « Titre foncier contrôlé » : donné seulement si l'annonce déclare un Titre Foncier (voir `docs/juridique/procedure-controle-badges.md`).
- Documents : `docs/juridique/note-cadre-juridique-mali.md` (cadrage sourcé), `plan-conformite.md` (18 points à traiter avant l'ouverture au public).

## Profil de l'annonceur et avis (lot 9)
- `GET /api/advertisers/:id` (public) : profil, statut de confiance, expérience, note, meilleurs et pires avis, annonces en ligne. Jamais d'e-mail ni de téléphone.
- Avis : `POST /api/advertisers/:id/reviews` (note 1–5 + texte), seulement après un message ou un contact avec l'annonceur ; `POST /api/reviews/:id/report` ; modération dans l'onglet « Confiance » du centre de contrôle.
- Les critères du statut de confiance sont dans `server/services/reviews.js` (`trustSummary`) : à ajuster ici, avec les tests.

## Messagerie façon WhatsApp (lot 12)
- `GET /api/me/threads` : discussions avec compteur de non-lus, dernier message, coche « lu ». `GET /api/me/threads/:id` : conversation (chaque message sortant porte `read`).
- Le navigateur interroge la conversation ouverte toutes les 8 secondes (`public/js/pages/inbox.js`). Pour du temps réel, prévoir WebSocket ou SSE plus tard.
- Fonctions d'affichage (heures, jours, coches, pastilles) : `public/js/components/chat.js`.

## Lot 13 — fournisseurs tiers prêts, éteints
Code de SMS (Twilio, Infobip), paiement (CinetPay, PayDunya), e-mail (Brevo, Resend) et alertes par personne (`GET/PUT /api/me/notify-prefs`, migration `019_fournisseurs.sql`). Guide d'activation : `docs/fournisseurs.md`. Conservation des données : `npm run retention` (simulation) puis `--apply --confirm=PURGER`. Le webhook de paiement accepte JSON et formulaire (`application/x-www-form-urlencoded`).
