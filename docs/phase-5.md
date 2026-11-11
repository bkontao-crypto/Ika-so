# Phase 5 — Monétisation (socle)

## Fait
Contrat de fournisseur de paiement, faux fournisseur de démonstration, offres (inactives, prix 0 par défaut), paiement avec confirmation signée, factures numérotées, rapprochement, remboursement noté. Interface : bouton « Mettre à la une », page « Paiements », onglet administrateur « Paiements ».

## Testé et comment
- `test/payments.test.js` (7 tests, PostgreSQL) : offre sans prix invendable, paiement complet, rejeu, signature fausse, montant différent, échec, réparation d'un paiement non appliqué, remboursement, paiements désactivés.
- Navigateur : 48/48 (dont tarif fixé, achat en attente, confirmation fausse refusée puis signée, facture).
- Sauvegarde et restauration réelles (`scripts/backup.sh`, `scripts/restore-check.sh`).

## Non vérifié
Tout vrai paiement mobile money ; le comportement d'un vrai agrégateur (délais, doublons, signatures) ; les mentions légales des factures.

## Risques
Écrire l'adaptateur du vrai fournisseur sans bac à sable. Un paiement confirmé après la suppression ou le retrait de l'annonce reste appliqué sur l'annonce (sans effet visible) : à traiter par le rapprochement.

## Décisions attendues (reportées par le propriétaire)
Agrégateur mobile money, tarifs, mentions légales des factures.
