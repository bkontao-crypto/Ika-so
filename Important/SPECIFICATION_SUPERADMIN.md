# SPECIFICATION SUPERADMIN — IKA SO (Phase 1, conception)

| | |
|---|---|
| Référentiel | Ordonnances consolidées v1.0 (art. 4, 5, 10 à 20) |
| Base | `AUDIT_INITIAL_IKA_SO.md` du 4 novembre 2026 et arbitrages du propriétaire |
| Nature | **Document de conception uniquement. Aucun code, aucune migration, aucune modification de données.** |
| Statut | Projet à valider avant la Phase 2 |

---

## 1. Arbitrages reçus et traitement

| # | Décision du propriétaire | Traitement dans cette spécification |
|---|---|---|
| C-1 | Le Superadmin secondaire sert à récupérer l'autre compte | Retenu (§ 3). Délai de sécurité : **une semaine**. Aucun canal de secours hors plateforme. **Titulaires encore non désignés.** |
| C-2 | Collecte minimale (pays, appareil, sessions, visiteurs uniques) pseudonymisée et à durée limitée : **oui** | Retenu (§ 6). L'avis du juriste et de l'APDP reste un prérequis avant mise en production de la collecte. |
| C-3 | Connexion tierce : la note fournie décrit une intégration (minimisation, champs `provider`, CSP) | **Accepté sous conditions, jamais en production avant validation juridique** (§ 4). Ce n'est pas encore une décision ferme : à confirmer. |
| C-4 | Pièces jointes en messagerie : **pas de réponse** | **Accepté, plafond de 2 Mo par fichier** (images, documents, vocaux ; la vidéo ne tient pratiquement pas dans 2 Mo). Conditions de sécurité et de modération au § 8. |
| C-5 | Mali d'abord, puis sous-régions, puis panafricain | Modèle « pays » prévu dès le départ, un seul pays actif (Mali) ; sous-région en second temps. |
| C-6 | Stockage objet : « modéré » | Interprété comme **budget limité et modération des fichiers** (réponse « oui » aux deux). Stockage actuel (PostgreSQL) conservé avec quotas ; couche d'abstraction pour un stockage objet ultérieur (§ 8). |

---

## 2. Principes directeurs

1. **Aucun indicateur sans source réelle.** Chaque indicateur du catalogue (§ 7) a une définition, une source et une disponibilité. Aucun faux compteur, aucune animation décorative.
2. **Additif uniquement.** `ika_profiles.staff_role`, `ika_audit`, `ika_sessions` et les autres tables existantes sont conservées et continuent d'être alimentées.
3. **Refus par défaut côté serveur.** Masquer un bouton n'est jamais une sécurité.
4. **Collecte minimale.** Jamais de mot de passe, de contenu privé, de frappe clavier, ni d'adresse IP stockée en clair.
5. **Une alerte automatique ne sanctionne jamais seule.**
6. **Disponibilité honnête :** un indicateur dont la source n'existe pas encore s'affiche « Collecte non démarrée », jamais `0`.

---

## 3. Hiérarchie administrative

### 3.1 Deux emplacements Superadmin

Nouvelle table `superadmin_slots` (une ligne par emplacement, exactement deux, contrainte `slot IN ('PRIMARY','SECONDARY')`, `user_id` unique).

| Règle | Spécification |
|---|---|
| Nombre | Exactement deux emplacements. Aucun troisième actif ; contrainte en base **et** vérification serveur. |
| Principal | Paramètres globaux, privilèges, administrateurs, décisions Premium, sanctions selon procédure, statistiques, badges, identité visuelle, journaux, récupération du secondaire. |
| Secondaire | Continuité, opérations expressément autorisées, participation à la récupération du principal et au remplacement d'un titulaire. |
| Création/promotion | Seul un Superadmin, par la procédure renforcée. **Aucun Admin ne peut créer ou promouvoir un Superadmin** (déjà vrai dans le code, à conserver et tester). |
| Compte existant | À la migration, l'unique `SUPERADMIN` actuel (s'il n'y en a qu'un) devient `PRIMARY`. Il existe **plusieurs** Superadmin en base (confirmé) : le propriétaire m'a laissé le choix. Règle proposée : au moment de la migration, je liste les comptes (identifiant, date de création, numéro vérifié, dernière connexion) ; le plus ancien compte actif au numéro vérifié devient `PRIMARY`, le suivant `SECONDARY`, les autres passent `ADMIN` avec leurs droits actuels conservés. **Aucun changement de rôle sans votre confirmation sur la liste réelle, que je ne peux pas voir depuis l'archive.** |

