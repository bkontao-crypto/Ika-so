# ARCHITECTURE ANALYTIQUE — IKA SO (Phase 2, conception)

| | |
|---|---|
| Référentiel | Ordonnances consolidées v1.0, art. 2, 11 à 19, 21 (Phase 2) |
| Base | `AUDIT_INITIAL_IKA_SO.md`, `SPECIFICATION_SUPERADMIN.md` |
| Nature | Architecture de référence ; l’émission des 22 événements est branchée dans les routes et le client. Collecte désactivée par défaut. |
| Statut | Projet à valider (émission côté serveur écrite, interrupteur éteint : livraison 17). La collecte en production exige l'avis du juriste/APDP (spécification § 6.2). |

---

## 1. Principes

1. **Une source de vérité par indicateur** (§ 3). Les actions métier se comptent dans les tables métier ; l'exposition (vues, sessions, visiteurs) se compte dans les événements. Aucun indicateur n'a deux sources, donc aucun double comptage et un tableau, une fiche et un export concordent (art. 22, scénario 6).
2. **Additif.** Nouvelles tables seulement, préfixe `ika_`, identifiants `text` comme l'existant. `ika_audit`, `ika_sessions`, `ika_contact_events` ne sont ni modifiées ni supprimées.
3. **La collecte ne doit jamais casser une page ni une action.** Émission en meilleur effort ; un échec est ignoré côté utilisateur et compté dans les contrôles.
4. **Minimisation.** Pas d'IP stockée, pas de contenu privé, pas de mot de passe, métadonnées à clés autorisées.
5. **Agrégats reconstructibles** à partir des sources, par une tâche déterministe et versionnée.
6. **Interrupteur général** `ANALYTICS_ENABLED` (désactivé par défaut) et date de début de collecte enregistrée. Avant cette date, les écrans affichent « Collecte non démarrée », jamais 0.

## 2. Flux de données

```
Navigateur ──sendBeacon──▶ POST /api/e ──validation──▶ ika_analytics_events
                                   │                      │
Services serveur ──emit()──────────┘                      ▼
 (contact, favori, message…)                    tâche horaire/journalière
                                                          │
Tables métier (favoris, commentaires, ...)──────────────▶ ika_agg_hourly / ika_agg_daily
                                                          │
                                         Centre de commandement (lecture des agrégats)
```

### 2.1 Réception côté navigateur (`page_view`)
- Route `POST /api/e`, appelée à chaque navigation du routeur SPA ; chemin seul, sans query string ni fragment ; corps limité par le parseur JSON et fréquence limitée à 30 événements/minute/adresse en mémoire.
- Le serveur déduit la famille d’appareil, la source et le drapeau robot ; l’adresse IP n’est jamais enregistrée.
- Réponse `204` ; émission en meilleur effort, collecte éteinte par défaut.
- `visitor_id` et `session_id` restent nuls tant que la validation juridique/APDP et le mécanisme de consentement dédié ne sont pas approuvés : aucun indicateur de visiteurs uniques/sessions n’est disponible.

### 2.2 Émission côté serveur (actions)
- Fonction unique `emit(type, contexte)` appelée par les services après validation de l'action. Elle alimente la chronologie de session et le flux d'événements ; **elle ne sert pas de source de comptage** pour les actions (§ 3).
- L'écriture d'audit des actions sensibles, elle, se fait **dans la même transaction** que l'action (§ 6).

### 2.3 Visiteurs et sessions
- **Visiteur** : identifiant aléatoire en cookie propre au site, sans lien avec l'identité, durée limitée (proposé : 13 mois). Refus ou absence : événement enregistré **sans identifiant** (compté dans les vues, exclu des uniques).
- **Session** : suite d'événements d'un même visiteur sans inactivité > 30 minutes. Le client tient un identifiant de session et le renouvelle après 30 min ; le serveur recoupe avec la dernière activité.
- **Session « active »** : dernière activité < 5 minutes. Un jeton d'authentification valide ne prouve rien (art. 11).
- Connecté/anonyme : le `user_id` est rattaché à la session à la connexion, **sans réécrire** les événements anonymes antérieurs.

## 3. Source de vérité par indicateur

