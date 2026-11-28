# ÉTAT DE REPRISE AGENT — IKA SÔ

- Mise à jour : 28 novembre 2026 (UTC) — coupures CRM et Premium
- Branche : `fix/modules-crm-premium` (contient aussi les documents de `docs/audit-analytics`) ; NON fusionnée
- Statut : correction terminée et testée ; validation du propriétaire attendue

## Déclaration du propriétaire
> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

Texte de référence : `CAHIER_DES_CHARGES.md`. Ce n’est ni une validation juridique ni une preuve que les fonctionnalités sont éteintes.

## Dernière intervention
- `server/lib/modules.js` : coupure lue à chaque requête dans le réglage superadmin `main` ; seul `false` coupe.
- CRM coupé : `/me/crm/*` et `/me/whatsapp/*` refusés (403), Super Administrateur compris.
- Premium coupé : `/me/center`, `/me/center/map`, nouvelle demande, achat Premium refusés ; formules retirées de `/offers` ; clic non compté. Mise à la une inchangée.
- Restent ouverts : espace standard, historique, factures, retrait, webhook, traitement par l’équipe ; dossier d’un client déjà payé. Droits non modifiés (leur durée continue de courir).
- Non coupés : vues CRM et pipeline internes de l’Owner Center, WhatsApp Business (boîte), attribution manuelle de Premium et approbations par l’équipe, autres avantages hors centre.
- Si un réglage existant avait déjà `premium` ou `crm` à `false` (ancien masquage), la fusion fermera réellement l’accès : le vérifier avant déploiement.

## Vérifications
- Suite complète : 571/571, cinq passages consécutifs après correction d’un nettoyage instable du nouveau test ; à relancer si le code change.
- Contrôle négatif : le nouveau test échoue quand le refus est retiré.
- Chromium (base jetable) : ouvert, coupé par les cases de l’Owner Center, rouvert ; aucune erreur JavaScript relevée.
- Non vérifié : production, fournisseur de paiement réel, WhatsApp réel, mobile.

## Points ouverts prioritaires
1. Avant lancement : désactiver ce qui n’est pas autorisé (principe 8). Tout n’a pas encore d’interrupteur confirmé ; aucun recensement complet fait.
2. Consentement à l’inscription sans refus distinct : à traiter avec le juriste avant lancement.
3. Écarts 3 à 7 de l’audit (portée du choix « Statistiques », chemins, purge, chiffres gonflables, documents périmés).
4. Corriger le nettoyage de fichiers du test `test/star-badge-pg.test.js`.
5. Finaliser et tester la récupération MFA Superadmin.
6. Prouver sauvegarde chiffrée hors serveur et restauration sur base jetable.
7. Valider les paiements et fournisseurs en réel ; recetter la production.

## Prochaine tâche exacte
Après accord (« Fusionne »), fusionner `fix/modules-crm-premium` dans `main` (documents d’audit inclus). Ensuite, à autoriser : centre des activations.

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
