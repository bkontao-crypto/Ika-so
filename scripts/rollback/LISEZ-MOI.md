# Retours arrière des migrations

Un script `NNN_nom_down.sql` annule la migration `migrations/NNN_nom.sql`. **Ils ne sont jamais lancés automatiquement** (ni par `npm run migrate`, ni au démarrage de Render).

## Avant de lancer
1. **Sauvegarde** : créer une branche Neon (point de retour instantané) ou exporter les tables concernées. Chaque script indique en tête ce qu'il supprime.
2. Retirer d'abord le code qui utilise les tables ou colonnes concernées (ou revenir à la version précédente du site), sinon l'application affichera des erreurs.

## Lancer
Du **plus récent au plus ancien** (un script ne doit pas être lancé tant que les migrations plus récentes qui en dépendent sont en place) :

```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/065_permissions_contenu_offres_owner_down.sql
```

- Chaque script est une transaction : en cas d'erreur, **rien n'est modifié**.
- Il efface aussi sa ligne dans `_migrations`, donc `npm run migrate` peut le rejouer ensuite.
- Aucun script n'utilise `cascade` : une dépendance inattendue fait échouer le script au lieu de supprimer d'autres données.

## Scripts qui refusent volontairement
| Script | Échoue s'il existe… | À faire avant |
|---|---|---|
| 038 | des signalements en `IN_PROGRESS`, `RESOLVED` ou `CLOSED` | les clôturer ou les rouvrir |
| 046 | des campagnes de type `SIDEBAR` | les supprimer |
| 052 | des annonces « Local commercial » ou « Bureau » | les recatégoriser |

## Migrations sans script (volontaire)
- **001 à 015** : socle (utilisateurs, annonces, paiements…). Les supprimer détruirait les données principales.
- **016** : consentement et droits ; contient le nom du client sur les factures (obligation comptable) et l'état des suppressions de compte.

Pour ces migrations, le seul retour sûr est la **restauration d'une sauvegarde**.

## Comment c'est vérifié
- `test/rollback-scripts.test.js` (sans base) : toute migration à partir de 017 doit avoir son script, qui doit effacer sa ligne `_migrations`, ne pas utiliser `cascade`, et être transactionnel.
- Essai sur un vrai PostgreSQL (BUG-002, voir `Important/SUIVI.md`) : après chaque script de 065 à 017, schéma **et** données identiques à l'état précédent ; puis rejeu des migrations 017 à 065 : état final identique.
