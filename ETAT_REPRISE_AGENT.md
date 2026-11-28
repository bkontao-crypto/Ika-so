# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 28 novembre 2026 (UTC) — Phase 0 du système économique (audit)
- Branche : `feature/systeme-economique-ika-so`, créée depuis `main` `eff3d40` (non fusionnée)
- Statut : audit terminé ; Phase 1 en attente des décisions A à D

## Mission en cours : système économique (cahier d'ordonnance v1.0 du 28/11/2026)
- Livrable Phase 0 : `AUDIT_SYSTEME_ECONOMIQUE.md` (cartographie des 12 modules, risques, architecture cible, migrations 096+).
- Aucun code modifié. Tests de référence : 544 réussis, 0 échec, 29 ignorés (PostgreSQL absent).
- Règle absolue : toute monétisation fermée par défaut ; mécanisme distinct de `server/lib/modules.js` (ouvert par défaut).
- Décisions attendues : A (Premium/mise à la une payants soumis à l'interrupteur général), B (« propriétaire professionnel »), C (fusion par phase), D (démarrer par la Phase 1).
- Prochaine tâche exacte : après décisions, Phase 1 — `server/lib/monetization-policy.js` (règle pure + tests), migration 096 (configuration à `false`, permissions économiques), correction du repli permissif `payments.js:21`, écran « Gestion économique » minimal.

## Déclaration du propriétaire
> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

Texte de référence : `CAHIER_DES_CHARGES.md`. Ce n’est ni une validation juridique ni une preuve que les fonctionnalités sont éteintes.

## Intervention précédente (interrupteurs communauté)
Trois interrupteurs ajoutés au Centre des activations (15 au total), activés par défaut, bloqués par le serveur (403), sans suppression de données ni migration. Clés : `main.modules.comments|reviews|messaging`.

| Coupé | Bloqué | Reste ouvert |
|---|---|---|
| Commentaires | publier (annonces, publications) | lire, signaler, modérer |
| Avis | publier, modifier, répondre | lire, supprimer son avis ou sa réponse, signaler, modérer |
| Messagerie | écrire depuis une annonce, répondre, « Contacter » de Découvrir | lire, bloquer, débloquer, signaler |

- La coupure vaut aussi pour le Super Admin. Non concernés : réclamations, réponses aux demandes annonceur, boîte WhatsApp, formulaire d’accueil.
- Écrans : saisie remplacée par un message. Les boutons « Écrire » et « Donner mon avis » restent et mènent à ce message.
- Le serveur coupe immédiatement ; l’écran public suit après rechargement de la page (réglages en cache 60 s).

### Vérifications
- Suite complète 573/573 ; nouveau test `test/interrupteurs-communaute.test.js`, qui échoue si un blocage est retiré.
- Chromium, base jetable : activé, coupé (1366 px et 390 px), réactivé (390 px), sans débordement. Seule erreur : image d’essai absente (404).
- Après fusion : 573/573 ; marge du message revue au navigateur (boîte et conversation).
- Non vérifié : production.

## Intervention précédente
Centre des activations fusionné dans `main` (`50bec85`). Coupures CRM et Premium fusionnées (`8bbaf6f`). Contrôle en ligne non confirmé.

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
