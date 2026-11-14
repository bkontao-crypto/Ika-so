# RAPPORT D'ÉTAPE 14 — Liaison optionnelle annonce ↔ bien (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.5 (en développement)  
**Base :** V1.4 (journalisation badges E13)

## 1. Objectif
Permettre de lier une annonce à un bien (DEC-004) de façon optionnelle lors de la création ou de la mise à jour.

## 2. Travaux réalisés
| Élément | Fichier | Action |
|---------|---------|--------|
| Méthode `linkListing` | `server/services/properties.js` | Ajoutée (vérifie propriété + update additive) |
| Création d'annonce | `POST /listings` | Accepte `propertyId` ou `property_id` et lie |
| Mise à jour d'annonce | `PUT /listings/:id` | Idem |
| Sécurité | Route | Vérifie que le bien appartient à l'utilisateur |

- La liaison est optionnelle et non bloquante.
- N'écrase pas une liaison existante différente (condition dans le SQL).
- Compatible avec l'onglet « Mes biens » et le détail déjà livrés.

## 3. Utilisation
```json
POST /listings
{
  "title": "...",
  "propertyId": "uuid-du-bien",
  ...
}
```

## 4. Prochaines actions proposées
- [ ] Exposer le choix du bien dans le formulaire de publication (frontend).
- [ ] Afficher le bien lié sur la fiche annonce.
- [ ] Filtres supplémentaires sur la vue audit (acteur, dates).
- [ ] Tests de non-régression sur la création d'annonce avec/sans bien.

## 5. Migrations
Aucune (utilise la colonne `property_id` déjà prévue dans l'esquisse DEC-004).

**E14 — avancement** : liaison optionnelle annonce ↔ bien opérationnelle côté serveur.
