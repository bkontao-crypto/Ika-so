# Reçu / confirmation de paiement structuré (E08)

## Endpoint existant
`GET /me/payments/:id/invoice` — déjà présent.

## Enrichissement proposé
Le reçu (email ou JSON) contient :
- Référence de paiement
- Montant (XOF)
- Offre (mise en avant / Premium)
- Date
- Statut
- Lien vers la facture

## Notification
Après webhook réussi, le notifier envoie :
- Sujet : « Paiement confirmé — Ika So »
- Corps : montant, offre, référence, lien facture

**Statut** : squelette documenté. Le notifier existant peut être étendu pour formater ce reçu.
