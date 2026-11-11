# Phase 4 — Engagement (rapport)

Voir `SUIVI.md` pour l'état détaillé. 1er novembre 2026.

## Fait
Recherches enregistrées et alertes immédiates · boîte (alertes, messages, visites) · messagerie interne · demandes de visite · notifications d'approbation et de refus · hors connexion léger (service worker) · migration 007.

## Testé, et comment
`test/engagement.test.js` (8 tests, PostgreSQL réel) : correspondance des recherches, une alerte par annonce, pas d'auto-alerte, comptes bannis exclus, fils de messages et non-lus, accès réservé aux deux personnes, comptes restreints refusés, règles de visite, branchement de canaux et panne d'un canal.
Navigateur réel (Chromium, téléphone émulé) : enregistrer une recherche, publier et approuver, alerte reçue en 2,1 s, écrire à l'annonceur, demander puis accepter une visite, couper le réseau : le site et les annonces s'affichent encore, les messages privés ne sont pas servis.
`test/budget.test.js` : tous les fichiers du site sont dans la liste du service worker, aucune route privée n'est gardée.

## Non vérifié
Push, WhatsApp, SMS, e-mail (aucun canal branché) · service worker sur un vrai téléphone d'entrée de gamme · mise à jour du cache après déploiement · charge (5 000 recherches parcourues à chaque approbation : suffisant pour le pilote, à revoir au-delà).

## Risques
Messagerie : risque d'arnaque par message (rappel d'acompte affiché, pas de pièce jointe, signalement d'utilisateur à ajouter). Le cache hors ligne montre des annonces qui ont pu être retirées depuis.

## Décisions attendues
Canaux de notification à brancher en premier · fournisseurs · règles de la messagerie (durée de conservation, signalement d'un utilisateur).