| Famille | Source de comptage | Remarque |
|---|---|---|
| Vues d'annonce, pages vues, visiteurs, sessions, appareils, pays, origines | `ika_analytics_events` / `ika_visit_sessions` | Seules données **sans équivalent actuel** |
| Favoris | `ika_favorites` | Ajout puis retrait = non compté |
| Commentaires | `ika_comments` | Visibles uniquement |
| Contacts (téléphone, WhatsApp) | `ika_contact_events` | Un clic ne prouve pas un message |
| Messages, conversations | `ika_threads`, `ika_messages` | |
| Demandes de visite | `ika_visit_requests` | |
| Annonces par statut | `ika_listings` | |
| Inscriptions, statuts de compte | `ika_profiles` | |
| Paiements, factures, remboursements | `ika_payments`, `ika_invoices` | Remboursement compté seulement s'il est confirmé |
| Alertes, signalements | `ika_alerts`, `ika_reports`, `ika_user_reports` | |
| J'aime, partages, demandes immobilières, abonnements | **Nouvelles tables à créer** avec leurs fonctions (Phases 5 à 7) | Indisponibles d'ici là |

Conséquence : **les indicateurs d'action existants sont disponibles dès la première version des tableaux de bord, avec leur historique réel**, sans attendre la collecte. Seule l'exposition dépend de la nouvelle collecte et n'est pas rétroactive.

## 4. Agrégation

> État (7 novembre 2026) : le recalcul journalier manuel est écrit (`scripts/aggregate.mjs`) ; les tâches automatiques (horaire, nocturne), les tables d'uniques et la lecture à la volée par période restent à faire.

