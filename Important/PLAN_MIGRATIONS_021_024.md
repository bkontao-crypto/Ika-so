# PLAN DÉTAILLÉ DES MIGRATIONS 021 À 024 — IKA SO (conception, NON APPLIQUÉ)

**Statut (livraison n° 7) : IMPLÉMENTÉ.** Les migrations 021 à 024 et leurs retours arrière sont dans `migrations/` et `scripts/rollback/`, testés (`test/analytics-migrations.test.js`). Les écarts avec le plan : fonction de purge `ika_admin_audit_purge()` ajoutée, déclencheur aussi sur TRUNCATE, clés de `ika_settings` : `analytics_enabled`, `analytics_start_date`, `analytics_retention_raw_months`, `analytics_retention_agg_years`, `audit_retention_years`. Le texte qui suit est la conception d'origine ; les fichiers font foi.

**Décisions D-1 à D-6 validées le 4 novembre 2026 (option A partout)** : voir `SUIVI_EVOLUTION_IKA_SO.md`. Conséquence pour ce plan : conservation **12 mois** des événements bruts et sessions (et non 13 comme dans `ARCHITECTURE_ANALYTICS.md` § 7, à aligner), **5 ans** pour agrégats et audit. Ces durées restent soumises à l'avis du juriste avant activation.

## 1. Conventions (reprises de l'existant)
- Une migration = un fichier `NNN_nom.sql`, une transaction, verrou consultatif (`server/migrate.js`).
- Additive uniquement : `create table if not exists`, `create index if not exists`. Aucune table existante modifiée.
- Un retour arrière par migration, sur le modèle de `scripts/rollback/020_listing_geo_down.sql` : transaction, `drop table if exists`, `delete from _migrations where name = '…'`.
- Retour arrière à lancer dans l'ordre inverse : 024, 023, 022, 021.

## 2. Prérequis bloquants (aucune migration avant)
1. Suite de tests complète exécutée sur un vrai PostgreSQL (anomalie A-01).
2. `scripts/backup.sh` puis `scripts/restore-check.sh` exécutés en réel, restauration vérifiée sur base jetable.
3. Essai des migrations sur une copie de la base, puis en développement.
4. Autorisation écrite du propriétaire pour la phase d'implémentation.

## 3. Migrations

| N° | Fichier prévu | Crée | Dépend de | Retour arrière |
|---|---|---|---|---|
| 021 | `021_pays_parametres.sql` | `ika_countries` ; lignes `ika_settings` (`analytics_enabled=false`, `analytics_start_date`, poids de l'indice) | `ika_settings` existe | `021_pays_parametres_down.sql` |
| 022 | `022_audit_admin.sql` | `ika_admin_audit` + déclencheur anti-modification | — | `022_audit_admin_down.sql` |
| 023 | `023_evenements_sessions.sql` | `ika_analytics_events`, `ika_visit_sessions`, `ika_visitor_days`, `ika_listing_viewer_days` | — | `023_evenements_sessions_down.sql` |
| 024 | `024_agregats_controles.sql` | `ika_agg_hourly`, `ika_agg_daily`, `ika_analytics_checks` | — | `024_agregats_controles_down.sql` |

Schémas : `MODELE_DONNEES_ANALYTIQUES.md` § 1 (inchangés, sauf points ci-dessous).

### Points de conception à trancher à l'implémentation
- **021** : amorcer `('ML','Mali','XOF','Africa/Bamako', true)` ; `ika_settings` doit accepter les nouvelles clés (à vérifier dans le schéma réel avant d'écrire l'insertion). Interrupteur `analytics_enabled` **à faux** par défaut.
- **022** : le déclencheur refuse `UPDATE` et `DELETE`. La purge de rétention (5 ans) passe par une fonction dédiée qui lève temporairement la protection pour la session de purge et écrit sa propre ligne d'audit. Contrainte `check (result in ('OK','DENIED','ERROR'))`.
- **023** : contrainte `check` sur `event_type` limitée à la liste blanche de `MODELE_DONNEES_ANALYTIQUES.md` § 2 ; ajouter un type exige une migration (volontaire). Pas de clé étrangère vers les comptes. Non partitionnée au départ ; purge par lots de 10 000 lignes sur `occurred_at`.
- **024** : clé primaire composée comme au modèle ; `method_version` pour recalculer sans mélanger les anciennes méthodes.

## 4. Scripts de retour arrière (texte, à créer sur autorisation)

```sql
-- scripts/rollback/024_agregats_controles_down.sql
-- ATTENTION : supprime les agrégats et contrôles. Sauvegarde avant (scripts/backup.sh).
begin;
drop table if exists ika_analytics_checks;
drop table if exists ika_agg_daily;
drop table if exists ika_agg_hourly;
delete from _migrations where name = '024_agregats_controles.sql';
commit;
```
```sql
-- scripts/rollback/023_evenements_sessions_down.sql
-- ATTENTION : supprime tous les événements, sessions et visiteurs collectés.
begin;
drop table if exists ika_listing_viewer_days;
drop table if exists ika_visitor_days;
drop table if exists ika_visit_sessions;
drop table if exists ika_analytics_events;
delete from _migrations where name = '023_evenements_sessions.sql';
commit;
```
```sql
-- scripts/rollback/022_audit_admin_down.sql
-- ATTENTION : détruit le journal d'audit enrichi (obligation de traçabilité : exporter avant).
begin;
drop table if exists ika_admin_audit;
drop function if exists ika_admin_audit_guard();   -- nom de la fonction du déclencheur, à confirmer à l'écriture
delete from _migrations where name = '022_audit_admin.sql';
commit;
```
```sql
-- scripts/rollback/021_pays_parametres_down.sql
begin;
delete from ika_settings where key in ('analytics_enabled','analytics_start_date');  -- noms de colonnes/clés à confirmer
drop table if exists ika_countries;
delete from _migrations where name = '021_pays_parametres.sql';
commit;
```
`ika_audit` (existante) n'est jamais touchée : elle continue d'être alimentée en parallèle.

## 5. Procédure de déploiement
1. Sauvegarde chiffrée + vérification de restauration.
2. Migrations 021 → 024 avec `ANALYTICS_ENABLED=false` ; l'application doit se comporter à l'identique (tests de non-régression : parcours existants, `npm test`).
3. Validation juridique (APDP : collecte, durées, bandeau de consentement — refus aussi simple que l'acceptation).
4. Activation progressive ; surveillance de la taille de la base et de la latence des pages publiques.
5. Désactivation immédiate possible par l'interrupteur, sans retour arrière de schéma.

## 6. Tests à écrire avec l'implémentation
- Chaque migration s'applique deux fois de suite sans erreur (idempotence) et sur base vide et sur copie de production.
- Chaque retour arrière s'exécute, puis la migration se rejoue.
- Déclencheur d'audit : `UPDATE` et `DELETE` refusés ; purge tracée acceptée.
- Contrainte `event_type` : type hors liste refusé ; `event_id` en double refusé ; `metadata` > 2 Ko refusé.
- Suppression d'un compte : `user_id` mis à `NULL` dans événements et sessions, l'audit conserve l'acteur.

## 7. Limites
Non exécuté : aucun SQL de ce document n'a été testé sur PostgreSQL. Les noms de colonnes de `ika_settings` et de la fonction de déclenchement restent à confirmer contre le schéma réel.
