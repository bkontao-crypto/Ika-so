# État des lieux — Notifications et paiements (E08)

## Notifications (existant)
- Préférences utilisateur : `GET/PUT /me/notify-prefs` (email, sms).
- Service `notifier` injectable (`sendEmail`, `sendSms` via Twilio).
- Événements déjà tracés : contacts, publications, etc.

## Paiements (existant)
- Offres : `GET /offers`
- Checkout : `POST /payments/checkout` (mise en avant, Premium)
- Webhook fournisseur : `POST /payments/webhook`
- Historique : `GET /me/payments`
- Facture : `GET /me/payments/:id/invoice`
- Admin : offres, rapprochement, remboursement

## Manques identifiés pour E08
- Notification explicite à l'utilisateur après paiement réussi.
- Canal WhatsApp dans les préférences de notification.
- Rappel de leads chauds / nouveaux leads.
- Reçu ou confirmation structurée.

## Prochain lot proposé
1. Notification (email + SMS si activé) après paiement réussi.
2. Ajout du canal WhatsApp dans les préférences.
3. Notification optionnelle sur nouveau lead CRM.
