# Fournisseurs tiers — code prêt, tout est ÉTEINT par défaut

Le code de chaque fournisseur est écrit et testé **avec un faux réseau**. **Aucun n'a jamais été lancé contre le vrai service** : les adaptateurs sont écrits d'après la documentation publique de chaque fournisseur, qui peut avoir changé. Le premier essai réel (bac à sable) est donc obligatoire avant toute mise en service. Tant que les variables ci-dessous sont vides, rien ne part vers l'extérieur.

Contrôle avant tout changement : `npm run check-env` (bloquant / attention, n'affiche aucun secret).

## 1. SMS (codes de vérification des numéros) — ⛔ fournisseur à choisir
| Choix | Variables |
|---|---|
| Twilio | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Infobip | `SMS_PROVIDER=infobip`, `INFOBIP_BASE_URL` (https), `INFOBIP_API_KEY`, `INFOBIP_FROM` |

Sans SMS : personne ne peut vérifier son numéro, donc personne ne peut publier. Premier essai : votre propre numéro, puis vérifier le code reçu.

### Mise en place d'Infobip (compte d'essai)
1. Portail Infobip › Guide › SMS : repérer **l'URL de base de l'API** (de la forme `xxxx.api.infobip.com`, le `https://` est ajouté tout seul si vous l'omettez) et créer/copier la **clé API** (Gérer les clés API).
2. Sur Render › Environment, créer **sans jamais les écrire dans un fichier du projet ni dans une conversation** : `SMS_PROVIDER=infobip`, `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_FROM`.
3. `INFOBIP_FROM` : l'expéditeur. En essai, utiliser l'expéditeur de test indiqué par le portail ; pour un nom propre (ex. `IkaSo`) au Mali, vérifier dans le portail s'il doit être enregistré auprès des opérateurs.
4. Compte d'essai : **10 SMS gratuits**, et en général seulement vers le numéro enregistré sur le compte Infobip. Tester avec ce numéro (format international, +223…).
5. `npm run check-env` doit ne plus signaler `SMS_INCONNU` ni `INFOBIP_HTTPS`, puis redéployer. Au démarrage, le journal ne doit plus afficher `sms_non_configure`.
6. Essai : sur le site, ajouter votre numéro dans Mon profil, recevoir le code, le saisir. Aucune clé ne doit apparaître dans le journal.
7. Avant le lancement public : ajouter des fonds au compte (l'essai dure 60 jours et limite l'envoi).

## 2. Paiement mobile money — ⛔ agrégateur et tarifs à choisir
| Choix | Variables |
|---|---|
| CinetPay | `PAYMENT_PROVIDER=cinetpay`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` |
| PayDunya | `PAYMENT_PROVIDER=paydunya`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYDUNYA_MODE=test` (puis `live`) |

Option : `PAYMENT_CHANNELS` (défaut `MOBILE_MONEY`). `PUBLIC_URL` doit être en **https** (adresse de notification et de retour).
Sécurité : une notification reçue n'est **jamais crue telle quelle** ; le serveur interroge le fournisseur pour confirmer l'état et le montant. Notification rejouée = sans effet. Montant différent = rien n'est activé.
Étapes du premier essai : 1) bac à sable, 2) Administration › offres : fixer un prix et activer (les offres sont créées inactives à 0), 3) acheter une mise à la une avec un petit montant, 4) vérifier la facture et le rapprochement, 5) seulement ensuite le mode réel.
`PAYMENT_PROVIDER=fake` est refusé en production.

## 3. E-mail (alertes facultatives) — ⛔ fournisseur à choisir
`EMAIL_PROVIDER=brevo` + `BREVO_API_KEY`, ou `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` ; dans les deux cas `EMAIL_FROM` (adresse d'expédition vérifiée chez le fournisseur) et `EMAIL_FROM_NAME`.

## 4. Suivi d'erreurs — facultatif
`ERROR_WEBHOOK_URL=https://…` reçoit chaque erreur serveur en JSON.

## Règles d'alertes (décidées pour vous, valables dès l'activation)
- **Chaque personne choisit** (Mon profil › alertes) : rien n'est envoyé sans son accord ; la date du consentement est gardée ; un canal non disponible ne peut pas être activé.
- **Jamais le texte d'un message privé** par e-mail ou SMS : seulement « vous avez un nouveau message », avec le moyen de se désinscrire.
- **E-mail** : 1 par heure au plus, par personne et par type. **SMS** : 5 par jour au plus, seulement pour les messages et les visites, seulement vers un numéro vérifié par SMS.
- Un échec du fournisseur ne bloque jamais l'envoi d'un message dans l'application.

## Conservation des données
`node scripts/retention.mjs` (simulation, ne supprime rien) puis `node scripts/retention.mjs --apply --confirm=PURGER` après sauvegarde. Jamais automatique. Durées : `server/lib/retention.js`.

## Pas encore codé (volontairement)
Web Push · WhatsApp Business · messages vocaux et photos dans la messagerie · temps réel par connexion permanente.
