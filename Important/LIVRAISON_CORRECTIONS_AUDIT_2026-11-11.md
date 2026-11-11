# Livraison — corrections de l'audit du 11 novembre 2026

Projet : Ika So v0.2.0 (Node 22, Express 5, PostgreSQL). Périmètre : corrections COR-001 à COR-005, rien d'autre.
Règle suivie : aucun code opérationnel réécrit, aucune migration ajoutée, aucune fonctionnalité retirée.

## 1. Version de référence et retour arrière
- Référence = l'archive `ika-so-projet.zip` reçue avant intervention (conservée telle quelle).
- Aucune migration : la base n'est pas touchée. Un retour arrière = ré-extraire l'archive d'origine.
- Fichiers modifiés : voir `SUIVI_CORRECTIONS_AUDIT_2026-11-11.xlsx`, feuille « Fichiers modifiés ».

## 2. Corrections

| Réf. | Anomalie | Cause racine | Correction | État |
|---|---|---|---|---|
| COR-001 | Secrets réels dans l'archive | `.env` inclus à l'archivage (clé API Infobip, URL de base avec mot de passe) | `.env` retiré de la livraison ; avertissement README et CHANGELOG | **Action propriétaire requise** |
| COR-002 | `.env` incohérent avec un poste local | `.env.example` proposait `NODE_ENV=production` et `TRUST_PROXY=1` ; `Lancer le site.bat` le copie tel quel et lance `npm run dev` ; README demandait `export DATABASE_URL` alors que `dev` lit `.env` | Modèle en `development` / `TRUST_PROXY=0` ; avertissement `BASE_LOCALE` dans `check-env` ; README corrigé | Corrigé, test partiel |
| COR-003 | Injection HTML du nom de plateforme | `app.js` : `foot.innerHTML = foot.innerHTML.replace(…, platformName)` ; le serveur ne fait que tronquer à 80 caractères | `replaceTextIn()` (`dom.js`) : texte seulement, motifs `$&` non interprétés | Corrigé, test partiel |
| COR-004 | Version du cache hors-ligne périmée | Fichiers du site modifiés sans recalcul de `sw.js` | `npm run stamp-sw` (`ika-so-8e404eb40c` → `ika-so-5c1ca8c60c`) ; `stamp-sw:check` ajouté à la CI | Corrigé et testé |
| COR-005 | Tests insuffisants | CI avec PostgreSQL mais aucun test ne l'utilisait ; `test:rules` visait un fichier absent ; `web.test.js` cité mais absent | 5 fichiers de tests ajoutés (voir §3) | Corrigé, test partiel |

**COR-001 — ce que je n'ai pas pu faire.** Révoquer la clé et changer le mot de passe se fait chez Infobip et dans PostgreSQL : c'est à vous de le faire. Tant que ce n'est pas fait, considérez les deux comme compromis.

## 3. Bilan des tests (exécutés dans cet environnement)

| Contrôle | Résultat |
|---|---|
| `npm test` (suite complète) | 91 tests : **88 réussis, 0 échec, 3 ignorés** |
| `npm run test:rules` (script réparé) | 14 réussis |
| Syntaxe de tous les JS (`node --check`) | 0 échec |
| Imports relatifs | 196 analysés, 0 non résolu |
| `npm run stamp-sw:check` | avant : échec ; après : OK |
| Nouveaux tests rejoués sur la version d'origine | `platform-name` : 5 échecs sur 5 ; `preflight` : 2 échecs sur 6 ; `web` et `rules` passent des deux côtés |

Lecture du dernier point : les tests de COR-002 et COR-003 échouent sans la correction et passent avec. Les tests `web` et `rules` sont des tests de caractérisation : ils ajoutent de la couverture, ils ne prouvent la correction d'aucun défaut.

## 4. Ce qui n'a PAS été exécuté
- **Les 3 tests d'intégration PostgreSQL + HTTP** (`test/integration-pg.test.js`) : pas de PostgreSQL ici. Ils sont ignorés sans `DATABASE_URL_TEST`. Leurs hypothèses (noms de tables, fonction `ika_norm`, séquence `ika_invoice_seq`, codes 401/403/404) ont été recoupées avec les migrations et les routes, mais **leur première exécution réelle sera celle de la CI**. Un échec y est possible et à examiner.
- Démarrage du serveur : `express` et `pg` ne sont pas installés ici (pas de réseau).
- Rendu du pied de page dans un vrai navigateur : `replaceTextIn` est testé sur de faux nœuds DOM, pas dans un navigateur.
- Comportement réel d'un cookie `Secure` sur `http://localhost` : analysé dans le code, non reproduit.
- `Lancer le site.bat` sous Windows, Mapbox, SMS et paiements réels.

## 5. Anomalies restantes
Voir la feuille « Anomalies restantes » du fichier Excel. Les principales :
1. Révoquer la clé Infobip et changer le mot de passe PostgreSQL (propriétaire).
2. Votre `.env` local reste en `NODE_ENV=production` : je n'y ai pas touché (pas de changement de configuration sans votre validation). Passez-le en `development` sur votre poste.
3. Neuf routes serveur sans appel trouvé dans le front (recherche par chaînes littérales, à confirmer).
4. Rollback disponible pour 17 migrations sur 51.
5. Aucun test de bout en bout navigateur rejoué (`scripts/verification/e2e-browser.mjs` existe, non lancé).

## 6. Déploiement et vérification
1. Révoquer la clé Infobip et changer le mot de passe PostgreSQL ; mettre les nouvelles valeurs dans **votre** `.env` (jamais dans l'archive).
2. Sur le poste local : `NODE_ENV=development` et `TRUST_PROXY=0` dans `.env`, puis `npm install` et `npm run dev`.
3. Vérifier : `npm test` (91 tests, 3 ignorés sans base) ; `npm run stamp-sw:check` (doit réussir).
4. Pour exécuter l'intégration : `createdb ika_test`, puis `DATABASE_URL_TEST=postgresql://…/ika_test npm run test:integration` (le nom de la base doit contenir « test »).
5. En production : `node scripts/check-env.mjs` avant ouverture ; après tout changement dans `public/`, relancer `npm run stamp-sw`.
6. Dans le navigateur, après déploiement : le pied de page affiche le nom de plateforme ; un nom contenant `<b>x</b>` s'affiche tel quel, balises comprises.
