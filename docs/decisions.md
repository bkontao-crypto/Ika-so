# Journal des décisions

## Prises le 1er novembre 2026 (sur instruction du propriétaire)
1. **Retour à la pile de l'ordonnance** : Node.js + Express + PostgreSQL + CSS. React, Tailwind, TanStack et Better Auth sont retirés.
2. **Aucune marque tierce** : plus de script ni de bannière d'une plateforme externe, plus de connexion Google/X via un courtier tiers.
3. **Connexion** : un seul mode, e-mail et mot de passe (haché scrypt), session par cookie opaque. Le numéro de téléphone est vérifié par code SMS au moment de publier.

## Décisions prises par défaut, à confirmer
- Palette : vert profond #0f3f22 / #166534, or #b45309, crème #fdf8f6 (valeurs du prototype ; le terracotta de l'ancienne version est abandonné pour suivre l'ordonnance).
- Police : pile système (Inter n'a pas pu être embarquée ici). À héberger localement avant le pilote.
- Premier administrateur : désactivé par défaut en production ; exige `BOOTSTRAP_ADMIN_EMAIL`.
- Contact (appel, WhatsApp) : réservé aux comptes connectés, pour être compté et limité.
- Migrations renumérotées `001` à `004` (base neuve). Aucune base de production n'existait.

## Décisions encore attendues (section 11 de l'ordonnance)
Fournisseur SMS définitif ; stockage des photos (aujourd'hui en base, 450 Ko max) ; hébergeur et domaine ; pièces demandées aux agences ; tarifs ; quartiers prioritaires ; politique de confidentialité et conditions (juriste malien).

## Corrections de l'audit du 2 novembre 2026 (F-01 à F-09)
- **Personnel RESTRICTED (F-06)** : décision appliquée par défaut, réversible — un membre du personnel dont le compte est restreint perd ses droits de modération tant que la restriction dure (`requireStaff`). ⛔ À confirmer par le propriétaire.
- **Dernier super administrateur** : les changements de rôle sont sérialisés (verrou) et refusés s'ils ne laissent aucun super administrateur actif.
- **Premier administrateur** : le serveur refuse de démarrer sans `NODE_ENV` (production ou development) ; le compte propriétaire doit être créé dès le premier démarrage, puis `BOOTSTRAP_ADMIN` retiré.
- **Webhook de paiement** : événement et traitement dans une seule transaction ; un échec n'est plus retenu comme « déjà vu ».
- **Plafond « à la une »** : contrôlé sous verrou ; un paiement en attente (moins de 30 min) réserve une place.
- **Migration 009** : décodage tolérant, valeurs d'origine conservées dans des colonnes `legacy_*`.
- **TRUST_PROXY** : nombre de sauts (1 sur Render) ; « true » reste accepté mais signalé dans les journaux.
- **Dépendances** : versions exactes ; `npm ci` dans Docker et CI, qui exigent `package-lock.json`.

## Brouillons côté serveur (2 novembre 2026)
- **Table séparée `ika_listing_drafts`** plutôt que le statut `DRAFT` de `ika_listings` : un brouillon incomplet (prix vide, aucune photo) violerait les contraintes de l'annonce et risquerait d'apparaître en modération ou en recherche.
- **Un seul brouillon par compte** (« nouvelle annonce »). La modification d'une annonce existante ne passe pas par ce mécanisme.
- **Photos** : seules les images du site (`/media/…`) sont gardées, comme sur l'appareil ; les photos envoyées ne sont pas stockées dans le brouillon.
- **Conflit appareil / serveur** : la copie la plus récente gagne ; si l'appareil est plus récent, il est renvoyé au serveur. Hors connexion, la copie de l'appareil continue de fonctionner.
- **Suppression** : le brouillon est supprimé dans la même transaction que la création de l'annonce. Un compte supprimé emporte son brouillon (clé étrangère `on delete cascade`). Compte bloqué : refusé.

## Historique de prix (2 novembre 2026)
- **Un point par publication, pas par modification** : le point est écrit au moment où la modération approuve (même instruction SQL que la publication), seulement si le prix diffère du dernier point. Un prix saisi puis corrigé avant publication n'est jamais visible, et une modification sans changement de prix ne crée pas de doublon.
- **Affichage** : la fiche publique montre l'historique dès deux points, avec la variation en FCFA et en %. Rien n'est montré pour une annonce au prix inchangé.
- **Annonces existantes** : la migration 012 crée un point de départ (prix actuel, date de publication) pour chaque annonce publiée ; elle est rejouable sans doublon.

## Alertes groupées (2 novembre 2026)
- **Choix par compte, immédiat par défaut** : aucun comportement existant ne change tant que la personne ne choisit pas « un résumé par jour ».
- **File d'attente en base** (`ika_alert_pending`, une ligne par personne et par annonce) plutôt qu'un calcul à l'envoi : rien n'est perdu si le serveur redémarre.
- **Envoi** : minuterie interne toutes les 15 minutes, verrou en base (une seule instance envoie), un résumé par compte au plus toutes les 23 h. Lignes retirées de la file et notification créée dans la même transaction. Le résumé n'inclut que les annonces encore en ligne à ce moment.
- **Heure fixe non retenue** : demanderait un fuseau et une heure par compte ; à rouvrir si le propriétaire le souhaite (⛔ à confirmer).
- **Retour à l'immédiat** : les annonces en attente sont livrées sur-le-champ.
- **Canaux externes** (SMS, e-mail, WhatsApp) : le résumé passe par `ctx.notifiers`, après validation de la transaction, comme les autres notifications.

## Blocage et signalement d'une personne (2 novembre 2026)
- **Blocage par personne, déclenché depuis une conversation** : plus aucun message ni demande de visite entre les deux personnes, dans les deux sens. Le message d'erreur de la personne bloquée reste neutre (« n'a pas pu être envoyé ») pour ne pas attiser un conflit ; celui de la personne qui a bloqué lui dit comment débloquer.
- **Confidentialité du signalement** : la modération ne lit jamais la conversation entière. Elle reçoit seulement les 10 derniers messages, tronqués à 300 caractères, copiés au moment du signalement.
- **Un signalement ouvert par couple signalant / signalé** ; la file de modération regroupe par personne signalée, la plus signalée d'abord. « Écarter » clôt tous les signalements ouverts de cette personne et laisse une trace au journal. La sanction passe par l'onglet Comptes existant (aucune sanction automatique).
- **Limite assumée** : le numéro d'une annonce publiée reste affichable pour tout compte connecté ; le blocage ne concerne que la messagerie et les visites.

## Remboursements : idempotence, rapprochement, expiration (2 novembre 2026)
- **Idempotence** : le paiement est verrouillé avant le changement ; noter deux fois le même remboursement renvoie `alreadyRefunded` sans second effet ni second journal. Un paiement non confirmé ne peut pas être remboursé (409).
- **Jours retirés = jours du paiement** : on retire de `featured_until` la durée de CE paiement (et non plus toute la mise à la une), seulement s'il avait été appliqué. Un autre paiement valide sur la même annonce garde ses jours.
- **Deux sources de vérité, un seul état** : l'administrateur note le remboursement (état « à confirmer ») ; l'événement `REFUNDED` du fournisseur le confirme (`refund_confirmed_at`, `refund_ref`). Si le fournisseur rembourse seul, l'événement suffit à passer le paiement en REFUNDED. Même événement rejoué : sans effet (table des événements).
- **Remboursements partiels non gérés** : un événement au montant différent ne modifie rien et laisse une trace `PAYMENT_REFUND_PARTIAL` au journal, à traiter à la main. ⛔ À décider avec le fournisseur retenu.
- **Expiration à 24 h** : statut `EXPIRED` (texte libre, aucune contrainte à changer). Une confirmation de paiement tardive passe quand même le paiement en PAID : l'argent reçu est toujours honoré. Les réservations de place « à la une » (30 min) ne changent pas.
- **Toujours manuel côté fournisseur** : Ika So ne déclenche aucun remboursement réel ; l'écran dit clairement « noter » après avoir rendu l'argent chez le fournisseur.

## Décisions prises pour le propriétaire — 3 novembre 2026 (lot 13, révisables)
Le propriétaire a demandé de prendre à sa place les décisions factuelles. Elles ne touchent ni au choix du fournisseur, ni aux tarifs, ni à la structure juridique, qui restent ⛔.
- **Fournisseurs** : tout le code est posé (SMS Twilio/Infobip, paiement CinetPay/PayDunya, e-mail Brevo/Resend) et **éteint** tant que ses clés sont vides. Une activation = poser les variables de `docs/fournisseurs.md`, rien à recoder.
- **Âge minimal : 18 ans**, confirmé par la case d'inscription (adaptée à la loi : contrats immobiliers).
- **Conservation** (`server/lib/retention.js`) : codes SMS 7 j ; pièces justificatives effacées 90 j après décision ; notifications 180 j/365 j ; conversations 24 mois ; annonces closes 12 mois ; journal d'équipe 36 mois ; factures 10 ans ; comptes inactifs signalés, jamais supprimés seuls. Commande manuelle, simulation par défaut.
- **Alertes e-mail/SMS** : sur consentement de chaque personne, sans texte privé, plafonds 1 e-mail/heure et 5 SMS/jour.
- **Sécurité des paiements** : une notification n'est jamais crue ; confirmation auprès du fournisseur ; HTTPS obligatoire pour un agrégateur réel.
- **Limite assumée** : adaptateurs jamais lancés contre un vrai service ; durées à faire valider par un juriste malien.
