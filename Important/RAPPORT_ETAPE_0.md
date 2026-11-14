# RAPPORT D'ÉTAPE 0 — Audit et état des lieux (IKA SO)

## 0. Mise à jour 0.1.1 — décision du propriétaire (DEC-001)
**Décision enregistrée le 11 novembre 2026 :** l'Owner Center est réservé au **Superadmin et aux admins** (jamais aux modérateurs ni aux utilisateurs) ; la console actuelle est conservée ; un espace **« Mes biens »** sera créé dans le compte unifié à l'étape 3.
**Conséquences notées dans le classeur :** aujourd'hui l'accès est réservé au Superadmin, côté serveur et côté navigateur ; à l'étape 3, il sera ouvert aux admins **module par module, selon les permissions que le Superadmin leur attribue**, ce qui suppose de brancher la matrice de permissions (BUG-004) et de tester le refus pour chaque route. Les modules sensibles (sauvegarde/restauration, paiements/remboursements, rôles, marque, réglages) restent réservés au Superadmin tant qu'ils ne sont pas délégués ; le périmètre exact par module sera proposé à l'étape 1 pour confirmation. Aucun code modifié.

**Date :** 11 novembre 2026 · **Version livrée :** 0.1.1 · **Étape du cahier :** E00 « Audit et sauvegarde »
**Base examinée :** archive `IKA-So_Version_1_du_11_octobre_26.zip` (SHA-256 `b338af39f90aa6a1a860906e5a1b89c816ac2395e2e5952cac8f04b9748b276b`) — conservée telle quelle, c'est la **sauvegarde de l'état initial**.

## 1. Verdict honnête
**Étape 0 : « À vérifier », pas « Terminée ».** L'audit du code est complet, mais trois critères du cahier ne peuvent pas être prouvés dans mon environnement (ni réseau, ni PostgreSQL, ni navigateur) : *application qui démarre réellement*, *sauvegarde restaurable testée*, *captures clair/sombre/mobile*. Ils sont listés dans la décision **DEC-002** avec les commandes à lancer chez vous. **Aucune modification du code n'a été faite** : le projet livré est identique à l'archive d'origine, plus la documentation de l'étape.

