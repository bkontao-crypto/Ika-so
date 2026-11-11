# Phase 3 — Confiance et modération avancée (rapport)

Voir `SUIVI.md` pour l'état détaillé. 1er novembre 2026.

## Fait
Pièces justificatives et badges (document, agence) accordés par contrôle humain tracé · liste noire · alertes automatiques · signalement de commentaires · onglet « Confiance » du centre de contrôle · badges visibles sur les cartes et la fiche. Migration 006.

## Testé, et comment
`test/trust.test.js` (8 tests, PostgreSQL réel) : refus de fichier invalide, badge absent tant qu'aucun contrôle, droits (modérateur ne peut pas valider une agence ni retirer un badge), badge retiré à la modification, alertes de prix et de rafale, signalements uniques et seuil, liste noire (inscription, numéro, comptes existants).
Navigateur réel : l'annonceur joint un justificatif, la fiche n'a pas de badge, l'administrateur contrôle et accepte, la fiche affiche « Titre foncier contrôlé par l'équipe ».

## Non vérifié
Procédure humaine de contrôle (aucun organisme réel consulté) · seuils d'alerte sur des données réelles · avis non faits · stockage des pièces dans la base (à chiffrer ou externaliser) · ouverture d'un PDF dans le centre de contrôle (testé avec une image seulement).

## Risques
Un badge n'a de valeur que si l'équipe contrôle vraiment : à écrire dans une procédure avant le pilote. Faux positifs possibles sur l'alerte de prix en début de vie du site (peu de comparables : l'alerte exige 3 annonces).

## Décisions attendues
Seuils d'alerte · règle des avis · procédure de contrôle des pièces · stockage des pièces.