- **Horaire** (`ika_agg_hourly`) et **journalière** (`ika_agg_daily`) : lignes `(période, indicateur, dimension, valeur)` avec version de méthode.
- **Hebdomadaire, mensuelle, annuelle** : calculées à la lecture par sommation des journalières (somme valable pour les compteurs). Une table dédiée n'est ajoutée que si la mesure montre un problème de lenteur.
- **Uniques** (non additifs) : tables `ika_visitor_days` et `ika_listing_viewer_days` (une ligne par visiteur et par jour, et par annonce et visiteur). Les uniques d'une semaine ou d'un mois sont des `COUNT(DISTINCT)` exacts sur ces petites tables, jamais des sommes de uniques journaliers.
- **Tâches** : consolidation de l'heure écoulée toutes les heures ; recalcul des **trois derniers jours** chaque nuit (événements tardifs, corrections de robots) ; reconstruction d'une plage à la demande, avec verrou consultatif pour éviter l'exécution en double si plusieurs instances tournent.
- **Fuseau** : les tranches 00–06, 06–09, 09–12, 12–14, 14–18, 18–21, 21–00 sont calculées dans le fuseau du pays (Mali : UTC+0, sans heure d'été).
- **Performance** : les tableaux lisent uniquement les agrégats, avec cache court ; les événements bruts ne servent qu'aux fiches détaillées bornées dans le temps.

## 5. Qualité des données

| Risque | Parade |
|---|---|
| Doublons | `event_id` unique, insertion ignorée en cas de conflit |
| Robots | Signatures d'agents + comportement (cadence anormale) ; événements marqués `is_bot`, **exclus** des indicateurs |
| Événements tardifs | Date d'occurrence ≠ date de réception ; recalcul sur 3 jours |
| Valeurs aberrantes | Dates futures ou trop anciennes rejetées ; plafonds de durée de session |
| Métadonnées libres | Clés autorisées par type, taille maximale, aucune donnée personnelle |
| Dérive des agrégats | Contrôle quotidien : recalcul d'un échantillon et comparaison ; écarts consignés dans `ika_analytics_checks` et signalés au Superadmin |
| Interprétation | Libellés imposés à l'écran (§ 7 de la spécification) : visiteur « estimé », pays « approximatif », prix « déclarés » |

## 6. Journal d'audit

- Nouvelle table `ika_admin_audit` (modèle dans `MODELE_DONNEES_ANALYTIQUES.md`), écrite **dans la transaction de l'action**. `ika_audit` reste alimentée en parallèle jusqu'à décision contraire.
- **Non modifiable** : un déclencheur refuse `UPDATE` et `DELETE`, sauf purge de rétention exécutée par la fonction prévue et elle-même tracée.
- Chaque ligne conserve acteur, **rôle au moment des faits**, action, objet, utilisateur concerné, pays, résultat, anciennes/nouvelles valeurs si autorisé, motif obligatoire pour les actions sensibles.
- La **consultation** de statistiques individuelles et d'objets sensibles est elle-même journalisée.
- Accès par permission `audit.view`, export par `audit.export`.

## 7. Sécurité et vie privée de la collecte

- Droit de refus du suivi ; prise en compte du signal « Ne pas suivre » (à confirmer avec le juriste).
- Aucun accès aux événements bruts hors personnel autorisé ; statistiques individuelles réservées et tracées.
- Rétention (propositions soumises au juriste) : événements bruts et sessions 12 mois (décision D-3) ; agrégats 5 ans ; audit 5 ans. Purge par lots, tracée.
- Droits des utilisateurs : l'export et l'effacement existants (`ika_data_requests`) devront couvrir les événements liés à un `user_id` ; les événements anonymes ne sont pas rattachables à une personne.
- Mise à jour obligatoire de `docs/juridique/projet-confidentialite.md` et du plan de conformité **avant** activation.

## 8. Plan de sauvegarde, de déploiement et de retour arrière (art. 2)

**Avant toute migration**
1. Sauvegarde chiffrée de la base (`scripts/backup.sh`) et **restauration testée sur base jetable** (`scripts/restore-check.sh`). Ces scripts existent mais n'ont jamais été exécutés en réel : c'est un prérequis bloquant.
2. Exécution complète de la suite de tests sur vrai PostgreSQL (anomalie A-01).
3. Essai des migrations sur une copie de la base, puis en développement.

**Migrations proposées (numérotation suivant l'existant, toutes additives)**

| N° | Contenu | Tables touchées |
|---|---|---|
| 021 | Pays et paramètres analytiques | nouvelles : `ika_countries` ; clés dans `ika_settings` |
| 022 | Journal d'audit enrichi | nouvelle : `ika_admin_audit` + déclencheur |
| 023 | Événements, sessions, visiteurs | nouvelles : `ika_analytics_events`, `ika_visit_sessions`, `ika_visitor_days`, `ika_listing_viewer_days` |
| 024 | Agrégats et contrôles | nouvelles : `ika_agg_hourly`, `ika_agg_daily`, `ika_analytics_checks` |

Aucune table existante n'est modifiée ; aucune donnée n'est déplacée ni supprimée.

**Retour arrière** : un script `scripts/rollback/NNN_..._down.sql` par migration (modèle existant : `020_listing_geo_down.sql`), qui ne supprime que les objets créés par la migration. Les tables étant nouvelles, le retour arrière ne peut pas endommager les données existantes ; il détruit seulement les données analytiques collectées depuis. Sauvegarde avant chaque étape.

**Déploiement** : (1) migrations avec `ANALYTICS_ENABLED=false` ; (2) vérification que l'application fonctionne à l'identique ; (3) après validation juridique, activation progressive ; (4) surveillance de la taille de la base et de la latence des pages publiques ; (5) désactivation immédiate possible par l'interrupteur, sans retour arrière de schéma.

## 9. Plan de tests de la phase (à exécuter après implémentation)

| Scénario (art. 22) | Vérification |
|---|---|
| Traçabilité | Un utilisateur modifie, un Admin valide, un autre observe : acteurs, rôles, dates et heures exacts dans `ika_admin_audit` ; `UPDATE`/`DELETE` refusés |
| Sessions | Connexions à différentes heures ; une session = une séquence, pas deux ; heures de pointe correctes ; absence de double comptage |
| Doublons | Même `event_id` envoyé deux fois = une ligne |
| Robots | Un agent robot n'entre pas dans les indicateurs |
| Cohérence | Tableau, fiche, classement, CSV/PDF/Excel concordent pour un même périmètre, période et méthode |
| Reconstruction | Suppression puis reconstruction d'une journée d'agrégats = mêmes valeurs |
| Isolation | Un annonceur ou une agence ne lit jamais les données d'un autre |
| Charge | Les pages publiques gardent leur latence avec la collecte active |
| Refus | Visiteur refusant le suivi : pas d'identifiant stocké |

## 10. Ce que cette conception n'a pas vérifié
- Le volume réel de trafic (le dimensionnement est volontairement simple : table non partitionnée, purge par lots ; à réexaminer au-delà de quelques dizaines de millions de lignes).
- La disponibilité d'un en-tête de pays chez l'hébergeur ou d'une base de pays locale hors ligne.
- Le mécanisme exact des tâches planifiées existantes (à relire lors de l'implémentation).