## 2. Ce qui a été réellement fait (avec preuves)
| Travail | Preuve |
|---|---|
| Inventaire des écrans, des 249 routes API (29 publiques, 97 avec compte, 123 d'équipe), des rangs requis, des 33 variables d'environnement | `docs/etape-0/CARTOGRAPHIE_ROUTES_API_ROLES.md` (généré par lecture du code) |
| Inventaire des migrations : 58, dont **18 seulement** avec retour arrière | même fichier, section 6 |
| Exécution de la suite du dépôt : **122 tests, 119 réussis, 0 échec, 3 ignorés** | `docs/etape-0/ETAT_DES_TESTS.txt` |
| Contrôles de sécurité statiques : 0 ressource externe (CDN, polices) ; 3 styles bloqués par la CSP ; écritures publiques limitées en débit ; `/owner` servi et protégé côté serveur | `audit` + code (voir anomalies) |
| Classement initial de 20 fonctionnalités, 15 interfaces, 10 dépendances, 13 parcours de recette | classeur `IKA_SO_SUIVI_V0.1_ETAPE_0.xlsx` |

## 3. Architecture réelle constatée
Node 22 / Express 5 / PostgreSQL ; interface HTML-CSS-JavaScript sans framework (20 routes hash dans `app.js`, pages `index.html`, `admin.html`, `owner.html`) ; 58 migrations SQL additives ; fichiers (photos, documents) stockés **dans PostgreSQL** ; CSP stricte (`style-src 'self'`, aucune ressource externe) ; paiement, SMS, e-mail et carte via fournisseurs **configurables, aucun actif par défaut** ; collecte analytique **éteinte** par défaut. Le projet a été développé par plusieurs sessions successives : certaines fonctions annoncées « À faire » dans l'ancien classeur existent déjà (ex. restriction de publication selon le statut annonceur : BUG-007, réaligné).

## 4. État initial des fonctionnalités (détail dans le classeur)
**3 opérationnelles** (compte, console Owner, espace professionnel/annonceurs) · **11 partielles** (dont l'assistance IA heuristique, reclassée après correction à l'étape 1) · **« Mes biens » absent** (F21, ajouté après DEC-001) · **6 à confirmer** faute de test ou de parcours rejoué. « Opérationnelle » = code lu + test unitaire exécuté ; **aucune** n'est déclarée validée en navigateur.

## 5. Anomalies (8) — registre complet dans le classeur
| ID | Gravité | Constat | Statut |
|---|---|---|---|
| BUG-001 | Majeure | 3 styles écrits dans le balisage, bloqués par la CSP : mise en page dégradée sur « Mon profil unique » et le profil annonceur | Ouverte |
| BUG-002 | Majeure | 40 migrations sur 58 sans script de retour arrière | Ouverte |
| BUG-003 | Majeure | 24 modules serveur sans aucun test (modération, messagerie, droits des personnes, notifications…) | Ouverte |
| BUG-004 | Majeure | Permissions nommées non branchées ; deux emplacements Superadmin non appliqués | Ouverte |
| BUG-005 | Majeure | Pas d'authentification à deux facteurs pour l'équipe et les Superadmin | Ouverte |
| BUG-006 | Mineure | 3 tests PostgreSQL ignorés dans mon environnement | Ouverte |
| BUG-007 | Mineure | Ancien classeur contraire au code | **Résolue** |
| BUG-008 | À qualifier | 123 routes `/staff/*` : le contrôle de rôle est dans les services, à tester route par route | Ouverte |

**Aucune anomalie bloquante ni critique relevée.** Les 5 majeures doivent être traitées avant la recette finale.

## 6. Décisions à arbitrer (seulement les indispensables) — il reste DEC-002
- **DEC-001 — Que désigne « Owner Center » ? DÉCIDÉE (section 0).** Console conservée pour le Superadmin et les admins ; « Mes biens » créé à l'étape 3.
- **DEC-002 — Qui exécute démarrage réel, PostgreSQL, restauration et captures ?** **Recommandation : A** — vous lancez les commandes ci-dessous et me renvoyez les sorties/captures.

```
npm ci
npm run check-env
npm test
set DATABASE_URL_TEST=postgresql://postgres:MOTDEPASSE@localhost:5432/ika_so_test   (base de test jetable)
npm run test:integration
npm run migrate        (sur une copie de la base, après sauvegarde)
npm start              puis ouvrir http://localhost:8080 et http://localhost:8080/owner
```

## 7. Ce qui n'est PAS fait (et pourquoi)
Démarrage réel · sauvegarde/restauration PostgreSQL · captures clair/sombre/mobile/tablette/bureau · test des parcours par rôle en navigateur · test réel des fournisseurs (SMS, e-mail, paiement, carte). Cause : environnement sans réseau, sans PostgreSQL et sans navigateur. Statuts « Non testé » / « Bloqué » dans le classeur.

## 8. Livrables, migrations, retour arrière
Projet : archive complète + `RAPPORT_ETAPE_0.md` + `docs/etape-0/*` + `docs/ordonnance/` + classeur dans le dépôt. **Migrations ajoutées : aucune. Retour arrière : sans objet** (aucun code modifié) ; l'état initial se restaure en réutilisant l'archive d'origine (empreinte ci-dessus).

## 9. Étape suivante proposée (E01 — Recette et socle de test)
1. Script de recette chez vous (DEC-002) ; 2. écrire les 40 retours arrière manquants (BUG-002) ; 3. corriger BUG-001 (changement non risqué) ; 4. ajouter des tests aux modules sans test avant de les modifier (BUG-003). Les étapes de transformation (compte unifié, recherche, carte, Owner Center, etc.) ne démarrent qu'après validation de l'étape 0.
