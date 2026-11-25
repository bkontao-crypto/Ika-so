# Plan du site et parcours — Étape 1 (v0.2)

Chaque écran a un **besoin**, un **parcours**, une **source** (code, API ou décision) et des **droits**. Cette liste est la source de vérité : `sitemap.json`, vérifiée par `test/etape1-docs.test.js` (toute route d'écran du code doit y figurer ; les cinq champs ne peuvent pas être vides).

Statuts : **Existant** (vérifié par lecture du code, pas en navigateur) · **À refondre** · **À créer** (étape indiquée).


## Écrans publics

| ID | Écran | Route | Statut | Besoin | Parcours | Source | Droits | Étape |
|---|---|---|---|---|---|---|---|---|
| S01 | Accueil | `#/` | Existant | Comprendre l'offre et lancer une recherche en moins de 10 secondes. | Arrivée → choix transaction/quartier → résultats ; ou section sponsorisée/vérifiée → fiche. | public/js/pages/home.js, home-sections.js · GET /listings, /homepage-settings, /campaigns/sponsored | Public (sans compte) | E02 |
| S02 | Annonces (résultats) | `#/annonces` | Existant | Filtrer et comparer des biens (transaction, catégorie, quartier, prix, surface, chambres). | Filtres → liste/grille/carte → fiche → contact ou favori. | home.js (annoncesPage), lib/search.js · GET /listings | Public (sans compte) | E04 |
| S03 | Carte | `#/carte` | Existant | Voir les biens localisés sans exposer la position privée. | Carte → marqueur → fiche ; secours local sans jeton. | localisation.js (cartePage) · GET /config/map, /places, /listings | Public (sans compte) | E05 |
| S04 | Fiche annonce | `#/annonce/:id` | Existant | Décider : voir photos, prix, localisation, confiance de l'annonceur, contacter. | Fiche → appeler/écrire/visite/favori/signaler ; profil annonceur. | listing.js · GET /listings/:id (+similar, comments, geo) | Public (sans compte) ; actions : Compte connecté | E04 |
| S05 | Annonceurs (annuaire) | `#/annonceurs` | Existant | Choisir un annonceur de confiance (agence, propriétaire, démarcheur). | Liste classée (sponsorisés étiquetés, confiance, visibilité, réponses) → profil. | annonceurs.js · GET /advertisers, /partners | Public (sans compte) | E04 |
| S06 | Profil annonceur | `#/annonceur/:id` | Existant | Savoir qui publie : expérience, avis, antécédents constatés, contact, signalement. | Profil → onglets (annonces, avis, contact, plus) → donner un avis / signaler. | advertiser.js, profil.css · GET /advertisers/:id | Public (sans compte) ; avis et contact : Compte connecté | E06 |
| S07 | Partenaires | `#/partenaires` | Existant | Découvrir les partenaires et offres liées. | Liste → fiche partenaire. | partners.js · GET /partners | Public (sans compte) | E09 |
| S08 | Connexion / inscription | `#/connexion` | Existant | Créer un compte ou se connecter (e-mail, téléphone). | Formulaire → code (OTP) → retour à la page demandée. | login.js · POST /auth/register, /auth/login | Public (sans compte) | E03 |
| S09 | Mot de passe oublié | `#/mot-de-passe-oublie` | Existant | Récupérer l'accès sans support. | E-mail/téléphone → lien ou code → nouveau mot de passe. | password-reset.js · POST /auth/forgot, /auth/reset | Public (sans compte) | E03 |
| S10 | Réclamations | `#/reclamations` | Existant | Déposer et suivre une réclamation. | Formulaire → suivi → réponse visible de l'équipe. | complaints.js · /me/complaints (+ migration 040) | Compte connecté | E06 |

## Compte et annonceur (existant)

| ID | Écran | Route | Statut | Besoin | Parcours | Source | Droits | Étape |
|---|---|---|---|---|---|---|---|---|
| S11 | Mon profil unique | `#/profil` | À refondre | Retrouver tous mes rôles, accès et réglages en un seul lieu. | Profil → onglets contextuels selon mes rôles (voir S30 à S38). | mon-profil.js, account.js · GET /me, /me/center/access | Compte connecté | E03 |
| S12 | Mes annonces | `#/mes-annonces` | Existant | Gérer mes annonces : statut, mise à la une, modification, archivage. | Liste → modifier/archiver/booster. | account.js (minePage) · GET /me/listings | Annonceur approuvé | E04 |
| S13 | Publier / modifier une annonce | `#/publier · #/modifier/:id` | Existant | Publier en 4 sections avec photos et documents. | Formulaire → envoi à la modération → statut. | publish.js, listing-form.js · POST /listings | Annonceur approuvé (création) ; propriétaire de l'annonce (modification) | E04 |
| S14 | Favoris | `#/favoris` | Existant | Retrouver les biens suivis. | Liste → fiche ; retrait. | account.js (favoritesPage) · GET /me/favorites | Compte connecté | E04 |
| S15 | Messages | `#/boite · #/boite/:id` | Existant | Échanger avec annonceurs et acheteurs. | Boîte → conversation → pièce jointe/blocage/signalement. | inbox.js · GET /me/threads | Compte connecté | E08 |
| S16 | Confiance et documents | `#/confiance` | Existant | Prouver mon identité/mes documents et suivre leur examen. | Dépôt → statut → décision motivée. | trust.js · /me/proofs | Compte connecté | E06 |
| S17 | Devenir annonceur | `#/devenir-annonceur` | Existant | Demander le statut d'annonceur approuvé. | Demande → pièces → décision de l'équipe. | advertiser-apply.js · /me/advertiser-application | Compte connecté | E03 |
| S18 | Mon profil public | `#/mon-profil-public` | Existant | Présenter mon activité (photo, présentation, zones). | Formulaire → aperçu public. | profile-edit.js · /me/public-profile | Annonceur approuvé | E03 |
| S19 | Espace agence | `#/agence` | Existant | Gérer l'agence (documents, vérification). | Agence → pièces → badge selon validation réelle. | agency.js · /me/agency | Annonceur approuvé (agence) | E07 |
| S20 | Centre Premium | `#/centre` | Existant | Suivre performances et campagnes de mon offre Premium. | Centre → statistiques → renouvellement. | centre.js, centre-standard.js · /me/center/* | Annonceur Premium certifié | E07 |
| S21 | Premium (offres) | `#/premium` | Existant | Comprendre et souscrire une offre. | Offres → paiement → activation. | premium.js · GET /offers, POST /me/payments | Compte connecté | E08 |
| S22 | Paiements | `#/paiements` | Existant | Voir mes paiements et factures. | Liste → détail. | payments.js · GET /me/payments | Compte connecté | E08 |
| S23 | Localiser un bien | `#/localiser/:id` | Existant | Positionner mon bien (point/contour). | Carte → dessin → enregistrement. | localisation.js · /me/listings/:id/geo | Annonceur approuvé | E05 |

## Compte unifié — nouveaux onglets (DEC-001)

| ID | Écran | Route | Statut | Besoin | Parcours | Source | Droits | Étape |
|---|---|---|---|---|---|---|---|---|
| S30 | Compte · Aperçu | `#/profil (onglet Aperçu)` | À créer | Voir en un coup d'œil mes rôles, tâches urgentes et raccourcis. | Profil → carte « Mes accès » → actions en attente. | Décision DEC-001 ; GET /me, /me/center/access ; permissions (lib/permissions.js) | Compte connecté | E03 |
| S31 | Compte · Mes biens | `#/profil (onglet Mes biens)` | À créer | Gérer mon patrimoine : biens, annonces liées, demandes, visites, documents, performances, collaborateurs. | Liste de biens → fiche bien → annonces/visites/documents → inviter un collaborateur. | Décision DEC-001 et DEC-004 (modèle « bien ») ; à concevoir | Annonceur approuvé ou propriétaire de biens | E03 |
| S32 | Compte · Annonces | `#/profil (onglet Annonces)` | À créer | Retrouver mes annonces dans le profil. | Onglet → S12. | S12 | Annonceur approuvé | E03 |
| S33 | Compte · Messages et visites | `#/profil (onglet Messages)` | À créer | Suivre échanges et visites au même endroit. | Onglet → S15 + visites. | S15 | Compte connecté | E03 |
| S34 | Compte · Favoris et recherches | `#/profil (onglet Favoris)` | À créer | Retrouver favoris et recherches sauvegardées avec alertes. | Onglet → S14 + alertes. | S14, /me/searches | Compte connecté | E03 |
| S35 | Compte · Documents et confiance | `#/profil (onglet Documents)` | À créer | Regrouper mes pièces et mes statuts de vérification. | Onglet → S16. | S16 | Compte connecté | E03 |
| S36 | Compte · Abonnement et paiements | `#/profil (onglet Abonnement)` | À créer | Gérer mon offre et mes factures. | Onglet → S21 + S22. | S21, S22 | Compte connecté | E03 |
| S37 | Compte · Professionnel / CRM | `#/profil (onglet Pro)` | À créer | Gérer prospects, pipeline, équipe et rapports de mon agence. | Onglet → prospects → pipeline → tâches → rapports. | Migrations 031/056 ; à concevoir | Annonceur Premium certifié ou agence vérifiée | E07 |
| S38 | Compte · Réglages et confidentialité | `#/profil (onglet Réglages)` | À créer | Contrôler notifications, visibilité, consentements, export et suppression de mes données. | Onglet → préférences → export/suppression. | /me/notify-prefs, /me/analytics-consent, /me/export | Compte connecté | E03 |

## Équipe et Owner Center

| ID | Écran | Route | Statut | Besoin | Parcours | Source | Droits | Étape |
|---|---|---|---|---|---|---|---|---|
| S40 | Administration (équipe) | `/admin` | Existant | Modérer annonces, confiance, signalements, paiements. | Connexion équipe → file → décision motivée → journal. | owner.html, js/owner/main.js · /staff/* | Modérateur, admin, Superadmin | E06 |
| S41 | Owner Center (console) | `/owner` | Existant | Piloter la plateforme : tableaux, CRM, marketing, sauvegardes, réglages, marque. | Connexion → module autorisé → action journalisée. | owner.html, js/owner/* · 79 routes /staff/owner/* ; DEC-001 | Superadmin et admins autorisés (par module) | E03 |
| S42 | Owner Center · Marque et contenus | `/owner (module marque)` | À créer | Changer nom, logos, slogan, images, liens et contenus sans toucher au code. | Module → aperçu → validation → historique. | homepage-settings.js, platform-settings ; à compléter | Superadmin (délégable selon la matrice) | E09 |
| S45 | Vérification en deux étapes (MFA) | `/verification` | Existant | Terminer la connexion d'un compte protégé par la double authentification. | Mot de passe (ou Google) → saisie du code de l'appli ou d'un code de secours → connecté ; bouton Abandonner. | mfa-login.js, mfa-security.js · GET /mfa/pending, POST /mfa/login, /mfa/cancel, /mfa/begin, /mfa/confirm, /mfa/backup-codes, /mfa/disable | Compte ayant activé la MFA, session en attente de code ; activation et réglages depuis Mon compte (compte connecté) | E03 |
| S46 | WhatsApp (boîte du personnel) | `/whatsapp` | Existant | Lire les messages WhatsApp reçus des contacts et leur répondre depuis le site. | Personnel connecté → liste des conversations → fil de messages → envoi ; « Nouveau » pour écrire à un numéro ; bloc « Configuration Meta » (adresse du webhook). | whatsapp.js, whatsapp.css · GET /whatsapp/status, GET /whatsapp/messages, POST /whatsapp/send | Personnel autorisé (le serveur refuse tout autre compte) ; l'ancienne adresse /whatsapp redirige vers #/whatsapp | E07 |

## Parcours clés (résumé)
1. **Chercheur de bien** : Accueil → Annonces ou Carte → Fiche → (Annonceur de confiance ? profil) → contact / visite / favori. *Preuve visée (E02, E04)* : parcours rejoué en navigateur, mobile d'abord.
2. **Annonceur** : Connexion → Devenir annonceur → approbation par l'équipe → Publier → modération → annonce en ligne → messages → booster.
3. **Propriétaire de biens** (nouveau) : Profil → Mes biens → fiche d'un bien → annonce liée, visites, documents, collaborateur.
4. **Agence / professionnel** : Espace agence (vérification) → Pro/CRM (prospects, pipeline, rapports) → équipe.
5. **Équipe** : /admin (file de modération) ; **Superadmin et admins autorisés** : /owner (modules selon la matrice).

## Compte unifié : onglets contextuels
Un seul compte, un seul profil. Les onglets affichés dépendent des rôles réels du compte (Aperçu, Mes biens, Annonces, Messages, Favoris, Documents, Abonnement, Pro, Réglages) ; un bouton « Console » apparaît pour l'équipe et « Owner Center » pour le Superadmin et les admins autorisés. **L'affichage n'accorde aucun droit : chaque action reste contrôlée côté serveur.** Maquette : `maquettes/compte-unifie.html`.
