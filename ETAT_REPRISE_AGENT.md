# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 28 novembre 2026 (UTC) — fusion du centre des activations
- Branche : `main` (fusion de `feature/centre-activations` sur accord du propriétaire ; retour arrière : `git revert -m 1 <commit de fusion>`)
- Statut : fusionné ; contrôle en ligne à faire

## Déclaration du propriétaire
> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

Texte de référence : `CAHIER_DES_CHARGES.md`. Ce n’est ni une validation juridique ni une preuve que les fonctionnalités sont éteintes.

## Dernière intervention
Owner Center → Paramètres du site → **Centre des activations** (Super Admin).
- Fichiers : `server/services/activations.js`, `public/js/owner/v-activations.js`, `test/centre-activations.test.js`, routes `GET /staff/owner/activations` et `PUT …/:key`, menu, style, matrice des droits (46 segments), `analytics.setSetting`.
- 12 bascules via les services existants, avec confirmation. Couper reste possible ; allumer est refusé sans configuration (paiement en ligne, WhatsApp) ou si `ANALYTICS_ENABLED=false`.
- Consultation seule : offres, boosts, pixels, double authentification obligatoire, présence des fournisseurs (aucune clé affichée).
- Historique : changements faits depuis le centre uniquement (30 derniers).

### Vérifications
- Suite complète 572/572, relancée après la dernière retouche de l’écran.
- Chromium, base jetable : confirmation, annulation, coupure et réactivation CRM, historique, 1366 px et 390 px sans débordement ni erreur.
- Non vérifié : production, fournisseurs réels, autres bascules cliquées au navigateur (couvertes par le test API).

## Intervention précédente
Coupures CRM et Premium et audit fusionnés dans `main` (`8bbaf6f`). Refonte de la fiche annonce (`aad948f`, autre agent). Contrôle en ligne non confirmé.

## Points ouverts prioritaires
1. Avant lancement : désactiver ce qui n’est pas autorisé (principe 8). Tout n’a pas encore d’interrupteur confirmé ; aucun recensement complet fait.
2. Consentement à l’inscription sans refus distinct : à traiter avec le juriste avant lancement.
3. Écarts 3 à 7 de l’audit (portée du choix « Statistiques », chemins, purge, chiffres gonflables, documents périmés).
4. Corriger le nettoyage de fichiers du test `test/star-badge-pg.test.js`.
5. Finaliser et tester la récupération MFA Superadmin.
6. Prouver sauvegarde chiffrée hors serveur et restauration sur base jetable.
7. Valider les paiements et fournisseurs en réel ; recetter la production.

## Prochaine tâche exacte
Après le déploiement, le propriétaire contrôle sur le site : le Centre des activations (cases CRM et Premium comprises), une fiche annonce et l’Observatoire. Puis, à autoriser : interrupteurs manquants par petits lots (commentaires, avis, messagerie), activés par défaut, sur branche dédiée.

## Ordre de lecture à la reprise

1. `ETAT_REPRISE_AGENT.md`
2. `SUIVI_EXECUTION.md`
3. `CAHIER_DES_CHARGES.md`
4. `ARCHITECTURE_TECHNIQUE.md`
5. Seulement ensuite, les fichiers techniques du périmètre demandé.

## Consignes permanentes

- Répondre en français, de façon concise et orientée exécution.
- Économiser les tokens : lectures ciblées, pas de relecture globale inutile.
- Ne jamais affirmer une action ou un test non effectué.
- Ne pas modifier une exigence métier validée sans arbitrage explicite.
- Ne pas ajouter de dépendance, migration ou refonte sans justification et autorisation.
- Avant toute écriture : préciser périmètre, branche et risques.
- Aucune modification de `main`, base ou production sans autorisation explicite.
- Après chaque intervention significative, mettre à jour `SUIVI_EXECUTION.md` et cette fiche.
