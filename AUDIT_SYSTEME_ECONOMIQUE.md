# AUDIT DU SYSTÈME ÉCONOMIQUE — IKA SÔ Manager PRO

- Phase : 0 (audit), selon le cahier d'ordonnance technique v1.0 du 28/11/2026
- Date : 28 novembre 2026 (UTC)
- Base auditée : `main`, commit `eff3d402663ab66e0097c010024b0eeb013933a7` (« Fusion : interrupteurs commentaires, avis et messagerie »)
- Branche de travail : `feature/systeme-economique-ika-so` (créée depuis ce commit)
- Dernière migration réelle : `095_mfa_methodes.sql` (95 fichiers) → la prochaine est **096**
- Code modifié pendant l'audit : **aucun**
- Tests de référence avant travaux : `npm test` → 573 tests, **544 réussis, 0 échec, 29 ignorés** (tests PostgreSQL : pas de base dans l'environnement d'audit)

> Statut de ce document : constat du code. Aucune vérification de production. Aucun fournisseur de paiement n'a été testé en réel.

---

## 1. Synthèse

| Constat | Conséquence |
|---|---|
| Un vrai socle de paiement existe (offres, paiements, webhooks signés, idempotence, factures, remboursements, rapprochement). | Le Monetization Manager doit **s'y brancher**, pas le remplacer. |
| Ce socle ne connaît que deux produits (`BOOST`, `PREMIUM`) et une seule devise implicite (XOF, colonnes `*_xof`). | Extension additive : produits génériques, code devise, photographie du prix. |
| Le Centre des activations (15 interrupteurs, journalisé) existe. | Les interrupteurs économiques s'y ajoutent ou sont reliés depuis « Gestion économique ». |
| Les interrupteurs de modules sont **ouverts par défaut** (`modules.js` : seul `false` coupe). | **Incompatible avec la règle 0.1** pour les nouveaux modules : le nouveau mécanisme doit être fermé par défaut (seul `true` ouvre). |
| Aucun journal financier, commission, portefeuille, retrait, dossier de transaction, consentement de lead, commande générique. | À créer (migrations additives 096+). |
| 8 des 12 modules ont un embryon gratuit (visites, preuves, campagnes, biens, CRM…), sans aucune facturation. | Réutiliser ces tables comme objet métier ; ajouter la couche payante au-dessus. |

---

## 2. Existant réutilisable (fichiers et tables)

### 2.1 Paiements — `server/services/payments.js`, `server/payments/*`, `server/lib/payment-policy.js`

| Élément | État | Détail vérifié |
|---|---|---|
| Tables | Existant | `ika_offers` (008, 044 : `kind` BOOST/PREMIUM, `price_xof`, `active` faux par défaut, prix 0), `ika_payments` (statuts PENDING, PAID, FAILED, EXPIRED, MISMATCH, REFUNDED ; `applied_at`), `ika_payment_events` (dédoublonnage), `ika_invoices` (numéro `IKA-AAAA-000001`, une facture par paiement). |
| Sécurité | Existant, solide | Prix lu en base, jamais du navigateur ; webhook dans une transaction ; contrôle du montant (MISMATCH) ; verrous consultatifs contre les doubles achats ; effet appliqué une seule fois (`applied_at`). |
| Fournisseurs | Incomplet | `fake` (refusé en production), `cinetpay` (vérification `/payment/check`), `paydunya` (hash SHA-512 + `/confirm`). **Jamais exécutés contre le vrai service** (indiqué dans le code). Orange Money, Wave, Moov : uniquement via agrégateur, aucune intégration directe. |
| Politique | Existant, **un risque** | `payments_policy.onlineEnabled` = `false` par défaut et `normalizePolicy` n'ouvre que sur `true` explicite : conforme. **Mais** `payments.js` ligne 21 : sans lecteur de politique, repli `{ onlineEnabled: true }`. Le câblage de production (`services/index.js:84`) fournit bien le lecteur, donc pas de faille active ; le repli reste contraire au §18.2 et doit passer à `false`. |
| Remboursements | Existant | Total uniquement ; partiel tracé au journal et laissé à la main ; rapprochement fournisseur. |
| Devise | Absent | Aucune colonne devise ; montants en FCFA entiers. |

### 2.2 Réglages, interrupteurs, règles

