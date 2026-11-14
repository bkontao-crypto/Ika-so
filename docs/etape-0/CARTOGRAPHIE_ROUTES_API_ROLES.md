# Cartographie des routes, API et rôles — état initial (Étape 0)

Généré automatiquement le 2026-11-11 par lecture du code (`public/js/app.js`, `server/routes/index.js`, `server/services/*.js`). **Lecture statique : aucune route n'a été appelée.**

## 1. Écrans (routes frontend, hash)

| Motif | Module | Fonction |
|---|---|---|
| `/^\/reclamations$/` | `complaints.js` | `complaintsPage` |
| `/^\/$/` | `home.js` | `homePage` |
| `/^\/annonces$/` | `home.js` | `annoncesPage` |
| `/^\/partenaires$/` | `partners.js` | `partnersPage` |
| `/^\/annonceurs$/` | `annonceurs.js` | `annonceursPage` |
| `/^\/centre$/` | `centre.js` | `centrePage` |
| `/^\/devenir-annonceur$/` | `advertiser-apply.js` | `advertiserApplyPage` |
| `/^\/premium$/` | `premium.js` | `premiumPage` |
| `/^\/annonce\/([^/]+)$/` | `listing.js` | `listingPage` |
| `/^\/publier$/` | `publish.js` | `publishPage` |
| `/^\/modifier\/([^/]+)$/` | `publish.js` | `editPage` |
| `/^\/mes-annonces$/` | `account.js` | `minePage` |
| `/^\/localiser\/([^/]+)$/` | `localisation.js` | `localisationPage` |
| `/^\/carte$/` | `localisation.js` | `cartePage` |
| `/^\/favoris$/` | `account.js` | `favoritesPage` |
| `/^\/profil$/` | `mon-profil.js` | `profilePage` |
| `/^\/connexion$/` | `login.js` | `loginPage` |
| `/^\/mot-de-passe-oublie$/` | `password-reset.js` | `passwordResetPage` |
| `/^\/annonceur\/([^/]+)$/` | `advertiser.js` | `advertiserPage` |
| `/^\/mon-profil-public$/` | `profile-edit.js` | `profileEditPage` |
| `/^\/confiance$/` | `trust.js` | `trustPage` |
| `/^\/agence$/` | `agency.js` | `agencyPage` |
| `/^\/paiements$/` | `payments.js` | `paymentsPage` |
| `/^\/boite$/` | `inbox.js` | `inboxPage` |
| `/^\/boite\/([^/]+)$/` | `inbox.js` | `threadPage` |

Pages HTML : `index.html` (site), `admin.html` (équipe), `owner.html` (Owner Control, servi aussi sur `/owner`).

## 2. API — synthèse par niveau d'accès

| Niveau | Routes |
|---|---|
| équipe (contrôle dans le service) | 123 |
| connecté | 97 |
| public | 29 |

Total : **249 routes**. « équipe (contrôle dans le service) » = la route n'appelle pas `requireStaff` elle-même ; le contrôle de rang est fait dans le service appelé (**à tester route par route : BUG-008**).

## 3. Routes publiques (sans compte)

| Méthode | Chemin |
|---|---|
| GET | `/media/:id` |
| POST | `/client-error` |
| POST | `/auth/register` |
| POST | `/auth/login` |
| POST | `/auth/forgot` |
| POST | `/auth/reset` |
| POST | `/auth/logout` |
| GET | `/me` |
| GET | `/config/map` |
| POST | `/e` |
| GET | `/listings` |
| GET | `/listings/:id` |
| GET | `/listings/:id/similar` |
| GET | `/listings/:id/comments` |
| GET | `/listings/:id/geo` |
| GET | `/advertisers` |
| GET | `/advertisers/:id` |
| GET | `/advertisers/:id/reviews` |
| GET | `/prices` |
| GET | `/offers` |
| POST | `/premium/click` |
| POST | `/payments/webhook` |
| GET | `/campaigns/sponsored` |
| GET | `/campaigns/sidebar` |
| GET | `/homepage-settings` |
| GET | `/platform-settings` |
| GET | `/places` |
| GET | `/partners` |
| GET | `/sitemap.xml` |

