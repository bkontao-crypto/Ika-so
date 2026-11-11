# MODÈLE DE DONNÉES ANALYTIQUES — IKA SO (Phase 2, conception)

**Nature : modèle implémenté par les migrations 021 à 024 (les fichiers de `migrations/` font foi ; écarts listés dans `PLAN_MIGRATIONS_021_024.md`).** Les instructions SQL ci-dessous illustrent le schéma ; elles ne sont pas des fichiers de migration. Convention du projet : préfixe `ika_`, identifiants `text`, horodatages `timestamptz`. Voir `ARCHITECTURE_ANALYTICS.md` pour les règles.

## 1. Tables

### 1.1 `ika_countries` (migration 021)
```sql
create table ika_countries (
  code        char(2) primary key,       -- ISO 3166-1 alpha-2
  name        text not null,
  currency    text not null,
  timezone    text not null,             -- ex. 'Africa/Bamako'
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);
-- amorçage : ('ML','Mali','XOF','Africa/Bamako', true)
```

### 1.2 `ika_admin_audit` (migration 022)
```sql
create table ika_admin_audit (
  id            text primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      text,                    -- null = système
  actor_role    text not null,           -- rôle au moment des faits
  action        text not null,           -- ex. 'listing.approve'
  object_type   text,
  object_id     text,
  subject_user_id text,                  -- utilisateur concerné
  country_code  char(2),
  result        text not null default 'OK',   -- OK | DENIED | ERROR
  old_value     jsonb,                   -- seulement si autorisé
  new_value     jsonb,
  reason        text,                    -- obligatoire pour les actions sensibles (contrôle applicatif)
  source        text                     -- 'web', 'api', 'job'…
);
create index on ika_admin_audit (occurred_at desc);
create index on ika_admin_audit (actor_id, occurred_at desc);
create index on ika_admin_audit (object_type, object_id, occurred_at desc);
create index on ika_admin_audit (action, occurred_at desc);
-- déclencheur : refuse UPDATE et DELETE hors purge de rétention tracée
```
Pas de clé étrangère sur `actor_id` : la ligne d'audit doit survivre à la suppression ou à l'anonymisation du compte.

### 1.3 `ika_analytics_events` (migration 023)
```sql
create table ika_analytics_events (
  id            bigserial primary key,
  event_id      text not null unique,    -- anti-doublon
  event_type    text not null,
  occurred_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  user_id       text,                    -- null si anonyme
  visitor_id    text,                    -- null si suivi refusé
  session_id    text,
  country_code  char(2),                 -- approximatif, pas de GPS
  listing_id    text,
  advertiser_id text,                    -- propriétaire de l'annonce
  agency_id     text,
  page_path     text,
  source        text,                    -- direct | google | facebook | ...
  device_type   text,                    -- mobile | tablet | desktop
  is_bot        boolean not null default false,
  metadata      jsonb not null default '{}'::jsonb
                check (pg_column_size(metadata) <= 2048)
);
create index on ika_analytics_events (occurred_at);
create index on ika_analytics_events (event_type, occurred_at);
create index on ika_analytics_events (listing_id, occurred_at) where listing_id is not null;
create index on ika_analytics_events (visitor_id, occurred_at) where visitor_id is not null;
```
Non partitionnée au départ (volume pilote) ; purge par lots sur `occurred_at`. À réexaminer si le volume croît fortement.

### 1.4 `ika_visit_sessions` (migration 023)
```sql
create table ika_visit_sessions (
  session_id     text primary key,
  visitor_id     text,
  user_id        text,
  started_at     timestamptz not null,
  last_seen_at   timestamptz not null,
  device_type    text,
  browser_family text,
  country_code   char(2),
  entry_path     text,
  source         text,
  page_views     int not null default 0,
  event_count    int not null default 0,
  is_bot         boolean not null default false
);
create index on ika_visit_sessions (last_seen_at desc);
create index on ika_visit_sessions (started_at);
create index on ika_visit_sessions (user_id, started_at desc) where user_id is not null;
```
Durée estimée = `last_seen_at − started_at` (plafonnée). Distincte de `ika_sessions` (authentification), qui n'est pas modifiée.

