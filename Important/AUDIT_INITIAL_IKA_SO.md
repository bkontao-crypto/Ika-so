# AUDIT INITIAL — IKA SO (Phase 0)

| | |
|---|---|
| Référentiel | Ordonnances consolidées v1.0 du 3 novembre 2026 (art. 21, Phase 0 ; art. 25, première action autorisée) |
| Objet audité | Archive `Ika_So_Version_1.zip` (package `ika-so` 0.2.0, Node ≥ 22, Express 5.1, pg 8.16, PostgreSQL, JavaScript natif) |
| Date | 4 novembre 2026 |
| Nature | **Audit statique du code et de la documentation, sans aucune modification du projet** |
| Statut | Diagnostic remis pour validation. **Aucune intervention structurelle n'est engagée.** |

---

## 0. Méthode et limites de la preuve (à lire en premier)

Conformément à l'art. 1 (« ne jamais déclarer une fonction opérationnelle sur la seule présence de son interface ») :

| Action | Résultat |
|---|---|
| Extraction de l'archive dans un dossier de travail séparé | ✅ Original intact |
| Lecture du code serveur (routes, services, middlewares), des 20 migrations, du frontend, de `SUIVI.md`, de `README.md`, des docs | ✅ |
| Exécution de `test/rules.test.js` (aucune dépendance) | ✅ **16/16 réussis** |
| `npm install` / suite complète avec vrai Express, vrai `pg`, vrai PostgreSQL | ⬜ **Non exécuté** : pas de réseau ni de base dans l'environnement d'audit |
| Exécution du site, du navigateur, du paiement, du SMS | ⬜ Non exécuté |

**Conséquence :** les « 234 tests sur 234 », « 52/52 navigateur » et « 0 problème d'accessibilité » cités dans `SUIVI.md` sont des **résultats rapportés** par les livraisons précédentes (obtenus avec un substitut d'Express et un adaptateur `psql`). Je ne les ai pas rejoués et je ne les compte pas comme prouvés. `SUIVI.md` reconnaît lui-même que le vrai `express` et le vrai `pg` n'ont jamais été exécutés.

Classement utilisé (art. 1) : **OP** opérationnelle (code + persistance + droits + tests présents) · **AM** à améliorer · **PA** partiellement développée · **DÉ** défaillante · **AB** absente · **À V** à vérifier à l'exécution.
« OP » signifie ici *conforme à la lecture du code et aux tests existants*, pas *prouvé en réel*.

---

## 1. Synthèse

IKA SO est un projet **réel, cohérent et nettement plus avancé que ne le suppose le texte de l'ordonnance** sur la marketplace (annonces, modération, confiance, avis, messagerie, paiements en socle, SEO, conformité, cartographie). Il est en revanche **très en deçà de l'ordonnance** sur tout ce qui fait le « centre de commandement » : analytique, sessions, trafic, comptes professionnels, Premium, abonnements/suivis, délégations, pièces jointes, rapports, multi-pays.

Points structurants :

1. **Pas de reconstruction.** Le socle (13 000 lignes, 20 migrations, ~40 fichiers de test) est réutilisable. Presque tout le travail à venir est **additif**.
2. **Zéro analytique.** Aucun événement `page_view`/`listing_view`, aucun compteur de vues, aucune session détaillée. Seuls existent des contacts `CALL`/`WHATSAPP`, un journal d'audit minimal et un onglet « En ligne ». Plus de la moitié de l'art. 10 à 19 repose donc sur des données **qui n'existent pas encore** : elles ne pourront pas être rétroactives.
3. **Quatre contradictions de principe** entre le code/les décisions antérieures et l'ordonnance (§ 5) doivent être tranchées **avant** toute conception.
4. **Rôle administratif encore plat** : trois rôles de personnel (`MODERATOR`, `ADMIN`, `SUPERADMIN`) stockés dans une colonne, **sans table de permissions**. L'ordonnance exige des permissions individuelles et deux emplacements Superadmin.
5. **Le risque n°1 n'est pas fonctionnel mais de preuve** : tant que `npm ci && npm test` n'a pas tourné sur vrai PostgreSQL, tout le reste repose sur des substituts.

---

## 2. Architecture existante