Les écritures publiques (`POST /client-error`, `POST /e`, `POST /premium/click`, `POST /payments/webhook`) sont limitées en débit ou signées (webhook) — vérifié dans le code.

## 4. Rangs minimum demandés dans les services (`requireStaff`)

| Service | Rang minimum | Appels |
|---|---|---|
| `accounts.js` | ADMIN | 1 |
| `advertiser-applications.js` | MODERATOR | 3 |
| `advertiser-center.js` | SUPERADMIN | 1 |
| `advertiser-profile.js` | MODERATOR | 1 |
| `engagement.js` | MODERATOR | 2 |
| `geo.js` | MODERATOR | 1 |
| `homepage-settings.js` | ADMIN | 2 |
| `moderation.js` | ADMIN | 1 |
| `moderation.js` | MODERATOR | 6 |
| `moderation.js` | SUPERADMIN | 1 |
| `owner-center.js` | SUPERADMIN | 1 |
| `partners.js` | ADMIN | 6 |
| `payments.js` | ADMIN | 4 |
| `places.js` | SUPERADMIN | 1 |
| `reviews.js` | MODERATOR | 3 |
| `stats.js` | ADMIN | 4 |
| `stats.js` | SUPERADMIN | 56 |
| `trust.js` | ADMIN | 4 |
| `trust.js` | MODERATOR | 7 |

Rangs : USER < MODERATOR < ADMIN < SUPERADMIN. Les permissions nommées (`server/lib/permissions.js`) **ne sont pas branchées** (BUG-004).

## 5. Toutes les routes API