### 1.5 Tables d'uniques (migration 023)
```sql
create table ika_visitor_days (
  day date not null, visitor_id text not null, country_code char(2),
  primary key (day, visitor_id)
);
create table ika_listing_viewer_days (
  day date not null, listing_id text not null, visitor_id text not null,
  primary key (day, listing_id, visitor_id)
);
```

### 1.6 Agrégats et contrôles (migration 024)
```sql
create table ika_agg_hourly (
  hour_start  timestamptz not null,
  metric      text not null,             -- clé du catalogue d'indicateurs
  dim_type    text not null default '',  -- '', 'listing', 'advertiser', 'city', 'device'…
  dim_id      text not null default '',
  country_code char(2) not null default '',
  value       numeric not null,
  method_version int not null,
  primary key (hour_start, metric, dim_type, dim_id, country_code)
);
create table ika_agg_daily (
  day         date not null,
  metric      text not null,
  dim_type    text not null default '',
  dim_id      text not null default '',
  country_code char(2) not null default '',
  value       numeric not null,
  method_version int not null,
  primary key (day, metric, dim_type, dim_id, country_code)
);
create table ika_analytics_checks (
  id text primary key, checked_at timestamptz not null default now(),
  check_name text not null, scope text, expected numeric, observed numeric,
  ok boolean not null, detail text
);
```

## 2. Types d'événements et métadonnées autorisées

| Événement | Origine | Métadonnées autorisées |
|---|---|---|
| `page_view` | navigateur | `referrer_host` |
| `listing_view` | navigateur | — (annonce portée par `listing_id`) |
| `contact_clicked`, `phone_clicked`, `whatsapp_clicked` | serveur | `kind` |
| `contact_request_created`, `visit_requested`, `message_sent` | serveur | — (aucun contenu de message) |
| `listing_favorite_added/removed`, `comment_created/deleted` | serveur | — |
| `listing_created/updated/published/archived` | serveur | `status_from`, `status_to` |
| `user_registered`, `user_login`, `user_logout` | serveur | `method` |
| `verification_completed`, `report_created`, `payment_completed` | serveur | `kind` ; montant **non** stocké ici |
| `listing_like_*` | à venir (fonction à créer) | — |

Toute autre clé est rejetée. Aucune donnée personnelle dans `metadata`.

## 3. Correspondance avec l'existant

| Existant | Rôle dans le nouveau modèle | Modifié ? |
|---|---|---|
| `ika_audit` | Continue d'être alimentée en parallèle de `ika_admin_audit` | Non |
| `ika_sessions` | Authentification seulement | Non |
| `ika_contact_events` | Source de comptage des clics téléphone/WhatsApp | Non |
| `ika_favorites`, `ika_comments`, `ika_visit_requests`, `ika_messages`, `ika_payments`… | Sources de comptage des actions | Non |
| `ika_settings` | Poids de l'indice de performance, date de début de collecte, interrupteur | Lignes ajoutées seulement |

## 4. Données d'autres phases (hors Phase 2, pour mémoire)
`ika_superadmin_slots`, `ika_permissions`, `ika_roles`, `ika_role_permissions`, `ika_user_permissions`, `ika_auth_methods`, `ika_upgrade_requests`, `ika_follows`, `ika_likes`, pièces jointes de messagerie. Leur modèle sera détaillé à l'ouverture des phases concernées. `ika_admin_audit.actor_role` est un texte précisément pour ne pas dépendre de ces tables.

## 5. Contraintes d'intégrité et de sécurité
- `event_id` unique ; types limités à la liste blanche (contrôle applicatif et, si possible, contrainte `CHECK`).
- Aucune clé étrangère vers des comptes sur les tables d'événements et d'audit : leur conservation ne doit pas dépendre de la suppression d'un compte.
- Effacement d'un compte : `user_id` mis à `NULL` dans les événements et sessions ; l'audit conserve l'acteur (obligation de traçabilité), à valider avec le juriste.
