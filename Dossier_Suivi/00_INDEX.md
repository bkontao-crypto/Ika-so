# Dossier_Suivi — index du suivi d'IKA SÔ

Créé le 15 novembre 2026. **Ce dossier ne duplique rien** : les documents de suivi existaient déjà dans `Important/` et `docs/`. Cet index dit où lire quoi, pour tout agent qui intervient sur le projet.

## Où se trouve la vérité
| Besoin | Document |
|---|---|
| **Journal de suivi principal** (à réaliser / réalisé / vérifié / à faire / risques), le plus récent en premier | `Important/SUIVI.md` |
| Historique des versions | `Important/CHANGELOG.md`, `Important/SUIVI_EVOLUTION_IKA_SO.md` |
| **Registre des anomalies (BUG-xxx)**, décisions à arbitrer (DEC-xxx), fonctionnalités, tests, journal | `Important/IKA_SO_SUIVI_TRANSFORMATION_ET_RECETTE.xlsx` |
| Audit initial | `Important/AUDIT_INITIAL_IKA_SO.md` |
| Audit du badge Étoile (paiement, traitement, obtention, affichage), 26 novembre 2026 | `Important/AUDIT_BADGE_ETOILE_2026-11-26.md` |
| Spécification du Super Administrateur | `Important/SPECIFICATION_SUPERADMIN.md` |
| Architecture et modèle de données analytiques | `Important/ARCHITECTURE_ANALYTICS.md`, `Important/MODELE_DONNEES_ANALYTIQUES.md` |
| Rôles, permissions, deux Superadmin, MFA | `Important/PLAN_ROLES_PERMISSIONS.md`, `docs/etape-1/MATRICE_DROITS.md` |
| Décisions techniques, exploitation | `docs/decisions.md`, `docs/exploitation.md` |
| Cartographie des routes et des rôles | `docs/etape-0/CARTOGRAPHIE_ROUTES_API_ROLES.md` |

## Fiches en attente de fusion dans `Important/SUIVI.md` et dans le classeur Excel
`Important/SUIVI.md` (391 Ko) et le classeur `.xlsx` ne peuvent pas être modifiés à distance par l'API GitHub. Ces fiches, écrites au format du suivi (à réaliser / réalisé / vérifié / en cours / à faire / risques), attendent d'y être reportées par un agent qui travaille sur un dépôt cloné. Une fois reportée, une fiche reste en place (historique) ; retirer alors sa ligne de cette liste.

| Fiche | Contenu | À reporter dans le classeur |
|---|---|---|
| `Important/LIVRAISON_MFA_ETAPE_1_2026-11-24.md` | MFA, fondations (TOTP, codes de secours, migration 091) | Fonctionnalité MFA |
| `Important/LIVRAISON_MFA_ETAPE_2B_2026-11-25.md` | MFA à la connexion (migration 092, routes `/api/mfa`) | Fonctionnalité MFA |
| `Important/LIVRAISON_WHATSAPP_BOITE_2026-11-25.md` | Boîte WhatsApp (migration 094, page `/whatsapp`) | Fonctionnalité WhatsApp ; limites : pas de média, pas de durée de conservation |
| `Important/AUDIT_BADGE_ETOILE_2026-11-26.md` | Audit du badge Étoile | 7 constats ÉTOILE-1 à ÉTOILE-7 (numéros BUG/DEC à attribuer) ; 3 décisions du propriétaire |

## Documents directeurs (hors dépôt)
Les instructions permanentes, l'« Ordonnance générale d'exécution » (3 novembre 2026) et le protocole opérationnel sont dans le projet Claude « Depot IKA SO » (documents `Memoire`). Ils font foi pour la vision et les règles de travail.

## Livrables de l'ordonnance (§ 27) — état au 15 novembre 2026
Présents : `AUDIT_INITIAL_IKA_SO`, `SPECIFICATION_SUPERADMIN`, `ARCHITECTURE_ANALYTICS`, `MODELE_DONNEES_ANALYTIQUES`, `CHANGELOG`.
Absents (à créer seulement quand utiles, sans doublon avec `SUIVI.md`) : `CATALOGUE_INDICATEURS`, `REGLES_METIER`, `SECURITE`, `PLAN_DE_TESTS`, `ROADMAP`, `SUIVI_DEVELOPPEMENT`. Pour `SUIVI_DEVELOPPEMENT`, c'est `Important/SUIVI.md` qui joue ce rôle.

## Règles rapides
- Chaque intervention effective met à jour `Important/SUIVI.md` (sans effacer l'historique) ; un test non exécuté est écrit « non exécuté ».
- Une branche par tâche, fusion dans `main` avec un commit de fusion (retour arrière : `git revert -m 1 <commit>`), jamais de push forcé.
- Décisions de droits, de modèle économique ou de règles de gestion : demandées au propriétaire (voir les DEC-xxx du classeur).