| Couche | Constat |
|---|---|
| Serveur | Express 5.1 ; `server/app.js` (session, CSRF par origine, limiteur, CSP) ; `server/routes/index.js` (routes fines, ~120 routes) ; `server/services/*` (toute la logique et le SQL paramétré) ; `server/lib/*` (règles, sécurité, journaux, fournisseurs) |
| Base | PostgreSQL ; migrations `001`→`020` versionnées, appliquées au démarrage sous verrou consultatif ; préfixe `ika_`, **identifiants `text`** (pas d'UUID natif) |
| Frontend | JavaScript natif en modules, SPA à routage par hash (`public/js/core`), pages chargées à la demande, CSS maison (budget ~10 Ko), PWA/service worker, mode sombre |
| Admin | `public/admin.html` + `admin.js` (241 lignes) : file, confiance, signalements, en ligne, paiements, journal, comptes |
| Dépendances | **3 seulement** : `express`, `pg`, `mapbox-gl` (embarqué dans `public/vendor`). Politique « aucune ressource externe » |
| Fichiers | Photos et justificatifs en **BYTEA dans PostgreSQL** (`stored_files`), accès contrôlé |
| Outillage | CI GitHub, Dockerfile, scripts de sauvegarde chiffrée (`age` + `rclone`), restauration, rétention, préflight de configuration |
| Fournisseurs | SMS (Twilio, Infobip), paiement (CinetPay, PayDunya), e-mail (Brevo, Resend) : **codés, éteints, jamais lancés contre un vrai service** |

Tables existantes (43) : `ika_users`, `ika_profiles`, `ika_sessions`, `ika_otp`, `ika_listings`, `ika_listing_photos`, `ika_listing_geo`, `ika_listing_drafts`, `ika_listing_price_history`, `ika_favorites`, `ika_comments`, `ika_comment_reports`, `ika_reports`, `ika_user_reports`, `ika_user_blocks`, `ika_threads`, `ika_messages`, `ika_visit_requests`, `ika_notifications`, `ika_notify_prefs`, `ika_alert_prefs`, `ika_alert_pending`, `ika_alerts`, `ika_saved_searches`, `ika_contact_events`, `ika_proofs`, `ika_blacklist`, `ika_reviews`, `ika_review_reports`, `ika_offers`, `ika_payments`, `ika_payment_events`, `ika_invoices`, `ika_audit`, `ika_settings`, `ika_bootstrap`, `ika_data_requests`, `stored_files`…

---

## 3. Inventaire fonctionnel confronté à l'ordonnance

### 3.1 Comptes, identité, rôles (art. 4, 5, 20)

| Exigence | État | Constat |
|---|---|---|
| Inscription e-mail + mot de passe (scrypt), session opaque hachée | **OP** | Conforme et bien conçu |
| Vérification de téléphone par SMS (OTP, limites 30 s / 5 par heure) | **OP** (code) / **À V** (SMS réel jamais envoyé) | |
| Connexion Google / Facebook / X / téléphone seul ; rattachement de méthodes | **AB** | Une seule méthode ; pas de `user_auth_methods`. Contradiction avec « aucune marque tierce » (§ 5) |
| Identifiant IKA SO unique et statut `UTILISATEUR ORDINAIRE` par défaut | **PA** | `staff_role='USER'` existe ; pas d'identifiant public ni de notion de type de compte |
| Types de compte : Premium, agence provisoire/vérifiée, annonceur, propriétaire, courtier | **PA** | Seulement `display_role` (3 libellés libres : Propriétaire direct / Agence / Démarcheur) + badge `agency_verified_at`. Pas d'`account_types`, pas d'historique de statut |
| Premium (demande, approbation Superadmin, droits) | **AB** | Aucune trace |
| Vérification d'agence à deux niveaux (provisoire / vérifiée) | **PA** | Badge « Agence vérifiée » avec note RCCM, par administrateur ; **pas de niveau provisoire**, pas d'historique conservant agent/documents/décision de façon structurée |
| Deux emplacements Superadmin exactement | **AB** | Modèle actuel : 1..n `SUPERADMIN`, au moins un actif. Aucun « principal/secondaire », aucune procédure de récupération |
| Permissions individuelles Admin/Modérateur, refus par défaut | **AB** | Pas de tables `roles/permissions`. Droits = rang fixe (`USER<MOD<ADMIN<SUPER`) vérifié côté serveur |
| Contrôle serveur des droits staff | **OP** | `requireStaff` dans les services ; `RESTRICTED` perd ses droits ; audit automatisé de toutes les routes `/staff/*` |
| Admin ne peut pas créer/promouvoir un Superadmin ; sanction limitée au rang inférieur | **OP** | `assertStaffRoleChange`, `assertCanSanction` ; dernier Superadmin protégé sous verrou |
| Abonnés / suivi de profils autorisés | **AB** | Aucune table `follows` |
| Comptes délégués (max 10 par Premium) | **AB** | |
| MFA des comptes privilégiés | **AB** | Aucune trace (seul `requestOtp` existe, pour le téléphone) |
| Récupération de mot de passe | **À V / AB** | Aucune route de réinitialisation trouvée dans `routes/index.js` |

### 3.2 Profils et réseau social (art. 6)

**PA.** Existent : profil (`full_name`, téléphone), page publique annonceur avec avis/confiance, favoris, commentaires. **Absents** : photo de profil/couverture, présentation, galerie, paramètres de confidentialité, J'aime (hors favoris), partage tracé, abonnés/abonnements, badges génériques (`badge_definitions`/`user_badges`).

### 3.3 Messagerie (art. 7)

| Élément | État |
|---|---|
| Fils par annonce et par personne, non-lus, coches envoyé/lu, filtres, recherche, bulles, séparateurs de jour | **OP** (code et tests rapportés) |
| Blocage, signalement (10 derniers messages), limite 30 msg/h | **OP** |
| Rafraîchissement toutes les 8 s (pas de temps réel) | **AM** |
| Images, vidéos, documents, vocaux, réactions, réponses ciblées, transfert, archivage, groupes, « en train d'écrire », présence | **AB** |
| « Contacter IKA SO » (catégories, dossier, responsable, historique) | **AB** |

Note : l'absence de pièces jointes est une **décision volontaire antérieure** (anti-arnaque, fichiers privés), à lever explicitement (§ 5).

### 3.4 Demandes de souscription et changement de statut (art. 8)

**AB.** Aucune table `upgrade_requests`, `request_documents`, `request_history`. Le mécanisme le plus proche est le dépôt de justificatif (`ika_proofs`) pour le badge foncier.

### 3.5 Modération, signalements, sanctions (art. 9)

| Élément | État |
|---|---|
| File de modération des annonces, décision motivée, alertes automatiques non bloquantes | **OP** |
| Signalements d'annonces, commentaires, avis, personnes ; masquer/écarter | **OP** |
| Liste noire téléphone/e-mail | **OP** |
| Statuts de compte `ACTIVE/RESTRICTED/BANNED` avec motif | **PA** (pas de suspension temporaire datée, pas de « révocation de statut » distincte, pas de contestation) |
| Bibliothèque d'avertissements personnalisables | **AB** |
| Contestation / réclamation | **AB** |
| Responsable par dossier, historique complet par dossier | **PA** |

### 3.6 Annonces et espace public (art. 3)

| Élément | État |
|---|---|
| Publication, brouillon serveur, expiration 45 j, vendu/loué/archivé, historique de prix, doublons, recherche plein texte, filtres | **OP** (code) |
| Carte (Mapbox embarqué + repli local), géodonnées, fiche imprimable | **PA** (SQL réel jamais exécuté, recette cartographique non faite) |
| Catégories | **PA** : `Terrain / Maison / Appartement / Studio`. **Absents** : villa, immeuble, local commercial, propriété agricole |
| Champs détaillés terrains/maisons/locations (viabilisation, dimensions, salons, piscine, caution, avance, charges, durée minimale…) | **PA / AB** — à comparer champ par champ à `listing-form.js` (113 lignes, formulaire compact) |
| Vidéos, galerie | **PA** (photos seulement) |
| Comparateur de biens, J'aime, partages | **AB** |
| Pages publiques serveur (SEO, sitemap, guides, annuaire d'agences) | **OP** (guides à faire relire) |
| Refonte visuelle « forêt/lime/sable » du 4 nov. | **À V** — `SUIVI.md` mentionne **deux palettes** (bleu/or « définitive » le 2 nov. ; forêt/lime/sable le 4 nov.) : voir anomalie A-09 |

### 3.7 Super Administrateur — centre de commandement (art. 10 à 19)

| Module de l'ordonnance | État | Source réelle disponible aujourd'hui |
|---|---|---|
| Barre supérieure, filtres temporels/géographiques/métier | **AB** | — |
| Indicateurs utilisateurs / annonces | **PA** | Comptages possibles directement depuis `ika_profiles`, `ika_listings` (aucun tableau actuel) |
| Visiteurs, trafic, sessions, appareils, origines | **AB** | `ika_sessions` ne contient ni appareil, ni dernière activité, ni pays. **Aucune IP stockée** (décision) |
| Visiteurs anonymes, pages vues, vues d'annonces | **AB** | **Aucune collecte** |
| Performance des annonces (vues, J'aime, partages, conversion) | **AB** | Seuls favoris, commentaires, contacts `CALL/WHATSAPP`, visites, messages existent |
| Performance des annonceurs | **PA** | Profil public (confiance, avis, annonces) ; pas de vues/contacts agrégés |
| Chercheurs et intentions | **PA** | `ika_saved_searches` ; aucune journalisation des recherches |
| Observatoire du marché | **PA** | `/prices` et pages quartier (médianes ≥ 3 comparables) ; pas de carte thermique ni de demandes non satisfaites |
| Journal d'audit (qui a fait quoi) | **PA / AM** | `ika_audit(id, actor_id, action, listing_id, note, created_at)` : **sans rôle de l'acteur, sans objet générique, sans ancienne/nouvelle valeur, sans pays/résultat, sans index par acteur/action**. `actor_id` sans clé étrangère |
| Alertes et anomalies | **PA** | 4 alertes (prix hors marché, rafale, proximité, commentaire signalé) ; pas de multi-comptes, connexions inhabituelles, réutilisation d'images, paiements incohérents |
| Temps réel | **PA** | Onglet « En ligne » (source à vérifier dans `moderation.js:35`) |
| Rapports PDF/Excel/CSV | **AB** | Export CSV seulement pour les données personnelles (JSON) ; facture imprimable |
| Multi-pays (gestion des pays, fuseaux) | **AB** | Produit pensé **Mali/Bamako** (XOF, FCFA, quartiers). Aucune table `countries` |
| Navigation admin en 28 modules | **AB** | 7 onglets actuels |

### 3.8 Monétisation (art. 21, phase 7)

**PA.** Socle indépendant du fournisseur : offres « mise à la une » (inactives, prix 0), paiement confirmé par webhook signé et contrôle de montant, rapprochement, factures numérotées, remboursement **noté** (pas réel). **AB** : abonnements Premium/agence, publicités, remboursement chez le fournisseur, relances.

### 3.9 Conformité et vie privée (art. 16.3)

**PA, plutôt avancé** : consentement versionné, export des données, suppression/anonymisation, rétention manuelle tracée, pages légales *provisoires*. **Tension identifiée** : la collecte analytique exigée par l'ordonnance (IP approximative, appareil, pays, sessions) contredit la décision « aucune IP stockée » et le plan de conformité (autorisation APDP, transferts hors Mali, conservation des données de connexion).

---

## 4. Sécurité — état constaté

**Points solides (lecture du code) :** scrypt ; sessions opaques hachées en base ; cookie `HttpOnly/SameSite/Secure` ; refus des écritures d'origine étrangère ; CSP `'self'` ; requêtes SQL paramétrées ; test automatisé qui appelle chaque route sans compte puis avec un simple compte ; frein de connexion par adresse et par compte ; webhooks vérifiés auprès du fournisseur ; pièces justificatives privées avec trace de chaque ouverture ; migrations sous verrou ; `BOOTSTRAP_ADMIN` verrouillé en production ; dernier Superadmin protégé.

### Anomalies et risques

| ID | Gravité | Constat | Lien ordonnance |
|---|---|---|---|
| A-01 | 🔴 | **Aucune exécution réelle** avec Express/pg/PostgreSQL ; toute la validation passée repose sur des substituts | Art. 22 (« validée uniquement si… tests… ») |
| A-02 | 🔴 | `package-lock.json` présent dans cette archive (à contrôler : taille/intégrité) alors que `SUIVI.md` dit qu'il manque ; incohérence documentaire, risque Docker/CI `npm ci` | Art. 2 |
| A-03 | 🔴 | **Aucune MFA** pour les comptes privilégiés ; pas de réinitialisation de mot de passe visible | Art. 20 |
| A-04 | 🟠 | **Pas de modèle de permissions** : impossible d'appliquer « permissions individuelles, refus par défaut » sans migration structurelle | Art. 5.2, 20 |
| A-05 | 🟠 | `ika_audit` trop pauvre pour l'art. 16.1 ; `actor_id` non relié ; rétention de l'audit en purge manuelle | Art. 16 |
| A-06 | 🟠 | Fichiers en BYTEA dans PostgreSQL : la **pièce jointe de messagerie** (vidéos, vocaux) ferait exploser la base, la sauvegarde et le coût Neon | Art. 7, 2 |
| A-07 | 🟠 | Limiteur de débit **en mémoire** (mono-instance) ; 240 req/min par IP peut bloquer toute une agence derrière une même adresse (noté par le projet) | Art. 20 |
| A-08 | 🟠 | Remboursement = simple note interne (pas de remboursement fournisseur) ; aucun paiement réel jamais fait | Art. 22 |
| A-09 | 🟡 | Documentation contradictoire : deux palettes déclarées « définitives » ; `SUIVI.md` contient un chapitre d'audit antérieur (2 nov.) basé sur une autre archive | Art. 23 |
| A-10 | 🟡 | Textes juridiques provisoires (`LEGAL_VALIDATED` faux), guides non relus, seuils d'alerte choisis sans validation | Art. 16.3 |
| A-11 | 🟡 | `ika_listings` etc. : identifiants `text` générés applicativement ; à documenter avant tout nouveau modèle (clés étrangères cohérentes) | Art. 2, 20 |
| A-12 | 🟡 | Interrogation à 8 s de la messagerie + 6 requêtes par action admin : charge accrue si l'analytique temps réel s'ajoute sans cache | Art. 17, 18 |

*(Ces anomalies sont des constats de lecture ; aucune exploitation n'a été testée.)*

---

## 5. Contradictions à trancher avant toute conception

| # | Code / décisions actuelles | Ordonnance | Question |
|---|---|---|---|
| C-1 | **Un seul** SUPERADMIN minimum (≥ 1), pas de secondaire | **Exactement deux** emplacements (principal/secondaire) | Quelle procédure de récupération/remplacement exacte ? Qui sont les deux titulaires ? |
| C-2 | « Aucune IP stockée », aucune donnée de navigation | Pays, appareil, sessions, visiteurs uniques, géolocalisation IP approximative | Autorisez-vous une collecte minimale (pseudonymisée, durée limitée) ? Cela exige l'avis du juriste/APDP |
| C-3 | « Aucune marque tierce / aucun script externe » ; connexion e-mail + mot de passe | Google, Facebook, X comme moyens de connexion | Le « sign-in » tiers est-il accepté malgré la politique actuelle (CSP, conformité) ? |
| C-4 | Messagerie **sans pièces jointes** (choix anti-arnaque) | Images, vidéos, documents, vocaux | Levée explicite de cette décision, avec modération et stockage objet |
| C-5 | Produit **Mali-only** (XOF, quartiers de Bamako) | « Panafricain », filtres pays/ville, fuseaux, gestion des pays | Périmètre pays à court terme ? (le pilote est Bamako) |
| C-6 | Base : fichiers en PostgreSQL ; rôle de personnel = 3 rangs fixes | Permissions fines, stockage de médias volumineux | Choix du stockage objet privé (⛔ déjà en attente dans `SUIVI.md`) |

---

## 6. Dépendances techniques et ordre réel

1. **Prérequis de preuve** : exécuter la suite sur vrai Express/pg/PostgreSQL (A-01) — sans cela, aucune phase ne peut être déclarée terminée.
2. **Fondations** (art. 21, « ordre des fondations comptes ») : identités → rôles/permissions → deux Superadmin → profils → … Chaque étape repose sur la précédente ; les **événements analytiques** (Phase 2) sont indépendants et peuvent démarrer tôt car **le temps perdu est irrécupérable** (pas de rétroactivité).
3. **Dépendances croisées** : analytique ↔ vie privée (C-2) ; pièces jointes ↔ stockage (C-4/C-6) ; Premium/abonnements ↔ fournisseur de paiement (⛔ déjà en attente) ; OAuth ↔ politique tierce (C-3).

---

## 7. Stratégie de mise à niveau proposée (non engagée)

Principe : **migrations additives uniquement**, aucune suppression, aucun renommage de table existante, anciens comptes compatibles (tout compte actuel devient `UTILISATEUR ORDINAIRE`, les `ADMIN/MODERATOR` conservent leurs droits par migration de leurs rangs en permissions équivalentes).

| Ordre | Chantier | Tables touchées (additif) | Risque |
|---|---|---|---|
| P0 | Validation réelle (`npm ci`, `npm test`, Docker, CI) et nettoyage documentaire | aucune | faible |
| P1 | `SPECIFICATION_SUPERADMIN.md`, `REGLES_METIER.md` (arbitrer C-1 à C-6) | aucune | — |
| P2 | Permissions : `roles`, `permissions`, `role_permissions`, `user_permissions` + migration des rangs actuels | nouvelles ; `ika_profiles.staff_role` conservée | moyen |
| P3 | Journal d'audit enrichi (nouvelle table, `ika_audit` conservée et alimentée en parallèle) | nouvelle | moyen |
| P4 | `analytics_events`, sessions enrichies, agrégats ; **collecte minimale conforme** | nouvelles | moyen (vie privée) |
| P5 | Comptes pro : types de compte, historique de statut, demandes de souscription, Premium, délégations (plafond 10 côté serveur) | nouvelles | élevé |
| P6 | Tableaux de bord réels (comptages d'abord depuis les données existantes) | aucune écriture | faible |
| P7 | Messagerie avancée / « Contacter IKA SO » / profils sociaux | nouvelles | moyen/élevé |
| P8 | Rapports PDF/Excel/CSV, observatoire, monétisation | nouvelles | moyen |

**Protections avant toute migration (art. 2) :** sauvegarde chiffrée + restauration testée sur base jetable (`scripts/backup.sh`, `scripts/restore-check.sh` existent mais n'ont **jamais été exécutés en réel**), test en développement, script de retour arrière par migration (modèle : `scripts/rollback/020_listing_geo_down.sql`), plan par chantier précisant tables, données préservées, tests et rollback.

---

## 8. Livraison (format imposé, art. 23)

**RÉALISÉ**
- Audit statique complet de l'archive, classification fonctionnelle, anomalies, contradictions, stratégie — *preuve : ce document*.
- Exécution de `test/rules.test.js` : 16/16.

**EN COURS**
- Rien (aucune modification engagée).

**RESTANT**
- Exécution réelle de la suite complète (A-01).
- Décisions C-1 à C-6.
- Rédaction de `SPECIFICATION_SUPERADMIN.md` (Phase 1) après validation.

**Limites de vérification :** pas de réseau, pas de base, pas d'exécution applicative ; les résultats de tests historiques ne sont pas rejoués.

---

## 9. Validation demandée avant la Phase 1

1. Arbitrage de **C-1 à C-6** (au minimum C-1, C-2 et C-4, qui conditionnent le modèle de données).
2. Confirmation que le périmètre de départ reste **Mali/Bamako** avec architecture prête pour le multi-pays (C-5).
3. Autorisation d'engager la Phase 1 (conception, documents uniquement, aucune migration).

### Statut des anomalies au 4 novembre 2026 (livraison n° 6)

| ID | Statut | Preuve / suite |
|---|---|---|
| A-01 | **Corrigée** | Suite complète exécutée sur PostgreSQL 16 réel avec Express 5.1.0 et pg 8.16.3 : 333 tests, 333 réussis, 0 échec. Migrations 001 à 020 appliquées ; retour arrière 020 puis rejeu vérifiés ; `pg_dump`/`pg_restore` vers une base jetable : 39 tables et lignes identiques. Limite : `backup.sh` lui-même (chiffrement `age`, copie `rclone`) non exécuté, `rclone` absent ici. |
| A-02 | **Corrigée** | `npm ci` réussi avec le `package-lock.json` fourni, 0 vulnérabilité signalée. |
| A-09 | **Corrigée (documentation)** | Palette réellement appliquée dans `public/css/ika.css` : forêt `#102c25`, feuille `#1e6b50`, lime `#c9ef75`, sable `#f6f5ef`. Les mentions « bleu/or définitive » de `SUIVI.md` (2 nov.) sont périmées. Icônes PNG d'installation : à vérifier visuellement. |
| A-11 | **Documentée** | Identifiants `text` générés par l'application : `newId(prefix)` = `préfixe-UUID` (`server/lib/security.js`). Tout nouveau modèle doit suivre ce format ; les tables d'événements et d'audit n'ont volontairement pas de clé étrangère vers les comptes. |
| A-03, A-04, A-05, A-06, A-07, A-08, A-12 | **Ouvertes (fonctionnalités)** | Ne se corrigent pas par un correctif : MFA et réinitialisation (phase 5), permissions (phase 5), audit enrichi (migration 022), pièces jointes (phase 6), limiteur partagé, remboursement fournisseur (phase 7), cache analytique (phase 3). Rien n'est modifié sans autorisation de phase. |
| A-10 | **Ouverte (juridique)** | Dépend de l'avis du juriste. |

Test corrigé : `test/budget.test.js` ne comptait pas comme « ressource externe » les adresses contenues dans `public/vendor/mapbox-gl.js` (bibliothèque hébergée chez nous, encadrée par le test CSP). Seul fichier de code modifié.