### 3.2 Procédure de récupération et de remplacement (proposition à valider)

Vous avez fixé le principe (le secondaire récupère le principal). Le détail ci-dessous est **une proposition** :

1. **Demande** par le titulaire de l'autre emplacement, avec motif écrit obligatoire.
2. **Vérification renforcée :** MFA obligatoire + ré-authentification récente du demandeur.
3. **Délai de sécurité** (décidé : **une semaine**) avec notification à l'adresse e-mail et au numéro vérifié du compte concerné, qui peut **annuler** pendant ce délai.
4. **Exécution :** nouveau titulaire ou nouveaux identifiants ; toutes les sessions du compte récupéré sont fermées.
5. **Trace :** une entrée d'audit protégée (demandeur, motif, dates, décision, résultat).
6. Si les deux comptes sont perdus : procédure d'urgence **hors application** (accès base par le propriétaire technique, documentée dans `SECURITE.md`).

**Conséquences des décisions :** avec un délai d'une semaine et aucun canal de secours hors plateforme, la perte simultanée des deux comptes ne se règle que par accès direct à la base. Ce risque est accepté ; il impose des **codes de récupération MFA conservés par chaque titulaire** et la mise à jour de `SECURITE.md`. **À fournir :** l'identité des deux titulaires.

### 3.3 Permissions (remplace le rang fixe)

Tables : `permissions` (catalogue de codes), `roles`, `role_permissions`, `user_permissions` (octroi ou refus nominatif, avec `granted_by`, `granted_at`, `reason`).

- Refus par défaut. Un Admin ne peut ni s'octroyer une permission, ni octroyer une permission qu'il ne détient pas.
- Modérateurs : aucun pouvoir administratif implicite ; publication de leurs propres annonces uniquement si la permission est accordée.
- Décision Premium : réservée au Superadmin sauf délégation expresse (permission `premium.decide` + trace).
- **Compatibilité :** à la migration, chaque `MODERATOR`/`ADMIN` actuel reçoit le rôle par défaut qui reproduit **exactement** ses droits actuels. Aucun compte ne gagne ni ne perd de capacité.
- Règle `RESTRICTED` : un personnel restreint perd ses droits de modération (déjà en place) ; inscrit comme règle métier.

Catalogue initial indicatif : `dashboard.view`, `analytics.view`, `analytics.user_detail`, `users.manage`, `users.sanction`, `listings.moderate`, `reports.handle`, `verification.review`, `premium.instruct`, `premium.decide`, `payments.view`, `payments.refund`, `exports.generate`, `audit.view`, `audit.export`, `roles.manage`, `settings.manage`.

---

## 4. Comptes, authentification (partie touchant le centre de contrôle)

