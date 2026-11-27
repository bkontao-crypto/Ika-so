# CAHIER DES CHARGES — IKA SÔ

- Version : 1.0 — 27 novembre 2026
- Référence métier détaillée : `docs/ordonnance/IKA_SO_CAHIER_ORDONNANCE_TRANSFORMATION_AGENT_IA.txt` (version 1.0 du 11 novembre 2026)
- Marché de lancement : Mali
- Devise de référence : FCFA
- Statut : référentiel consolidé ; les statuts d'implémentation sont suivis séparément dans `SUIVI_EXECUTION.md`.

> Ce document organise les exigences du produit. Il ne constitue pas une preuve que chaque fonctionnalité est déjà livrée. En cas de divergence, une décision ultérieure explicitement validée par le propriétaire prévaut ; toute modification doit être tracée.

## Déclaration du propriétaire — conformité juridique (27 novembre 2026)

> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

*Formulation mise au propre par l’agent à partir de la déclaration du propriétaire.*

**Comment la comprendre :**
- les documents juridiques restent **à produire** : ils conditionnent le lancement des fonctionnalités concernées ;
- cette déclaration n’est ni une validation juridique ni un avis de juriste ;
- elle ne dit pas que ces fonctionnalités sont aujourd’hui éteintes dans le code. L’état technique constaté pour l’audience figure dans `docs/audit/AUDIT_ANALYTICS_2026-11-27.md` ;
- l’activation pendant le développement et la désactivation avant le lancement sont régies par le principe 8 (section 2).

## 1. Vision et objectifs

IKA SÔ est une plateforme immobilière destinée au marché africain, avec lancement au Mali. Elle doit couvrir un parcours immobilier cohérent : découvrir et comparer des biens, contacter les annonceurs, vérifier les informations, organiser des visites, vendre, louer, gérer et, à terme, investir.

Objectifs :
- fournir une expérience fiable, rapide, responsive et accessible ;
- relier chaque écran à une vraie règle métier, une API et une source de données ;
- sécuriser les comptes, les justificatifs, les paiements et les actions administratives ;
- permettre au propriétaire de piloter le service sans contourner les permissions ;
- éviter les fonctionnalités décoratives, les données fictives présentées comme réelles et les doubles implémentations.

## 2. Principes non négociables

1. Auditer l'existant avant toute évolution.
2. Préserver les routes, API, données, rôles, permissions et intégrations opérationnelles.
3. Réutiliser les services existants ; ne pas dupliquer authentification, paiement, messagerie ou gestion des rôles sans justification.
4. Toute évolution de base est additive par défaut, versionnée, testée sur copie, sauvegardée et accompagnée d'un retour arrière documenté.
5. Ne jamais exposer secrets, mots de passe, tokens, justificatifs ou données privées.
6. Toute fonctionnalité doit avoir des états chargement, succès, vide et erreur ; validations serveur ; permissions ; journalisation appropriée et tests.
7. Une interface sans branchement réel n'est pas une fonctionnalité terminée.
8. Pendant le développement, les fonctionnalités restent **activées par défaut et désactivables**, afin de vérifier qu’elles fonctionnent. Avant le lancement, désactiver toute fonctionnalité pour laquelle l’autorisation ou les documents juridiques requis manquent, y compris toute collecte ou tout traitement de données personnelles, qui exige une validation juridique et une configuration conforme. (Décision du propriétaire du 27 novembre 2026 ; elle remplace l’ancienne rédaction de ce principe.)
9. Toute mise en production doit être distinguée des vérifications locales et CI.

## 3. Utilisateurs, comptes et accès

- Visiteurs non connectés : consultation des pages et annonces publiques selon les règles de visibilité.
- Membres : compte, profil, annonces, favoris, interactions, messagerie et alertes selon leurs droits.
- Particuliers et agences : parcours et informations adaptés au statut ; les changements de statut soumis à validation suivent le processus de contrôle.
- Équipes professionnelles : gestion des leads, activités et collaborateurs selon permissions.
- Administrateurs et Superadmin : modération, gestion des comptes, paramètres, modules, accès et supervision avec journal d'audit.
- Authentification : méthodes réellement configurées et documentées ; ne pas annoncer une méthode tant que son parcours complet n'est pas validé.
- MFA : protéger les comptes privilégiés ; documenter activation, récupération et codes de secours.

Les rôles et permissions doivent être contrôlés côté serveur. L'interface ne remplace jamais le contrôle d'autorisation.

## 4. Périmètre fonctionnel

### 4.1 IKA SÔ Market — annonces et recherche
- publier et gérer des annonces immobilières : vente, location, terrains et catégories pertinentes ;
- brouillons, statuts de publication, modération, photos et fiche détaillée ;
- recherche, filtres, tri, pagination et partage ;
- signalements, gestion des doublons et historique de prix ;
- référencement des pages publiques et URLs stables.

### 4.2 IKA SÔ Map — découverte géographique
- afficher les biens sur une carte et synchroniser carte et résultats ;
- recherche géographique par quartier/commune et filtres ;
- regroupement des marqueurs, ergonomie mobile et mode de secours ;
- contrôler couverture, coûts, quotas, licence et configuration du fournisseur cartographique.

### 4.3 IKA SÔ Trust — confiance et vérification
- recueillir les justificatifs nécessaires à la vérification ;
- suivre les demandes, décisions, motifs, statuts et historique ;
- contrôler les accès aux pièces et tracer les consultations sensibles ;
- signaler les contenus ou comportements suspects ;
- appliquer une politique de conservation et de suppression validée juridiquement.

