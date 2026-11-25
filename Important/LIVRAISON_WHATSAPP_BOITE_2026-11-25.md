# Livraison — Boîte WhatsApp (25 novembre 2026)

Branche : `feature/whatsapp-boite` (depuis `main` au commit 137a688). Non fusionnée. Remplace la demande « interface de test et de gestion des messages WhatsApp ».

## Audit (ce qui existait déjà)
`server/services/whatsapp.js` (envoi texte et modèles, signature, lecture du webhook), `config.whatsapp` (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`) et le webhook GET/POST **`/api/webhooks/whatsapp`** dans `routes/index.js`. Il n'existait ni historique en base, ni routes d'envoi/lecture, ni page.

## Décisions
- Le webhook existant reste l'unique adresse chez Meta (**pas** de second `/api/whatsapp/webhook`). `server/app.js` y enregistre les messages (signature vérifiée) puis laisse le traitement habituel s'exécuter, inchangé.
- Table nommée `ika_whatsapp_messages` (préfixe du projet), avec en plus `error_text`, `sent_by`, `updated_at`.
- Accès : permission `contenu.gerer` (administrateurs et Superadmin), refus par défaut. Messages de tiers : réponses `Cache-Control: no-store`.
- `WHATSAPP_BUSINESS_ACCOUNT_ID` n'est pas lue : l'envoi n'en a pas besoin.

## Réalisé (écrit ; vérification = CI de la PR)
- `migrations/094_whatsapp_messages.sql` + `scripts/rollback/094_whatsapp_messages_down.sql`.
- `server/services/whatsapp-inbox.js` : enregistrement des messages reçus et des statuts (jamais en arrière), envoi, historique, erreur Meta expliquée (dont la fenêtre de 24 h).
- `server/routes/whatsapp-inbox.js` : `GET /api/whatsapp/status`, `GET /api/whatsapp/messages`, `POST /api/whatsapp/send` (20 envois par minute et par membre).
- `server/app.js`, `server/index.js` : branchement.
- `public/whatsapp.html`, `public/js/whatsapp-boot.js`, `public/js/pages/whatsapp.js` : page `/whatsapp` (envoi rapide, conversations, statuts, actualisation toutes les 8 s).
- `test/whatsapp-inbox-db.test.js` : envoi, refus Meta, signature, doublons, statuts, droits d'accès (aucun appel réel à Meta).

## Non fait / limites
- Aucun lien dans le menu administrateur : la page s'ouvre en tapant `/whatsapp`.
- Messages non texte enregistrés sous la forme `[image]`, `[audio]`… (pas de médias).
- Pas de durée de conservation ni d'export : à décider (données personnelles de tiers).
- Jamais testé avec les vrais serveurs de Meta : à faire après déploiement.

## Mise en service
1. Fusionner la PR (la migration 094 s'applique au déploiement).
2. Render : poser `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (aucune installation de dépendance ; « Save, rebuild and deploy »).
3. Meta (WhatsApp > Configuration) : URL de rappel `https://ika-so.onrender.com/api/webhooks/whatsapp`, jeton de vérification = `WHATSAPP_VERIFY_TOKEN`, abonnement au champ `messages`.
4. Se connecter avec un compte administrateur, ouvrir `/whatsapp`.
