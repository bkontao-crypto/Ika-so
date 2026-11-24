# Registre des cookies, du stockage local et des prestataires — lot C

Établi le 19 novembre 2026 **d'après la lecture du code** (branche `main`, commit `1e04795`). Ce registre décrit ce que le code peut faire ; il ne prouve pas ce qui est activé en production (variables Render non vérifiées ici). Texte non validé par un juriste (`LEGAL_VALIDATED=false`).

## 1. Cookies (posés par notre serveur)
| Nom | Rôle | Durée | Attributs | Catégorie |
|---|---|---|---|---|
| `ika_session` | Garde la personne connectée | 30 jours | HttpOnly, SameSite=Lax, Path=/, Secure en production | Nécessaire (pas de consentement) |
| `ika_oauth` | Contrôle anti-falsification pendant la connexion Google | 10 minutes | HttpOnly, SameSite=Lax, Path=/api/auth/google, Secure en production ; effacé à la fin | Nécessaire, posé seulement si la personne clique sur « Google » |

Aucun cookie de mesure d'audience, de publicité ou de visiteur. `visitor_id` et `session_id` des événements restent nuls.

## 2. Stockage dans l'appareil (navigateur)
| Clé | Contenu | Durée | Déclencheur | Catégorie |
|---|---|---|---|---|
| `ika-so-consent` | Choix du panneau « Gérer mes choix » (version, catégories acceptées, dates) | 183 jours | Enregistrement du choix | Mémorisation du choix |
| `ika-so-draft:<id compte>` | Brouillon d'annonce du compte connecté | Jusqu'à publication ou effacement | Saisie dans le formulaire | Fonctionnel (demandé par la personne) |
| `ika-so-draft` (ancien) | Ancien brouillon sans compte : rangé au compte qui se déconnecte, sinon retiré | — | Migration | Fonctionnel |
| `ika_theme` | `light` ou `dark` | Sans expiration | Clic sur le bouton de thème | Préférence demandée par la personne |
| `ika-owner-theme` | Thème de l'espace propriétaire | Sans expiration | Clic sur le bouton de thème | Préférence (administration) |
| `ika-so-prefs`, `ika_theme` | Préférences d'affichage : thème, derniers filtres de recherche, mode d'affichage, filtre de Découvrir | Tant que « Préférences » est accepté (service activé dans l'Owner center) | Confort | « Préférences » ; effacé au retrait du choix |
| `_fbp`, `_ga*`, `_gcl*`, `ttp` (posés par les prestataires) | Mesure de campagnes et publicité ciblée | Selon le prestataire | Marketing | « Marketing » ; retrait = rechargement de la page, plus aucun pixel chargé ; les cookies déjà posés se suppriment depuis les réglages du navigateur |
| `mapbox*` | Données de la bibliothèque Mapbox | Tant que « Cartes » est accepté | Chargement de la carte Mapbox | « Cartes et services externes » ; effacé au retrait du choix |
| Cache du service worker (`ika-so-…`) | Fichiers publics du site et lectures publiques d'annonces pour le hors connexion | Jusqu'à la version suivante | Installation du site | Fonctionnel ; rien de privé (comptes, messages) |

À faire valider par un juriste : le thème est enregistré sans consentement car la personne le choisit elle-même ; la catégorie « Préférences » du panneau n'est utilisée par aucun service (case désactivée).

## 3. Mesure d'audience (lot B)
- `POST /api/e` (page vue) n'est envoyé que si « Statistiques » est accepté ; le serveur ne reçoit que le chemin de la page, sans identifiant ni cookie.
- Les événements métier côté serveur (vue de fiche, contact, etc.) n'ont aucun identifiant visiteur ; leur base juridique reste à valider (dossier `dossier-activation-statistiques.md`).

## 4. Prestataires et services tiers
| Service | Rôle | Quand des données partent | Données concernées | État |
|---|---|---|---|---|
| Mapbox (États-Unis) : `api.mapbox.com`, `events.mapbox.com` | Fond de carte | Seulement après accord « Cartes et services externes » ; bibliothèque hébergée chez nous (`/vendor`) | Adresse IP, tuiles demandées, télémétrie de la bibliothèque | Jeton `MAPBOX_TOKEN` sur Render : non vérifié |
| Google : `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com` | Connexion par compte Google | Au clic sur « Google » (échange côté serveur) | Identité Google (adresse e-mail, nom, identifiant) | Activé seulement si les identifiants sont configurés : non vérifié |
| WhatsApp : `wa.me` | Contacter un annonceur | Au clic ; ouverture dans un nouvel onglet (`noopener`) | Numéro de l'annonceur, texte du message préparé | Actif (lien) |
| Infobip ou Twilio | SMS de vérification des numéros | À la demande de vérification, côté serveur | Numéro de téléphone, code | Choix du fournisseur non fait (`docs/fournisseurs.md`) |
| CinetPay ou PayDunya | Paiement mobile money | Au paiement, côté serveur | Montant, référence ; jamais de numéro de carte | Éteint tant que `PAYMENT_PROVIDER` est vide |
| Brevo ou Resend | Alertes e-mail facultatives | Côté serveur | Adresse e-mail, contenu de l'alerte | Éteint par défaut |
| Webhook d'erreurs (`ERROR_WEBHOOK_URL`) | Suivi d'erreurs | Côté serveur | Erreur serveur en JSON | Facultatif, éteint par défaut |
| Render (hébergeur) | Hébergement du site et de l'API | Toujours | Tout le trafic ; l'hébergeur peut conserver des adresses IP | À préciser (pays, durée) |

Polices et bibliothèques : hébergées chez nous (`/fonts`, `/vendor`), aucun CDN.
| Meta Platforms (États-Unis) : `connect.facebook.net`, `www.facebook.com` | Pixel Meta : pages vues et inscription | Seulement après accord « Marketing » ET service activé dans l'Owner center | Adresse IP, page, identifiant publicitaire, événement d'inscription | Éteint par défaut ; identifiant du pixel à saisir |
| Google (États-Unis) : `www.googletagmanager.com`, `*.google-analytics.com`, `*.doubleclick.net` | Balise Google Ads | Idem | Idem | Éteint par défaut |
| TikTok (Singapour / États-Unis) : `analytics.tiktok.com` | Pixel TikTok | Idem | Idem | Éteint par défaut |

Les adresses d'un prestataire ne sont ouvertes dans la politique de sécurité (CSP) que tant que son service est activé.

## 5. Points ouverts
- Valider ce registre et la politique par un juriste malien ; formalités APDP et transferts hors du Mali (voir `note-cadre-juridique-mali.md`).
- Confirmer sur Render quels prestataires sont réellement activés, puis mettre à jour la colonne « État ».
- Le lien « Gérer mes choix » est présent sur les pages rendues côté serveur (quartiers, guides, agences, annonces) ; `/mentions-legales` et la fiche imprimable ne l'ont pas.
- Avant d'activer un pixel Marketing : mentionner le prestataire et le transfert hors du Mali dans la politique de confidentialité, et faire valider par le juriste.
- Lot D (preuve de consentement côté serveur) : seulement si le juriste l'exige.