### 4.4 Comptes, profils et réseau communautaire
- inscription, connexion, récupération et vérification des moyens de contact ;
- profils particuliers/agences, abonnements et abonnés ;
- publications communautaires, réactions, commentaires et interactions ;
- paramètres de confidentialité, blocage et signalement.

### 4.5 Messagerie et contacts
- conversations privées, messages, statut de lecture, blocage et signalement ;
- permettre les échanges utiles au parcours immobilier ;
- pièces jointes, notes vocales et médias uniquement après implémentation et validation de sécurité ;
- distinguer un clic de contact d'une conversation réellement établie.

### 4.6 Mes alertes
- créer une alerte par type de bien et zone/quartier ;
- un critère de zone/quartier vide signifie une portée globale : l'alerte recherche alors dans toutes les zones couvertes par la plateforme ;
- définir des prix minimum et maximum cohérents ;
- programmer, mettre en pause, prolonger et consulter l'historique ;
- notifier selon les préférences et les règles de fréquence ;
- toute option de boost payant doit rester indisponible tant que paiement, tarification et activation ne sont pas entièrement branchés.

### 4.7 IKA SÔ Pro / CRM
- gérer les prospects et leads, leur statut et leur historique ;
- organiser un pipeline commercial, scoring et équipes ;
- fournir des statistiques et exports autorisés ;
- garantir l'isolation des données par organisation et les permissions.

### 4.8 Owner Center et Superadmin
- tableau de bord et gestion des paramètres autorisés ;
- gestion des utilisateurs, rôles, permissions, délégations et modules ;
- modération et suivi des annonces, signalements, paiements et demandes ;
- journal d'audit des actions sensibles ;
- indicateurs fondés sur des sources de données identifiées ;
- séparer les fonctions du propriétaire des comptes administrateurs ordinaires.

### 4.9 Premium et paiements
- demandes Premium, examen, décision, facturation, paiement, remboursement et rapprochement ;
- aucune activation sur la seule base d'un retour navigateur : vérifier les notifications signées du fournisseur et l'état réel du paiement ;
- documenter fournisseurs, frais, devises, statuts, délais et procédures d'incident ;
- tester les fournisseurs en environnement réel avant de déclarer le parcours opérationnel.

### 4.10 Analytics et reporting
- définir une source de vérité par indicateur ;
- distinguer actions métier (favoris, messages, annonces, paiements) et exposition (vues, visiteurs, sessions) ;
- exclure robots et doublons selon des règles vérifiables ;
- documenter les limites des indicateurs et leur période de collecte ;
- respecter consentement, minimisation et obligations légales avant activation.

### 4.11 Évolutions de vision à cadrer
La vision générale mentionne aussi des parcours de location/transaction complets, IKA SÔ Invest et IKA SÔ Intelligence. Ils ne doivent pas être présentés comme livrés sans cahier fonctionnel dédié, implémentation, tests et validation du propriétaire.

## 5. Exigences transversales

### Sécurité et confidentialité
- contrôle d'accès serveur, sessions sûres, limitation des abus et validation des entrées ;
- MFA pour les comptes privilégiés, avec procédure de récupération testée ;
- protection des justificatifs et fichiers ; stockage durable ; accès limité ;
- secrets uniquement dans l'environnement d'exécution ;
- audit des actions sensibles et politique de rétention ;
- conformité légale malienne et avis juridique avant ouverture publique.

### UX, accessibilité et responsive
- interface française claire et cohérente ;
- mobile, tablette et desktop ;
- thèmes clair et sombre cohérents ;
- navigation clavier, focus visible, contrastes suffisants ;
- états de chargement, erreur, vide et confirmation ;
- performance adaptée aux connexions mobiles et aux appareils modestes ;
- limiter les animations coûteuses.

### Fiabilité et exploitation
- PostgreSQL persistant ;
- migrations versionnées et non destructives par défaut ;
- sauvegardes chiffrées hors serveur et tests réguliers de restauration ;
- logs exploitables sans secrets ni données personnelles inutiles ;
- endpoint de santé et surveillance ;
- procédure de déploiement et de retour arrière documentée.

## 6. Règles de livraison et de validation

Une fonctionnalité est **TERMINÉE ET VÉRIFIÉE** uniquement si :
1. le besoin et les critères d'acceptation sont documentés ;
2. l'écran, les routes, services, tables et permissions sont reliés ;
3. les tests pertinents passent ;
4. les parcours principaux et erreurs ont été vérifiés ;
5. la non-régression est contrôlée ;
6. les changements de base et le rollback sont documentés ;
7. les preuves sont conservées dans le suivi.

Les statuts sont définis dans `SUIVI_EXECUTION.md`. Une réussite CI ne prouve pas le fonctionnement des services tiers ni de la production.

## 7. Documents associés

- Ordonnance métier détaillée : `docs/ordonnance/IKA_SO_CAHIER_ORDONNANCE_TRANSFORMATION_AGENT_IA.txt`
- Architecture observée et cible : `ARCHITECTURE_TECHNIQUE.md`
- Suivi des preuves et écarts : `SUIVI_EXECUTION.md`
- Passation courte : `ETAT_REPRISE_AGENT.md`
- Exploitation : `docs/exploitation.md`

## 8. Gestion des décisions

Toute modification d'une exigence validée doit comporter : décision, date, auteur/validation du propriétaire, justification, impact métier, impact technique et documents concernés. En l'absence d'arbitrage, conserver la règle existante et signaler le blocage plutôt que l'inventer.
