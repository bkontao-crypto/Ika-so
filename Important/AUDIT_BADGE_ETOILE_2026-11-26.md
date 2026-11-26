# Suivi — Audit du badge Étoile, du paiement à l'affichage (26 novembre 2026)

Format de suivi des règles de travail du projet (à réaliser / réalisé / vérifié / en cours / à faire / risques).
`Important/SUIVI.md` (391 Ko) est trop volumineux pour une mise à jour à distance : cette fiche est à y fusionner par un agent qui travaille sur un dépôt cloné.

## À réaliser
Auditer le parcours complet du badge Étoile : demande, paiement, traitement, obtention et affichage dans le profil. Lecture seule, aucune modification de code.

## Réalisé
Lecture de : `server/services/star-badge.js`, `server/lib/star-badge-policy.js`, `server/services/payments.js`, `migrations/044`, `088`, `089`, routes `/star-badge/*` et `/staff/star-badge-*` (extraits de `server/routes/index.js`), `public/js/components/star-badge-form.js`, `public/js/pages/mon-profil.js`, présence des tests `test/star-badge.test.js` et `test/star-badge-pg.test.js`.

## Vérifié
Rien n'a été exécuté : pas de test lancé, pas d'appel au site, pas de lecture de la base de production. Les constats ci-dessous viennent de la lecture du code uniquement.

## Constats (à numéroter dans le registre BUG / DEC du classeur de suivi)

| Réf. provisoire | Type | Constat | Gravité |
|---|---|---|---|
| ÉTOILE-1 | Fonction absente | Aucun paiement Étoile : `payments.js` ne gère que `PREMIUM` et `BOOST` (contraintes de la migration 044 comprises). Rien n'écrit `ika_star_requests.paid`. | Élevée |
| ÉTOILE-2 | Piège de configuration | Si « paiement exigé » est activé, toute approbation échoue (409) sans issue. Le prix s'affiche sans bouton de paiement. | Élevée |
| ÉTOILE-3 | Fonction partielle | L'étoile n'est visible que dans les paramètres du titulaire ; aucune requête du serveur (profil public, annonces) ne renvoie le statut, malgré le texte « sur votre profil et vos annonces ». | Élevée |
| ÉTOILE-4 | Risque données personnelles | Conservation des pièces d'identité sans limite par défaut (`retentionDays = 0`) ; effacement et rappels seulement par « sweep » manuel, sans minuterie. | Moyenne |
| ÉTOILE-5 | Traçabilité | Les erreurs d'écriture du journal d'audit sont avalées (`.catch(() => {})`) et l'écriture est hors transaction : une décision peut passer sans trace. | Moyenne |
| ÉTOILE-6 | Décision à arbitrer | Aucune séparation des rôles : la même personne peut valider les 3 étapes puis décider. | À arbitrer |
| ÉTOILE-7 | Contrôle serveur | Un dossier de renouvellement peut être créé avant la fenêtre des 30 jours (seule l'interface le bloque). | Faible |

Points qui fonctionnent (par lecture du code) : dépôt des pièces, envoi, étude en 3 étapes, décision motivée, validité cumulée, retrait, notifications, lecture des pièces tracée, accès réservé au personnel.

## Non vérifié (limites de l'audit)
`parseProofFile` (taille et types de fichiers, `server/lib/trust.js`) ; règle d'accès `requireOwnerGate("trust")` ; comportement réel sur le site ; réglages actuels du badge en base ; exécution des tests existants.

## En cours
Rien (audit terminé, aucune correction commencée).

## À faire (ordre proposé, après validation du propriétaire)
1. Paiement `STAR` (migration additive des contraintes, webhook qui marque le dossier payé) ; garder « paiement exigé » désactivé d'ici là.
2. Affichage public de l'étoile (profil public et annonces), sans dépendre du traitement manuel.
3. Durée de conservation par défaut et minuterie d'effacement.
4. Journal d'audit dans la même transaction que la décision.
5. Contrôle serveur de la fenêtre de renouvellement.

## Décisions demandées au propriétaire (règle : pas de décision métier à sa place)
- Séparation des rôles pour la décision (ÉTOILE-6).
- Durée de conservation des pièces, selon la loi en vigueur (ÉTOILE-4).
- Le badge doit-il être payant, à quel prix, et le paiement doit-il être obligatoire (ÉTOILE-1, -2) ?

## Risques
- Activer « paiement exigé » avant le branchement du paiement bloque tous les badges.
- Les pièces d'identité déjà déposées restent conservées tant qu'aucune durée n'est réglée.