| Méthode | Chemin | Accès | Ligne |
|---|---|---|---|
| GET | `/media/:id` | public | 18 |
| POST | `/client-error` | public | 46 |
| POST | `/auth/register` | public | 54 |
| POST | `/auth/login` | public | 63 |
| POST | `/auth/forgot` | public | 85 |
| POST | `/auth/reset` | public | 90 |
| POST | `/staff/accounts/:id/reset-link` | équipe (contrôle dans le service) | 94 |
| POST | `/auth/logout` | public | 99 |
| GET | `/me` | public | 107 |
| POST | `/me/otp` | connecté | 112 |
| POST | `/me/otp/verify` | connecté | 118 |
| GET | `/config/map` | public | 127 |
| POST | `/e` | public | 133 |
| GET | `/listings` | public | 142 |
| GET | `/listings/:id` | public | 153 |
| GET | `/listings/:id/similar` | public | 158 |
| GET | `/listings/:id/comments` | public | 159 |
| GET | `/listings/:id/geo` | public | 163 |
| GET | `/me/geo` | connecté | 164 |
| GET | `/me/listings/:id/geo` | connecté | 165 |
| POST | `/me/listings/:id/geo` | connecté | 166 |
| POST | `/me/listings/:id/geo/delete` | connecté | 171 |
| GET | `/me/listings/:id/fiche` | connecté | 177 |
| GET | `/staff/listings/:id/geo` | équipe (contrôle dans le service) | 183 |
| GET | `/me/listings` | connecté | 186 |
| GET | `/me/listings/:id` | connecté | 187 |
| GET | `/me/favorites` | connecté | 188 |
| GET | `/me/draft` | connecté | 191 |
| PUT | `/me/draft` | connecté | 192 |
| DELETE | `/me/draft` | connecté | 197 |
| POST | `/listings` | connecté | 199 |
| PUT | `/listings/:id` | connecté | 207 |
| POST | `/listings/:id/outcome` | connecté | 214 |
| POST | `/listings/:id/favorite` | connecté | 223 |
| POST | `/listings/:id/contact` | connecté | 230 |
| POST | `/listings/:id/comments` | connecté | 240 |
| POST | `/listings/:id/report` | connecté | 248 |
| GET | `/me/analytics-consent` | connecté | 257 |
| PUT | `/me/analytics-consent` | connecté | 258 |
| GET | `/advertisers` | public | 266 |
| GET | `/me/score` | connecté | 270 |
| PUT | `/me/identity` | connecté | 271 |
| GET | `/me/center/access` | connecté | 276 |
| GET | `/me/center` | connecté | 277 |
| GET | `/me/center/standard` | connecté | 278 |
| GET | `/me/advertiser-applications` | connecté | 281 |
| POST | `/me/advertiser-applications` | connecté | 282 |
| POST | `/me/advertiser-applications/:id/documents` | connecté | 283 |
| POST | `/me/advertiser-applications/:id/documents/renew` | connecté | 288 |
| GET | `/staff/advertiser-applications/:id/documents/:documentId` | équipe (contrôle dans le service) | 289 |
| GET | `/staff/advertiser-applications` | équipe (contrôle dans le service) | 293 |
| POST | `/staff/advertiser-applications/:id/decide` | équipe (contrôle dans le service) | 294 |
| GET | `/me/center/map` | connecté | 295 |
| POST | `/staff/premium/:id` | équipe (contrôle dans le service) | 296 |
| GET | `/advertisers/:id` | public | 298 |
| POST | `/advertisers/:id/follow` | connecté | 299 |
| PUT | `/advertisers/:id/follow` | connecté | 304 |
| GET | `/me/followers` | connecté | 310 |
| GET | `/me/following` | connecté | 311 |
| GET | `/me/follow-settings` | connecté | 312 |
| PUT | `/me/follow-settings` | connecté | 313 |
| POST | `/advertisers/:id/team-request` | connecté | 315 |
| GET | `/me/team-requests` | connecté | 320 |
| POST | `/me/team-requests/:id/accept` | connecté | 321 |
| POST | `/me/team-requests/:id/decline` | connecté | 322 |
| POST | `/me/team-requests/:id/remove` | connecté | 323 |
| POST | `/me/publications` | connecté | 324 |
| POST | `/me/publications/:id/delete` | connecté | 329 |
| POST | `/me/team` | connecté | 330 |
| POST | `/me/team/:id/delete` | connecté | 335 |
| POST | `/me/services` | connecté | 336 |
| POST | `/me/services/:id/delete` | connecté | 341 |
| GET | `/advertisers/:id/reviews` | public | 342 |
| POST | `/advertisers/:id/reviews` | connecté | 344 |
| GET | `/me/public-profile` | connecté | 350 |
| PUT | `/me/public-profile` | connecté | 351 |
| POST | `/me/public-profile/image` | connecté | 356 |
| POST | `/me/public-profile/image/delete` | connecté | 361 |
| POST | `/advertisers/:id/contact` | connecté | 362 |
| POST | `/advertisers/:id/report` | connecté | 371 |
| POST | `/advertisers/:id/reviews/delete` | connecté | 378 |
| POST | `/reviews/:id/reply` | connecté | 379 |
| POST | `/reviews/:id/reply/delete` | connecté | 384 |
| POST | `/reviews/:id/report` | connecté | 385 |
| POST | `/staff/reviews/:id/hide` | équipe (contrôle dans le service) | 390 |
| POST | `/staff/reviews/:id/dismiss-reports` | équipe (contrôle dans le service) | 391 |
| GET | `/me/notify-prefs` | connecté | 394 |
| PUT | `/me/notify-prefs` | connecté | 395 |
| GET | `/me/export` | connecté | 403 |
| POST | `/me/delete` | connecté | 411 |
| POST | `/me/proofs` | connecté | 420 |
| GET | `/me/proofs` | connecté | 425 |
| POST | `/comments/:id/report` | connecté | 426 |
| GET | `/me/searches` | connecté | 433 |
| POST | `/me/searches` | connecté | 434 |
| GET | `/me/alert-prefs` | connecté | 439 |
| PUT | `/me/alert-prefs` | connecté | 440 |
| POST | `/me/searches/:id/delete` | connecté | 445 |
| GET | `/me/notifications` | connecté | 446 |
| GET | `/me/unread` | connecté | 447 |
| POST | `/me/notifications/read` | connecté | 448 |
| POST | `/listings/:id/messages` | connecté | 449 |
| GET | `/me/threads` | connecté | 457 |
| GET | `/me/threads/:id` | connecté | 458 |
| POST | `/me/threads/:id/messages` | connecté | 459 |
| POST | `/me/threads/:id/block` | connecté | 466 |
| POST | `/me/threads/:id/unblock` | connecté | 471 |
| POST | `/me/threads/:id/report` | connecté | 472 |
| POST | `/listings/:id/visit` | connecté | 479 |
| GET | `/me/visits` | connecté | 486 |
| POST | `/me/visits/:id/answer` | connecté | 487 |
| POST | `/me/visits/:id/cancel` | connecté | 488 |
| GET | `/prices` | public | 491 |
| GET | `/me/agency` | connecté | 492 |
| POST | `/me/import` | connecté | 493 |
| GET | `/offers` | public | 500 |
| POST | `/payments/checkout` | connecté | 501 |
| POST | `/premium/click` | public | 510 |
| GET | `/me/payments` | connecté | 515 |
| GET | `/me/payments/:id/invoice` | connecté | 516 |
| POST | `/payments/webhook` | public | 518 |
| GET | `/staff/offers` | équipe (contrôle dans le service) | 522 |
| POST | `/staff/offers/:id` | équipe (contrôle dans le service) | 523 |
| GET | `/staff/payments/reconcile` | équipe (contrôle dans le service) | 524 |
| POST | `/staff/payments/:id/refund` | équipe (contrôle dans le service) | 525 |
| GET | `/campaigns/sponsored` | public | 528 |
| GET | `/campaigns/sidebar` | public | 532 |
| GET | `/homepage-settings` | public | 539 |
| GET | `/platform-settings` | public | 540 |
| PUT | `/staff/homepage-settings` | équipe (contrôle dans le service) | 541 |
| POST | `/staff/homepage-image` | équipe (contrôle dans le service) | 542 |
| GET | `/places` | public | 546 |
| GET | `/staff/owner/places` | équipe (contrôle dans le service) · owner | 547 |
| POST | `/staff/owner/zones` | équipe (contrôle dans le service) · owner | 548 |
| POST | `/staff/owner/zones/bulk` | équipe (contrôle dans le service) · owner | 549 |
| PUT | `/staff/owner/zones/:id` | équipe (contrôle dans le service) · owner | 550 |
| POST | `/staff/owner/zones/:id/active` | équipe (contrôle dans le service) · owner | 551 |
| POST | `/staff/owner/zones/:id/delete` | équipe (contrôle dans le service) · owner | 552 |
| POST | `/staff/owner/countries` | équipe (contrôle dans le service) · owner | 553 |
| PUT | `/staff/owner/countries/:code` | équipe (contrôle dans le service) · owner | 554 |
| POST | `/staff/owner/countries/:code/active` | équipe (contrôle dans le service) · owner | 555 |
| POST | `/staff/owner/countries/:code/delete` | équipe (contrôle dans le service) · owner | 556 |
| GET | `/partners` | public | 557 |
| GET | `/staff/partners` | équipe (contrôle dans le service) | 558 |
| POST | `/staff/partners` | équipe (contrôle dans le service) | 559 |
| PUT | `/staff/partners/:id` | équipe (contrôle dans le service) | 560 |
| POST | `/staff/partners/:id/status` | équipe (contrôle dans le service) | 561 |
| POST | `/staff/partners/:id/delete` | équipe (contrôle dans le service) | 562 |
| POST | `/staff/partner-logo` | équipe (contrôle dans le service) | 563 |
| GET | `/staff/queue` | équipe (contrôle dans le service) | 566 |
| GET | `/staff/owner/dashboard` | équipe (contrôle dans le service) · owner | 569 |
| GET | `/staff/owner/activity/catalog` | équipe (contrôle dans le service) · owner | 570 |
| GET | `/staff/owner/activity/summary` | équipe (contrôle dans le service) · owner | 571 |
| GET | `/staff/owner/activity/trace` | équipe (contrôle dans le service) · owner | 572 |
| GET | `/staff/owner/activity/export.csv` | équipe (contrôle dans le service) · owner | 573 |
| GET | `/staff/owner/activity` | équipe (contrôle dans le service) · owner | 582 |
| GET | `/staff/owner/security-log` | équipe (contrôle dans le service) · owner | 583 |
| PUT | `/staff/owner/security-log` | équipe (contrôle dans le service) · owner | 584 |
| GET | `/staff/owner/overview` | équipe (contrôle dans le service) · owner | 585 |
| GET | `/staff/owner/crm` | équipe (contrôle dans le service) · owner | 586 |
| GET | `/staff/owner/report.pdf` | équipe (contrôle dans le service) · owner | 587 |
| GET | `/staff/owner/premium-funnel` | équipe (contrôle dans le service) · owner | 593 |
| GET | `/staff/owner/regions` | équipe (contrôle dans le service) · owner | 594 |
| GET | `/staff/owner/offers` | équipe (contrôle dans le service) · owner | 595 |
| POST | `/staff/owner/offers` | équipe (contrôle dans le service) · owner | 596 |
| POST | `/staff/owner/offers/toggle` | équipe (contrôle dans le service) · owner | 597 |
| GET | `/staff/owner/restores` | équipe (contrôle dans le service) · owner | 598 |
| POST | `/staff/owner/restores` | équipe (contrôle dans le service) · owner | 599 |
| GET | `/staff/owner/subscriptions` | équipe (contrôle dans le service) · owner | 600 |
| POST | `/staff/owner/ai/write` | équipe (contrôle dans le service) · owner | 601 |
| GET | `/staff/owner/ai` | équipe (contrôle dans le service) · owner | 602 |
| GET | `/staff/owner/report` | équipe (contrôle dans le service) · owner | 603 |
| GET | `/staff/owner/logo` | équipe (contrôle dans le service) · owner | 604 |
| PUT | `/staff/owner/logo` | équipe (contrôle dans le service) · owner | 605 |
| GET | `/staff/owner/newsletters` | équipe (contrôle dans le service) · owner | 606 |
| POST | `/staff/owner/newsletters` | équipe (contrôle dans le service) · owner | 607 |
| POST | `/staff/owner/newsletters/:id/send` | équipe (contrôle dans le service) · owner | 608 |
| GET | `/staff/owner/legal` | équipe (contrôle dans le service) · owner | 609 |
| PUT | `/staff/owner/legal` | équipe (contrôle dans le service) · owner | 610 |
| GET | `/sitemap.xml` | public | 612 |
| GET | `/staff/owner/seo` | équipe (contrôle dans le service) · owner | 613 |
| PUT | `/staff/owner/seo` | équipe (contrôle dans le service) · owner | 614 |
| POST | `/staff/owner/broadcast` | équipe (contrôle dans le service) · owner | 615 |
| GET | `/staff/owner/pipeline` | équipe (contrôle dans le service) · owner | 619 |
| POST | `/staff/owner/pipeline` | équipe (contrôle dans le service) · owner | 620 |
| POST | `/staff/owner/pipeline/:id/stage` | équipe (contrôle dans le service) · owner | 621 |
| GET | `/staff/owner/languages` | équipe (contrôle dans le service) · owner | 622 |
| POST | `/staff/owner/languages/toggle` | équipe (contrôle dans le service) · owner | 623 |
| GET | `/staff/owner/redirects` | équipe (contrôle dans le service) · owner | 624 |
| POST | `/staff/owner/redirects` | équipe (contrôle dans le service) · owner | 625 |
| GET | `/staff/owner/categories` | équipe (contrôle dans le service) · owner | 626 |
| POST | `/staff/owner/categories/toggle` | équipe (contrôle dans le service) · owner | 627 |
| GET | `/staff/owner/trends` | équipe (contrôle dans le service) · owner | 628 |
| GET | `/staff/owner/charts` | équipe (contrôle dans le service) · owner | 629 |
| POST | `/staff/owner/visits/:id/status` | équipe (contrôle dans le service) · owner | 630 |
| GET | `/me/newsletter` | connecté | 634 |
| PUT | `/me/newsletter` | connecté | 635 |
| GET | `/me/complaints` | connecté | 636 |
| POST | `/me/complaints` | connecté | 637 |
| GET | `/me/complaints/:id` | connecté | 638 |
| POST | `/me/complaints/:id/comment` | connecté | 639 |
| GET | `/staff/owner/complaints/:id` | équipe (contrôle dans le service) · owner | 640 |
| POST | `/staff/owner/complaints/:id/assign` | équipe (contrôle dans le service) · owner | 641 |
| POST | `/staff/owner/complaints/:id/comment` | équipe (contrôle dans le service) · owner | 642 |
| POST | `/staff/owner/complaints/:id/close` | équipe (contrôle dans le service) · owner | 643 |
| POST | `/staff/owner/complaints/:id/resolve` | équipe (contrôle dans le service) · owner | 644 |
| GET | `/staff/owner/incidents` | équipe (contrôle dans le service) · owner | 645 |
| POST | `/staff/owner/incidents` | équipe (contrôle dans le service) · owner | 646 |
| POST | `/staff/owner/incidents/:id/resolve` | équipe (contrôle dans le service) · owner | 647 |
| GET | `/staff/owner/complaints` | équipe (contrôle dans le service) · owner | 648 |
| POST | `/staff/owner/backup/auto` | équipe (contrôle dans le service) · owner | 649 |
| POST | `/staff/owner/incidents/check` | équipe (contrôle dans le service) · owner | 650 |
| GET | `/staff/owner/backups` | équipe (contrôle dans le service) · owner | 651 |
| POST | `/staff/owner/backups/:id/verify` | équipe (contrôle dans le service) · owner | 652 |
| POST | `/staff/owner/backups` | équipe (contrôle dans le service) · owner | 653 |
| GET | `/staff/owner/settings` | équipe (contrôle dans le service) · owner | 654 |
| PUT | `/staff/owner/settings` | équipe (contrôle dans le service) · owner | 655 |
| PUT | `/staff/owner/campaigns/:id` | équipe (contrôle dans le service) · owner | 656 |
| POST | `/staff/owner/campaigns/:id/status` | équipe (contrôle dans le service) · owner | 657 |
| GET | `/staff/owner/marketing` | équipe (contrôle dans le service) · owner | 658 |
| POST | `/staff/owner/campaigns` | équipe (contrôle dans le service) · owner | 659 |
| GET | `/staff/owner/monitoring` | équipe (contrôle dans le service) · owner | 660 |
| GET | `/staff/owner/health` | équipe (contrôle dans le service) · owner | 661 |
| GET | `/staff/owner/agencies` | équipe (contrôle dans le service) · owner | 662 |
| GET | `/staff/owner/listings.csv` | équipe (contrôle dans le service) · owner | 663 |
| GET | `/staff/owner/export.csv` | équipe (contrôle dans le service) · owner | 669 |
| GET | `/staff/stats/overview` | équipe (contrôle dans le service) | 675 |
| GET | `/staff/stats/rankings` | équipe (contrôle dans le service) | 679 |
| GET | `/staff/stats/advertisers/:id` | équipe (contrôle dans le service) | 683 |
| GET | `/staff/stats/compare` | équipe (contrôle dans le service) | 687 |
| POST | `/staff/stats/weights` | équipe (contrôle dans le service) | 691 |
| GET | `/staff/accounts` | équipe (contrôle dans le service) | 697 |
| POST | `/staff/listings/:id/decision` | équipe (contrôle dans le service) | 699 |
| POST | `/staff/listings/:id/feature` | équipe (contrôle dans le service) | 706 |
| POST | `/staff/reports/:id/dismiss` | équipe (contrôle dans le service) | 709 |
| POST | `/staff/comments/:id/hide` | équipe (contrôle dans le service) | 712 |
| POST | `/staff/accounts/:id/status` | équipe (contrôle dans le service) | 718 |
| POST | `/staff/accounts/:id/role` | équipe (contrôle dans le service) | 723 |
| GET | `/staff/trust` | équipe (contrôle dans le service) | 727 |
| GET | `/staff/proofs/:id/file` | équipe (contrôle dans le service) | 732 |
| POST | `/staff/proofs/:id/decision` | équipe (contrôle dans le service) | 733 |
| POST | `/staff/badges/revoke` | équipe (contrôle dans le service) | 740 |
| POST | `/staff/alerts/:id/close` | équipe (contrôle dans le service) | 742 |
| POST | `/staff/profiles/:id/images` | équipe (contrôle dans le service) | 743 |
| POST | `/staff/user-reports/:id/dismiss` | équipe (contrôle dans le service) | 744 |
| POST | `/staff/comments/:id/dismiss-reports` | équipe (contrôle dans le service) | 745 |
| GET | `/staff/blacklist` | équipe (contrôle dans le service) | 746 |
| POST | `/staff/blacklist` | équipe (contrôle dans le service) | 747 |
| POST | `/staff/blacklist/:id/remove` | équipe (contrôle dans le service) | 749 |

