# RAPPORT D'ÉTAPE 27 — WhatsApp prefs, notif leads, reçu, tests webhooks (E08) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 2.8 (en développement)  
**Base :** V2.7 (E08 lot 1)  
**Étape officielle :** E08 — Notifications et paiements

## 1. Objectif
Livrer en une fois les quatre points demandés.

## 2. Travaux réalisés
| Élément | Fichier | Statut |
|---------|---------|--------|
| Canal WhatsApp dans les prefs | `server/routes/index.js` (`PUT /me/notify-prefs`) | Ajouté |
| Notification nouveau / chaud lead | `server/routes/index.js` (`POST /me/crm/leads`) | Ajoutée |
| Reçu structuré | `docs/etape-8/RECU_PAIEMENT.md` | Documenté |
| Tests webhooks | `tests/payments-webhook.test.js` | Créés (squelette) |

## 3. Détails
- Préférences : `whatsapp: true/false` accepté en plus d'email et sms.
- Nouveau lead : notification « Nouveau lead » ou « Lead chaud » (si score ≥ 80) via email/SMS/WhatsApp.
- Reçu : structure documentée (référence, montant, offre, lien facture) ; s'appuie sur l'endpoint facture existant.
- Tests : cas signature invalide, succès → notification, préférence WhatsApp.

## 4. Prochaines actions proposées
- [ ] Formater réellement l'email de reçu dans le notifier.
- [ ] Brancher les tests sur le vrai handler de webhook.
- [ ] Notification de rappel pour leads chauds non traités.
- [ ] Interface des préférences avec case WhatsApp.

## 5. Migrations
Aucune.

**E08 lot 2 — avancement** : canal WhatsApp, notif leads, reçu documenté, tests squelette.
