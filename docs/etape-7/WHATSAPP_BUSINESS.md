# Intégration WhatsApp Business Cloud API (E07)

## Prérequis Meta
1. Compte Meta Business vérifié.
2. Application Meta avec le produit WhatsApp.
3. Numéro de téléphone WhatsApp Business (Cloud API).
4. Jeton d'accès permanent (System User).
5. Token de vérification du webhook.

## Configuration (variables d'environnement / config)
```js
whatsapp: {
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  apiVersion: "v21.0"
}
```

## Endpoints livrés
| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/webhooks/whatsapp` | Vérification du webhook Meta |
| POST | `/webhooks/whatsapp` | Réception des messages entrants |
| POST | `/me/crm/leads/:id/whatsapp` | Envoi d'un message texte au téléphone du lead |

## Utilisation depuis le CRM
```json
POST /me/crm/leads/{id}/whatsapp
{ "text": "Bonjour, je suis disponible pour une visite demain." }
```
- Le message est envoyé via l'API Cloud.
- Une note est ajoutée automatiquement sur le lead.

## Prochaines évolutions possibles
- Templates approuvés (messages hors fenêtre 24 h).
- Mapping automatique numéro → lead existant.
- Réponses entrantes qui mettent à jour le statut du lead.
- Médias (images, documents).

**Statut** : couche d'intégration prête. Nécessite les jetons Meta pour être active.