## 6. Migrations et retours arrière

| Migration | Retour arrière |
|---|---|
| `001_utilisateurs.sql` | **non** |
| `002_annonces.sql` | **non** |
| `003_engagement.sql` | **non** |
| `004_securite.sql` | **non** |
| `005_recherche.sql` | **non** |
| `006_confiance.sql` | **non** |
| `007_engagement.sql` | **non** |
| `008_paiements.sql` | **non** |
| `009_stored_files.sql` | **non** |
| `010_media_index.sql` | **non** |
| `011_listing_drafts.sql` | **non** |
| `012_price_history.sql` | **non** |
| `013_alert_digest.sql` | **non** |
| `014_user_blocks_reports.sql` | **non** |
| `015_payment_refunds.sql` | **non** |
| `016_consentement_droits.sql` | **non** |
| `017_avis_annonceur.sql` | **non** |
| `018_reponse_avis.sql` | **non** |
| `019_fournisseurs.sql` | **non** |
| `020_listing_geo.sql` | oui |
| `021_pays_parametres.sql` | oui |
| `022_audit_admin.sql` | oui |
| `023_evenements_sessions.sql` | oui |
| `024_agregats_controles.sql` | oui |
| `025_permissions.sql` | oui |
| `026_profil_public.sql` | oui |
| `027_consentement_statistiques.sql` | oui |
| `028_homepage_settings.sql` | oui |
| `029_owner_control.sql` | **non** |
| `030_marketing.sql` | **non** |
| `031_crm_pipeline.sql` | **non** |
| `032_offers_backup.sql` | **non** |
| `033_complaints_alerts.sql` | **non** |
| `034_logo_newsletter.sql` | **non** |
| `035_categories_trends.sql` | **non** |
| `036_languages_redirects.sql` | **non** |
| `037_auto_backup_alerts.sql` | **non** |
| `038_complaints_workflow.sql` | **non** |
| `039_backup_reel_newsletter.sql` | oui |
| `040_complaint_comment_visibility.sql` | oui |
| `041_campaigns_sponsored.sql` | **non** |
| `042_owner_activity.sql` | oui |
| `043_premium_annonceurs.sql` | oui |
| `044_premium_paiement.sql` | oui |
| `045_suivi_premium.sql` | oui |
| `046_sidebar_ads.sql` | **non** |
| `047_profil_enrichi.sql` | **non** |
| `048_response_rate_index.sql` | **non** |
| `049_advertiser_applications.sql` | **non** |
| `050_application_documents_retention.sql` | oui |
| `051_application_documents_reminder.sql` | oui |
| `052_categories_commercial_bureau.sql` | **non** |
| `053_profil_ville.sql` | **non** |
| `054_abonnes_anonymes.sql` | **non** |
| `055_mot_de_passe_oublie.sql` | **non** |
| `056_equipes.sql` | **non** |
| `057_partners.sql` | **non** |
| `058_quartiers_pays.sql` | oui |

18 / 58 migrations ont un script de retour arrière (BUG-002).

## 7. Variables d'environnement lues (`server/config.js`)

`ALLOW_DEMO_OTP`, `ANALYTICS_ENABLED`, `BACKUP_DIR`, `BACKUP_KEEP`, `BOOTSTRAP_ADMIN`, `BOOTSTRAP_ADMIN_EMAIL`, `BREVO_API_KEY`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `DATABASE_URL`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_PROVIDER`, `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_FROM`, `MAPBOX_TOKEN`, `NODE_ENV`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_MODE`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYMENT_CHANNELS`, `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `PORT`, `PUBLIC_URL`, `RESEND_API_KEY`, `SMS_PROVIDER`, `TRUST_PROXY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