| Fichier | Rôle actuel | Réutilisation |
|---|---|---|
| `server/services/superadmin-settings.js` + table `ika_superadmin_settings` (064) | Réglages clé/valeur JSON du Superadmin | Stocker la configuration globale de monétisation (clé dédiée), sans écraser les autres clés. |
| `server/lib/modules.js` | Coupures CRM, Premium, commentaires, avis, messagerie — **ouvert par défaut** | Ne pas modifier sa sémantique (règle 0.2). Créer une logique distincte « fermé par défaut » pour la monétisation. |
| `server/services/activations.js` | Centre des activations, journal `ACTIVATION_CHANGE` | Ajouter un groupe « Monétisation » ou un renvoi vers « Gestion économique ». |
| `server/lib/account-rules.js` + `ika_rule_exceptions` (077) | Règles officielles et exceptions par compte (plafonds d'annonces particulier / agence déjà présents) | Base du niveau 3 (catégorie de compte) et des quotas gratuits. |
| `server/lib/permissions.js` + `ika_permissions`, `ika_role_permissions`, `ika_user_permissions` (025, 065) | Permissions nommées, refus par défaut, délégation tracée | Ajouter par migration les permissions économiques du §26. |

### 2.3 Catégories de comptes réelles (niveau 3)

| Catégorie du cahier | Équivalent existant | Source |
|---|---|---|
| Standard | `staff_role = 'USER'` sans statut annonceur | `ika_profiles` |
| Annonceur | Demande « Devenir annonceur » approuvée | `ika_advertiser_applications`, `advertiser-applications.js` |
| Agence | `display_role = 'Agence immobilière'` ; `account_type = 'AGENCY'` dans Premium / Étoile | `rules.js` (`OWNER_ROLES`), 072, 088 |
| Premium | `ika_profiles.premium_until > now()` | 043 |
| Propriétaire professionnel | **Pas d'équivalent exact** ; proche : `Propriétaire direct` / `Démarcheur mandaté` | `OWNER_ROLES` |
| Partenaire (apporteur) | **Absent** (`ika_partners` est un annuaire, pas un compte) | 057 |
| Administrateur | `staff_role` MODERATOR / ADMIN / SUPERADMIN | `ika_profiles` |

Décision nécessaire : « propriétaire professionnel » = `Démarcheur mandaté`, ou nouvelle valeur ? (voir §6).

---

## 3. Cartographie des douze modules

| # | Module | État actuel | Fichiers / tables concernés | Réutilisation | Adaptation | Création | Risques | Tests |
|---|---|---|---|---|---|---|---|---|
| 1 | Publication payante | **Absent** (publication gratuite, plafonds `listingCap*`) | `listings.js`, `account-rules.js`, `ika_listings` | Parcours gratuit, plafonds | Point de contrôle « quota gratuit dépassé → formule » derrière le Monetization Manager | Produits `PUBLICATION_*`, lien commande ↔ annonce | Casser la publication gratuite ; annonce publiée avant paiement | Module OFF = parcours actuel identique ; quota ; paiement confirmé seul publie |
| 2 | Abonnements agences | **Incomplet** : Premium = abonnement unique par jours (`premium_until`, `ika_premium_grants`, demandes 071/072, remboursements Premium) | `premium-requests.js`, `payments.js` (PREMIUM), 043/044/071/072 | Mécanique d'expiration, octroi manuel, historique | États (expirant, suspendu, résilié), formules à avantages, durées 1/3/6/12 mois | `ika_subscriptions` (ou extension), catalogue d'avantages | Collision avec le Premium historique ; double prolongation | Non-régression Premium ; transitions d'état ; expiration sans suppression de données |
| 3 | Annonces sponsorisées | **Incomplet** : mise à la une payante (`BOOST`, `featured_until`, plafond `featured_max`), demandes gratuites (070), `ika_boost_plans` (catalogue affiché, `open:false`, non achetable), campagnes `SPONSORED` (041, sans paiement) | `payments.js`, `featured-requests.js`, `alerts.js`, `ika_campaigns` | `featured_until`, plafond sous verrou | Emplacements (accueil, ville, quartier, catégorie), dates début/fin | Lien campagne ↔ commande ; fin automatique (tâche planifiée) | Trois mécanismes parallèles à ne pas dupliquer ; badge vérifié accordé par erreur | BOOST inchangé ; démarrage/fin auto ; aucun badge |
| 4 | Commissions locations | **Absent** | — | `ika_listings`, `ika_visit_requests` comme origine | — | `ika_transactions` (type LOCATION), règles, commissions | Commission sans base contractuelle ; obligations légales locales | Aucune commission sans conclusion validée ; annulation |
| 5 | Commissions ventes | **Absent** | — | idem | — | `ika_transactions` (type VENTE), 8 statuts du §8.3, justificatifs | Prix déclaré faux ; réglementation | Aucune commission exigible sur simple déclaration |
| 6 | Contacts qualifiés | **Incomplet** : CRM interne par annonceur (`ika_crm_leads`, 062) ; **aucun consentement** de partage commercial | `crm.js`, `consent-services.js` | Pipeline CRM | Séparer leads CRM privés et leads commercialisables | `ika_lead_consents`, `ika_lead_access`, formulaire de recherche | **Vente de coordonnées sans consentement** (risque juridique majeur) | Accès refusé sans consentement ET paiement confirmé ; plafond de bénéficiaires ; double facturation |
| 7 | Vérifications | **Incomplet** (gratuit) : `ika_proofs` (DOCUMENT_FONCIER, AGENCE), badge Étoile (088/089), certification (081) | `trust.js`, `star-badge.js`, `certification-criteria.js` | Circuit de revue, badges | Niveaux de badge distincts du §10.3 | Commande payante liée à une demande de vérification ; prestataire | Libellé laissant croire à une garantie juridique | Badge jamais attribué par le paiement seul |
| 8 | Visites payantes | **Incomplet** (gratuit) : `ika_visit_requests` (PENDING/ACCEPTED/DECLINED/CANCELLED) | `engagement.js`, 007 | Demande et réponse de visite | Étape « service payant proposé », information préalable | Disponibilités, prestataire, lien commande | Frais imposés sans information | Visite gratuite intacte quand OFF |
| 9 | Publicité commerciale | **Incomplet** : `ika_campaigns` (BANNER/PROMO/SPONSORED/NEWS, DRAFT→ENDED), sans annonceur externe, paiement, impressions ni clics | `ika_campaigns`, écrans marketing Owner | Campagnes et statuts | Annonceur, emplacement, validation, mention « Publicité » | Compteurs impressions/clics agrégés, lien commande | Mesure sans consentement (cookies) | Validation avant diffusion ; libellé publicité |
| 10 | Services professionnels | **Absent** (`ika_services` = simple liste de services d'un profil) | 047 `ika_services` | — | — | Catalogue de prestations, commande, statut d'exécution | Prestataire tiers non contrôlé | Service OFF individuellement |
| 11 | Apporteurs d'affaires | **Absent** (`ika_partners` = annuaire public, à garder distinct) | `partners.js` | Rien côté rémunération | — | Comptes partenaires, codes, attribution, contestation | Rémunération pyramidale ; fausse attribution | Aucune commission de recrutement ; règle de priorité déterministe |
| 12 | Gestion immobilière | **Incomplet** : `ika_properties` (biens d'un propriétaire, sans locataires, baux, loyers) | `properties.js` | Fiches biens | Quotas par formule | Locataires, contrats, échéances, dépenses | Confusion avec un service de paiement réglementé | Suivi déclaratif uniquement |

### Socle transversal

| Brique | État | Création |
|---|---|---|
| Monetization Manager (§3) | Absent | Service `server/services/monetization.js` + lib pure `server/lib/monetization-policy.js` (testable sans base) |
| Catalogue central (§16) | Incomplet (`ika_offers`, `ika_boost_plans`) | `ika_commercial_products` (pays, devise, catégories, dates) ; `ika_offers` conservée et reliée |
| Commandes (§17) | Incomplet (`ika_payments` = commande + paiement) | `ika_commercial_orders` + `ika_order_items` (photographie prix/conditions) ; `ika_payments` réutilisée pour le paiement via `order_id` nullable |
| Journal financier (§19) | Absent (`ika_audit`, `ika_moderation_audit` = journaux d'actions, pas comptables) | `ika_financial_entries` append-only (trigger interdisant update/delete) |
| Répartition (§21) | Absent | `ika_commission_rules` + photographie des règles sur la commission |
| Portefeuille / retraits (§20) | Absent | Vue calculée depuis le journal ; `ika_partner_payouts` |
| Multidevise (§24) | Partiel (`ika_countries.currency`) | `currency` sur produits, commandes, écritures ; table de taux si conversion |
| Notifications (§25) | Existant (`notifier.js`, `ika_notifications`, e-mail/SMS/WhatsApp) | Nouveaux types d'événements |
| Owner Center (§22) | Existant (`public/js/owner/main.js`, `v-modules.js`) | Rubrique « Gestion économique » dans la navigation actuelle |

---

## 4. Risques identifiés

1. **Sémantique « ouvert par défaut »** de `modules.js` : réutiliser ce mécanisme pour la monétisation violerait la règle 0.1. Mécanisme séparé obligatoire, avec test « réglage absent = fermé ».
2. **Repli permissif** `payments.js:21` (`onlineEnabled: true` sans lecteur) : à corriger (§18.2).
3. **Premium et BOOST historiques** : ils ont leurs propres interrupteurs (module Premium ouvert par défaut, paiement en ligne fermé par défaut). Les subordonner au nouvel interrupteur général change le comportement actuel → arbitrage (§6, décision A).
4. **Fournisseurs non testés en réel** : aucun opérateur ne peut être déclaré disponible.
5. **Juridique** : vente de contacts, commissions, retraits et paiement de tiers relèvent d'obligations locales ; le propriétaire a déclaré que les documents juridiques seront produits avant activation. Les modules seront livrés **fermés**.
6. **Tests PostgreSQL non exécutables ici** (29 ignorés) : les migrations et parcours en base doivent être prouvés sur une base jetable (CI ou locale) avant fusion.
7. **Volume** : 12 modules + socle financier = plusieurs milliers de lignes et ~8 à 10 migrations. Livraison par phases et par lots fusionnables, conformément au §30.
8. **Accès en écriture** : la session d'audit ne peut que lire le dépôt ; pousser la branche nécessite l'accès en écriture accordé à l'agent.

---

## 5. Architecture cible retenue (proposition Phase 1)

```
Fonctionnalité (annonce, visite, lead…)
      │  demande un service payant
      ▼
Monetization Manager ── lit ──► configuration (global, modules, catégories, produits/pays/période)
      │ refuse (403 + motif) si UNE condition échoue
      ▼
Commande (ika_commercial_orders + items, prix photographié)
      ▼
payments.js existant (fournisseur, webhook signé, idempotence, facture)
      ▼  paiement confirmé par le fournisseur seulement
Activation du service + écritures du journal financier (+ commissions/répartition)
```

Règle d'évaluation (pure, testée) : `autorisé = global === true && module === true && catégorie === true && produit actif && pays autorisé && date dans la période && prix valide && conditions acceptées`. Toute valeur absente, inconnue ou mal formée = refus.

Migrations prévues (numéros indicatifs, à confirmer au moment de l'écriture) :

| N° | Contenu |
|---|---|
| 096 | Configuration monétisation (modules, règles par catégorie, permissions économiques) — tout à `false` |
| 097 | Catalogue `ika_commercial_products` (+ lien `ika_offers`) |
| 098 | Commandes et lignes ; `ika_payments.order_id`, `currency` (défaut `XOF`, compatible historique) |
| 099 | Journal financier append-only |
| 100 | Partenaires apporteurs, attributions, règles de commission, commissions, retraits |
| 101 | Transactions immobilières (location / vente) |
| 102 | Leads : consentements et accès |
| 103+ | Visites payantes, vérifications payantes, publicité, services, gestion immobilière |

---

## 6. Décisions attendues du propriétaire (avant Phase 1)

| Réf. | Question | Recommandation de l'agent |
|---|---|---|
| A | Les parcours payants **existants** (achat Premium et mise à la une) doivent-ils aussi être bloqués par le nouvel interrupteur général (OFF par défaut) ? | **Oui** pour le paiement en ligne uniquement (cohérent avec 0.1) ; octrois manuels gratuits et abonnements en cours inchangés. |
| B | « Propriétaire professionnel » correspond-il à `Démarcheur mandaté` ou faut-il une nouvelle catégorie ? | Nouvelle valeur seulement si besoin réel ; sinon correspondance avec `Démarcheur mandaté`. |
| C | Fusion : le cahier impose une branche dédiée et aucun déploiement sans accord ; la règle habituelle est la fusion dans `main` après contrôle. | Branche dédiée, une fusion par phase, sur accord explicite. |
| D | Ordre : commencer la Phase 1 (Monetization Manager + configuration OFF + écran) avant tout module ? | Oui. |

---

## 7. Tests à prévoir (reprend §29)

- Désactivation : réglage absent, global OFF, module OFF, catégorie OFF, produit OFF, pays non autorisé, hors période, prix absent, appel API direct, après migration et redémarrage.
- Paiement : réussi, échoué, annulé, signature invalide, notification répétée, montant ou devise incorrects, commande inconnue, double traitement, remboursement, expiration.
- Commissions : fixe, pourcentage, multi-bénéficiaires, arrondi déterministe, somme ≤ montant, annulation, remboursement, double attribution.
- Permissions : chaque rôle ; administrateur local sans accès global ; partenaire limité à ses données ; agence sans coordonnées non autorisées.
- Non-régression : suite complète, comparée à la référence 544/0/29.