| Sujet | Spécification |
|---|---|
| Méthodes de connexion | Table `user_auth_methods` (`user_id`, `provider` ∈ {`password`,`phone`,`google`,`facebook`,`x`}, `provider_user_id`, `verified_at`). Les comptes e-mail + mot de passe actuels sont migrés en une ligne `password`. |
| Connexion tierce | **Redirection OAuth gérée par le serveur (flux « code »)** : aucun script ni iframe du fournisseur dans le site. Cela évite d'élargir `script-src`/`frame-src` ; seule la navigation vers le domaine du fournisseur est nécessaire. *(Cette approche est plus restrictive que celle de la note reçue, qui suggérait d'ouvrir ces directives : je recommande de ne pas le faire.)* |
| Minimisation | Récupérer uniquement identifiant, e-mail vérifié et nom. Jamais de contacts, d'amis ni de jeton conservé au-delà de la connexion. |
| Rattachement | Ajout d'une méthode à un compte existant **seulement après vérification de propriété** (compte déjà connecté ou e-mail confirmé). |
| Prérequis | Mise à jour de `docs/juridique/projet-confidentialite.md` (tiers, transfert hors Mali) ; validation juriste/APDP. |
| MFA | Obligatoire pour Superadmin et Admin ; TOTP (application) en premier, code SMS en secours. Limitation des tentatives, codes de récupération à usage unique. |
| Récupération mot de passe | À concevoir (absente aujourd'hui) ; jeton à usage unique, durée courte, aucune divulgation de l'existence du compte. |

---

## 5. Navigation et pages du centre de commandement

Menu cible (art. 17), avec disponibilité réelle :

| Module | Disponible avec les données **actuelles** | Nécessite |
|---|---|---|
| Vue générale | Partiel (utilisateurs, annonces, paiements) | Collecte pour visiteurs |
| Temps réel | Partiel (onglet « En ligne » existant, à vérifier) | Événements + sessions |
| Visiteurs et trafic | Non | Collecte (Phase 2) |
| Utilisateurs | Oui (comptes, statuts, rôles) | Types de compte (Phase 5) |
| Connexions et sessions | Partiel | Sessions enrichies |
| Annonceurs / Agences / Agents | Partiel (annonces, avis, badges) | Vues, contacts agrégés |
| Annonces | Oui | — |
| Performance des annonces | Non (vues absentes) | Collecte |
| J'aime et réactions | Partiel (favoris seulement) | Fonction « J'aime » |
| Commentaires | Oui | — |
| Contacts et prospects | Partiel (CALL/WHATSAPP, messages) | Typage des contacts |
| Demandes de visite | Oui | — |
| Demandes immobilières | Non | Fonction à créer |
| Favoris et partages | Partiel (favoris) | Partages tracés |
| Cartographie et marché | Partiel (prix, quartiers, géodonnées) | Recherches journalisées |
| Abonnements / Paiements et revenus | Partiel (paiements, factures) | Abonnements |
| Publicités | Non | Phase 7 |
| Modération / Vérification foncière / Signalements | Oui | Dossiers enrichis |
| Alertes et sécurité | Partiel (4 règles) | Nouvelles règles |
| Historique des actions | Partiel (`ika_audit` pauvre) | Journal enrichi (Phase 2) |
| Rapports et exports | Non | Phase 5 |
| Gestion des pays / des rôles / Paramètres | Non / Non / Partiel (`ika_settings`) | Phases 2 et 5 |

Chaque module : page détaillée, filtres, graphiques et tableaux. **Barre supérieure** (logo, identité, date/heure, notifications, alertes, disponibilité via `/api/health`, recherche globale). **Filtre global** (période, pays, région, ville, quartier, type de bien, vente/location, type d'annonceur, agence, statut) appliqué à tous les indicateurs compatibles ; un indicateur incompatible avec un filtre le dit explicitement. **Un indicateur cliquable ouvre sa fiche détaillée** quand elle existe.

Périodes de la journée : 00–06, 06–09, 09–12, 12–14, 14–18, 18–21, 21–00, **dans le fuseau du pays concerné** (Mali : UTC+0, sans heure d'été).

---

## 6. Collecte d'événements et vie privée

### 6.1 Événements

Table `analytics_events` (nouvelle, **ne remplace aucune table**) :
`id`, `event_id` (unique, anti-doublon), `event_type`, `occurred_at`, `received_at`, `user_id` nullable, `anonymous_visitor_id` nullable, `session_id` nullable, `country_code`, `listing_id`/`advertiser_id`/`agency_id` nullables, `page_path`, `source`, `device_type`, `metadata` JSONB à clés autorisées.

Types : ceux de l'art. 18 (`page_view`, `listing_view`, `favorite_added/removed`, `like_*`, `comment_*`, `contact_clicked`, `phone_clicked`, `whatsapp_clicked`, `contact_request_created`, `visit_requested`, `message_sent`, `user_registered`, `user_login/logout`, `listing_*`, `verification_completed`, `report_created`, `payment_completed`).

**Règle de vérité :** les événements d'écriture (contact, favori, commentaire, message, paiement) sont émis **par le serveur** au moment de la transaction, pas par le navigateur. Seuls `page_view` et `listing_view` sont émis côté client, via une route dédiée à faible coût.

### 6.2 Minimisation (conforme à votre accord C-2)

| Donnée | Traitement |
|---|---|
| Adresse IP | **Jamais stockée.** Le pays est déduit à la réception (en-tête du proxy, par exemple Cloudflare, ou base locale hors ligne), puis l'IP est oubliée. Le pays est présenté comme approximatif. |
| Visiteur anonyme | Identifiant aléatoire en cookie propre au site, sans lien avec l'identité, durée limitée (proposé : 13 mois). Refus possible. |
| Appareil/navigateur | Catégories grossières (type d'appareil, famille de navigateur), pas d'empreinte précise. |
| Robots | Détection par signature et comportement ; événements marqués, exclus des indicateurs. |
| Rétention | Événements bruts : durée limitée (proposé : 13 mois) ; agrégats conservés plus longtemps. **Durées à valider par le juriste.** |
| Accès individuel | Statistiques d'un utilisateur nommé : permission `analytics.user_detail`, chaque consultation tracée. |
| Information | Mise à jour de la page confidentialité ; bandeau d'information, et consentement si le juriste l'exige. |

### 6.3 Qualité des données

Déduplication par `event_id` ; séparation connectés/anonymes ; gestion des événements tardifs (réception ≠ occurrence) ; valeurs aberrantes isolées ; agrégats horaires, journaliers, hebdomadaires, mensuels et annuels **reconstructibles** à partir des événements ; règles documentées dans `CATALOGUE_INDICATEURS.md`.

### 6.4 Journal d'audit enrichi

Nouvelle table `admin_audit_logs` : identifiant, acteur, **rôle de l'acteur au moment des faits**, action, type et identifiant d'objet, utilisateur concerné, pays, résultat, ancienne/nouvelle valeur (si autorisée), motif obligatoire pour les actions sensibles, source technique. Index par acteur, objet, action, date. `ika_audit` reste alimentée en parallèle (aucune rupture) ; accès paginé, protégé, exportable selon droits, rétention définie.

---

## 7. Catalogue d'indicateurs (définitions)

*Disponibilité : A = calculable dès maintenant ; B = après collecte (Phase 2) ; C = après création d'une fonctionnalité.*

| Indicateur | Définition | Source | Dispo |
|---|---|---|---|
| Utilisateurs (total, nouveaux, actifs, suspendus…) | Comptes par statut ; « actif » = au moins une session ou action sur la période | `ika_profiles`, `ika_sessions` | A (actif : B) |
| Annonces par statut | Comptage par `status` | `ika_listings` | A |
| Annonces sponsorisées | Annonces à la une actives | paiements/offres | A |
| Vues d'annonce | Événements `listing_view` non-robots | `analytics_events` | B |
| Visiteurs uniques estimés | Identifiants visiteurs distincts sur la période, **estimation** | événements | B |
| Sessions, durée, pages/session | Session = suite d'événements d'un visiteur sans inactivité > 30 min (proposé) ; durée estimée | événements | B |
| Session « active » | Dernière activité < 5 min (un jeton valide **ne suffit pas**) | événements | B |
| Favoris | Ajouts nets (un ajout annulé ne compte pas) | `ika_favorites` | A |
| Commentaires, commentateurs uniques | Commentaires visibles / auteurs distincts | `ika_comments` | A |
| J'aime | — | — | C |
| Contacts | Clics téléphone/WhatsApp ; messages ; demandes de visite, **comptés séparément** | `ika_contact_events`, `ika_messages`, `ika_visit_requests` | A (partiel) |
| Taux d'engagement | (J'aime + commentaires + partages + favoris) ÷ vues uniques estimées × 100 ; période et méthode affichées | calculé | B/C |
| Conversions | vues→favoris, vues→clics, vues→demandes, demandes→visites, visites→transactions déclarées, avec dénominateurs | calculé | B |
| Indice de performance d'annonce | Somme pondérée (vues uniques, favoris, contacts, demandes de visite, commentaires, partages, ancienneté) ; **poids configurables** dans `ika_settings`, contacts > vues | calculé | B |
| Prix moyen / médian, prix au m² | Prix **déclarés**, médiane avec ≥ 3 comparables (règle actuelle conservée) | `ika_listings` | A |
| Revenus, paiements échoués, remboursements | Paiements `PAID`, `FAILED`, remboursements **confirmés** seulement | `ika_payments`, `ika_invoices` | A |
| Abonnements actifs/expirés | — | — | C |
| Alertes ouvertes par gravité | Alertes non closes | `ika_alerts` | A |

Règles de lecture imposées à l'affichage : un clic WhatsApp ne prouve pas l'envoi d'un message ; une recherche ne prouve pas une intention ; un prix est déclaré, non certifié ; popularité ≠ qualité juridique d'un bien ; géolocalisation IP ≠ GPS.

---

## 8. Architecture technique visée (sans implémentation)

- **Agrégats** : tables horaires/journalières alimentées par une tâche planifiée sur le mécanisme de minuteries existant ; les tableaux de bord lisent les agrégats, jamais les événements bruts ; cache court. Les pages publiques ne sont pas ralenties (émission asynchrone, abandon silencieux en cas d'échec).
- **Temps réel** : interrogation régulière (comme la messagerie actuelle) avec heure de dernière actualisation affichée ; pas de WebSocket tant que le volume ne le justifie pas.
- **Pièces jointes de messagerie** (décision C-4) : 2 Mo maximum par fichier ; liste blanche de types (images JPEG/PNG/WebP, PDF, audio court) ; **type vérifié sur le contenu**, pas sur le nom ; quota par utilisateur et par jour (valeurs à fixer pour tenir le budget) ; fichiers visibles seulement par les deux membres de la conversation ; accès du personnel limité aux conversations **signalées** et tracé ; signalement d'un fichier et retrait par la modération ; blocage entre membres appliqué aux pièces jointes. Stockage dans `stored_files` (PostgreSQL) au départ, avec surveillance de la taille de base ; interface unique (`file-storage.js`) pour passer plus tard à un stockage objet sans réécriture. Antivirus : non prévu à ce stade (risque noté, à reconsidérer avant l'ouverture au public).
- **Multi-pays** : table `countries` (code, nom, devise, fuseau, actif), un seul pays actif (Mali) ; colonne `country_code` sur les événements dès le départ ; aucune migration des annonces existantes avant décision.
- **Isolation** : les données privées d'une agence ne sont jamais lisibles par une autre agence ; test d'isolation obligatoire (art. 22).

---

## 9. Plan des Phases 2 à 3 (rappel, sous réserve de validation)

1. Validation de cette spécification.
2. **Phase 2** : `ARCHITECTURE_ANALYTICS.md` et `MODELE_DONNEES_ANALYTIQUES.md` (documents), puis, **après plan de sauvegarde/rollback validé**, migrations additives.
3. Collecte démarrée tôt (non rétroactive), tableaux de bord en Phase 3 sur données réelles.

---

## 10. Questions ouvertes

1. **Qui sont les deux titulaires Superadmin ?** (non communiqué)
2. Connexion tierce : décision ferme (oui/non) et fournisseurs (Google seul au départ ?).
3. Quotas de pièces jointes par utilisateur et par jour, et seuil d'alerte de taille de la base.
4. Durées de rétention (événements 13 mois, cookie visiteur 13 mois) et bandeau de consentement : à soumettre au juriste.
5. Sous-régions visées après le Mali (UEMOA, CEDEAO ?).
6. Liste réelle des comptes `SUPERADMIN` (à extraire de la base au moment de la migration, pas avant).

## 11. Livraison (format art. 23)

**RÉALISÉ** : spécification de conception (ce document). Preuve : fichier livré ; aucune modification du code ni de la base.
**EN COURS** : rien.
**RESTANT** : validation, réponses du § 10, Phase 2.
**Limites** : conception sur lecture du code, sans exécution réelle ; les durées et seuils sont des propositions.
