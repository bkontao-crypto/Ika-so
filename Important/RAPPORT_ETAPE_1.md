# RAPPORT D'ÉTAPE 1 — Architecture et UX (IKA SO)

**Date :** 11 novembre 2026 · **Version livrée :** 0.2 · **Étape du cahier :** E01 « Architecture et UX »
**Base :** V0.1.1 (étape 0) — aucun code applicatif modifié, aucune migration.

## 1. Verdict honnête
**Étape 1 : « À vérifier » (livrée, validation du propriétaire attendue).** Les livrables sont complets et le critère du cahier — *chaque écran relié à un besoin, une source et des permissions* — est **prouvé par un test automatique**. Deux limites : la maquette n'a pas été vue dans un navigateur réel, et le reste hérité de l'étape 0 (démarrage réel, restauration, captures, **DEC-002**) est toujours ouvert.

## 2. Livrables (dans `docs/etape-1/`)
| Livrable | Contenu | Preuve |
|---|---|---|
| `SITEMAP_PARCOURS.md` + `sitemap.json` | **35 écrans** (23 existants, 11 à créer, 1 à refondre) avec besoin, parcours, source, droits, étape ; 5 parcours clés ; compte unifié à onglets contextuels | `test/etape1-docs.test.js` : aucun champ vide, chaque module d'écran de `app.js` présent, tous les fichiers cités existent |
| `MATRICE_DROITS.md` + `matrice-owner-center.json` | 8 rôles × 15 capacités ; **Owner Center module par module : 29 délégables aux admins, 11 réservés au Superadmin** | même test : la matrice couvre **exactement les 40 segments** `/staff/owner/*` du code |
| `DESIGN_SYSTEM.md` | 66 variables CSS, thèmes, points d'arrêt, composants réellement utilisés, constats | relevé automatique des feuilles de style |
| `COMPARATIFS_ET_DECISIONS.md` | marché, paiement, cartographie, 5 décisions proposées ; fiabilité A/B/C par source | 3 recherches web (limites indiquées) |
| `maquettes/compte-unifie.html` | maquette interactive : 6 profils (membre, annonceur, propriétaire, agence Premium, admin, Superadmin) → onglets et boutons Console / Owner Center | aperçu publié ; vérification en navigateur réel non faite |

## 3. Ce que l'étape révèle
- **Le compte unifié se réduit à des onglets contextuels** : aucune migration de comptes n'est nécessaire. Ce qui manque est « Mes biens » (aucune entité « bien » dans le code) et le branchement des permissions (BUG-004).
- **Owner Center ouvert aux admins** (DEC-001) : proposé 29 modules délégables (attribués par le Superadmin, désactivés par défaut) et 11 sensibles réservés au Superadmin : sauvegardes (2 modules), restaurations, offres/tarifs, réglages, marque, textes légaux, SEO, pays, journal de sécurité et assistance IA (liste exacte : matrice).
- **Design** : quatre familles de boutons et de cartes coexistent et 10 feuilles CSS sans priorité documentée (**BUG-009**, mineure) → étape 2.
- **Marché** : différenciation crédible = confiance (vérification, profils annonceurs, avis), expiration des annonces, transparence (« prix déclarés », IKA SO n'est pas agent). Fiabilité des sources : surtout B/C ; **aucune source officielle de fournisseur n'a été consultée**.
- **Carte** : le géocodage Mapbox *permanent* (résultats conservés) est payant sans quota gratuit selon les sources consultées → ne pas stocker de résultats de géocodage Mapbox ; couverture de Bamako à vérifier.

## 4. Correction de mon audit de l'étape 0
J'avais classé l'« Assistance IA » comme **absente**. C'était faux : l'Owner Center contient un module « Assistance IA » heuristique (doublons, prix atypiques, rafales, aide à la rédaction par modèles ; `stats.js`), sans fournisseur d'IA. Reclassée **Partielle** dans le classeur ; `RAPPORT_ETAPE_0.md` corrigé. Aucun autre classement n'a changé.

## 5. Décisions
| ID | Sujet | Statut | Défaut appliqué sans réponse |
|---|---|---|---|
| DEC-001 | Owner Center | **Décidée** (11/11) | — |
| DEC-002 | Démarrage réel, PostgreSQL, restauration, captures | Ouverte | « Non testé » maintenu |
| DEC-003 | Matrice des modules Owner Center ouverts aux admins | Proposition prête | **A** (29 / 11), à l'étape 3 |
| DEC-004 | Entité « bien » distincte de l'annonce | Proposition prête | **A** (nouvelle entité, migration additive), à l'étape 3 |

## 6. Tests
Suite du dépôt : **128 tests, 125 réussis, 0 échec, 3 ignorés** (PostgreSQL absent ; Express remplacé par un substitut dans mon environnement). Dont 6 nouveaux tests (`etape1-docs`) : cohérence plan du site / matrice / code. À rejouer avec le vrai Express et PostgreSQL (DEC-002).

## 7. Livrables, migrations, retour arrière
Projet complet + `RAPPORT_ETAPE_1.md` + classeur V0.2 (à la racine et en copie). **Migrations : aucune. Retour arrière : sans objet** (documentation et un test ajoutés ; retirer `docs/etape-1/` et `test/etape1-docs.test.js` suffit).

## 8. Étape suivante : E02 « Socle visuel et navigation »
Unifier les composants (un seul jeu de boutons, cartes, pastilles, onglets, champs, états), corriger BUG-001 (3 styles en ligne), vérifier clair/sombre et responsive. **Elle exige un navigateur** pour sa preuve (captures) : sans DEC-002, je livrerai le code et marquerai les vérifications visuelles « Non testé ».
