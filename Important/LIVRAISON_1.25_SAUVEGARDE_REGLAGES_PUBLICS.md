# Livraison 1.25 — sauvegarde réelle, réglages appliqués au site public, newsletter honnête (07/11/2026)

## Corrections
| Sujet | Avant | Après |
|---|---|---|
| Sauvegardes auto | une ligne dans un journal | `pg_dump` réel, fichier vérifié (`pg_restore --list` + SHA-256), rotation, journal OK/FAILED, incident CRITICAL si échec |
| SEO / logo | enregistrés, jamais lus | accueil : titre, description, mots-clés, logo ; pages rendues : logo + mots-clés |
| CGU / confidentialité / mentions | enregistrées, jamais lues | publiées (`/conditions`, `/confidentialite`, nouvelle `/mentions-legales`) |
| Redirections | stockées, non appliquées, **toute adresse acceptée** | appliquées en 301 ; internes seulement, boucles refusées |
| Newsletter | passait à « envoyée » sans envoi | « envoyée » seulement après envoi réel, abonnés consentants uniquement |
| Sitemap | URLs `#/` | `/api/sitemap.xml` redirige vers `/sitemap.xml` indexable |
| Graphiques | `alert()` | graphique SVG en barres |
| Scheduler | démarré dans `createApp` (aussi en test), minuteries bloquantes | démarré par `server/index.js`, `unref`, sans doublon sous 20 h |
| Service worker | `complaints.js` hors préchargement (test en échec) | ajouté, version re-tamponnée |
| Docker | pas de `pg_dump` dans l'image | `postgresql-client` + dossier `backups` inscriptible |

Fichiers : `server/lib/backup.js` (nouveau), `server/services/{stats,seo,index}.js`, `server/routes/{index,seo}.js`, `server/seo/{render,legal}.js`, `server/{app,index,config}.js`, `public/js/admin.js`, `public/js/pages/account.js`, `public/css/ika.css`, `public/sw.js`, `migrations/039_backup_reel_newsletter.sql`, `scripts/rollback/039_…_down.sql`, `Dockerfile`, `.env.example`, docs et classeurs de suivi.

## Tests exécutés ici (Node 22, sans npm install)
- Suite complète : **400 tests, 390 réussis**. 7 fichiers ne se chargent pas et 2 tests HTTP sont annulés **pour une seule raison : Express absent** (même cause qu'avant ma modification). Avant : 351 réussis, 8 échecs ; le test de préchargement du service worker, en échec avant, passe.
- `test/backup-reel.test.js` (nouveau, 39 tests) : sauvegarde (succès, échec sans fuite de secret, archive illisible, fichier vide, rotation, altération détectée, nom piégé), journal fidèle, newsletter, redirections/logo, réglages publics, accueil.
- Routage HTTP de `routes/seo.js` : vérifié avec un **faux routeur** (redirection 301, accueil, mentions, textes légaux, accueil inchangé sans réglage). Cela contrôle ma logique, pas Express.

## Non exécutable ici — à faire avant de déployer
1. `npm install`, `npm run migrate` (applique 029 à 039), `npm test` — **jamais exécutés** : pas de PostgreSQL ni d'Express ici. La migration 039 n'a été que relue.
2. `pg_dump` réel : jamais lancé (aucun PostgreSQL). Vérifier : « Sauvegarder maintenant » → ligne `fichier vérifié`, fichier dans `BACKUP_DIR`, puis « Vérifier la dernière ».
3. Newsletter : jamais envoyée via Brevo/Resend (faux expéditeur seulement).
4. Interface admin (graphique, boutons) et case « Newsletter » du compte : aucun navigateur ici.
5. Image Docker non construite ; la version de `postgresql-client` doit être ≥ celle de votre serveur PostgreSQL.

## Anomalies restantes
- La sauvegarde intégrée reste **sur le serveur et non chiffrée** : copie hors serveur = `scripts/backup.sh` ; restauration complète = `scripts/restore-check.sh` (manuel). Sans disque persistant, les fichiers disparaissent au redéploiement.
- Langues, catégories, campagnes : toujours enregistrées sans effet public.
- La version du consentement (`lib/legal.js`) n'est pas incrémentée quand le propriétaire modifie CGU/confidentialité.
- Titre/description des pages d'annonce restent ceux de chaque page (seuls l'accueil et les mots-clés suivent le réglage).
- Graphiques : période fixe de 30 jours. Newsletter : pas de lien de désabonnement cliquable (seulement la consigne « Mon compte > Newsletter »).
- `/staff/owner/*` : les erreurs de validation anciennes lèvent encore des `Error` simples (réponse 500) ; seules les nouvelles utilisent `badRequest`.

## Déploiement et vérification
`npm install` → `npm run migrate` → `npm test` (attendu : tout vert, y compris les 2 tests HTTP) → `npm run stamp-sw -- --check` → déployer avec `BACKUP_DIR` sur disque persistant (et `BACKUP_KEEP`) → se connecter en SUPERADMIN, Owner Control : « Sauvegarder maintenant », « Vérifier la dernière », saisir SEO + logo puis recharger `/` et une page `/quartiers`, créer une redirection `/test-ancien` → `/quartiers` et l'ouvrir. Retour arrière : `scripts/rollback/039_backup_reel_newsletter_down.sql`.
