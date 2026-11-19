# Matrice des droits — Étape 1 (v0.2, cible)

**Cible à implémenter à l'étape 3.** Aujourd'hui les droits d'équipe reposent sur un simple rang ; les permissions nommées existent mais ne sont pas branchées (BUG-004). Règles : refus par défaut ; contrôle toujours côté serveur ; masquer un bouton n'est pas une sécurité ; chaque action sensible est journalisée.

"sur délégation" = le titulaire du compte principal (ou le Superadmin pour un admin) l'a explicitement accordé.

## 1. Rôles et capacités

| Capacité | Visiteur | Membre | Annonceur approuvé | Annonceur Premium certifié | Collaborateur délégué | Modérateur | Admin | Superadmin |
|---|---|---|---|---|---|---|---|---|
| Consulter annonces, carte, annuaire, profils | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Favoris, recherches sauvegardées, avis, signalements | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Messagerie et demandes de visite | — | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Demander le statut d'annonceur | — | ✔ | — | — | — | — | — | — |
| Publier / modifier mes annonces | — | — | ✔ | ✔ | sur délégation | — | — | — |
| Mes biens (patrimoine, documents, collaborateurs) | — | — | ✔ | ✔ | sur délégation | — | — | — |
| Centre Premium (statistiques, campagnes) | — | — | — | ✔ | sur délégation | — | — | — |
| Espace Pro / CRM (prospects, pipeline, équipe) | — | — | agence vérifiée | ✔ | sur délégation | — | — | — |
| Modérer annonces, contenus, documents | — | — | — | — | — | ✔ | ✔ | ✔ |
| Restreindre ou bloquer un compte | — | — | — | — | — | restreindre | ✔ | ✔ |
| Décider Premium, badges, vérifications d'agence | — | — | — | — | — | — | sur délégation | ✔ |
| Console d'administration (/admin) | — | — | — | — | — | ✔ | ✔ | ✔ |
| Owner Center — modules délégables | — | — | — | — | — | — | sur attribution | ✔ |
| Owner Center — modules sensibles (sauvegardes, offres, marque, légal, réglages) | — | — | — | — | — | — | — | ✔ |
| Attribuer rôles et permissions | — | — | — | — | — | — | — | ✔ |

## 2. Owner Center — module par module (DEC-001, proposition à confirmer : DEC-003)

Un admin n'accède à un module « delegable » que si le Superadmin le lui a attribué. Les modules « superadmin » ne sont jamais délégables. Modérateurs et utilisateurs : aucun accès à l'Owner Center. Refus par défaut, contrôlé côté serveur.

| Module (segment de route) | Libellé | Accès | Raison |
|---|---|---|---|
| `dashboard` | Tableau de bord | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `overview` | Vue d'ensemble | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `activity` | Activité | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `charts` | Graphiques | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `trends` | Tendances | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `regions` | Régions (lecture) | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `report` | Rapports | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `report.pdf` | Rapport PDF | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `premium-funnel` | Entonnoir Premium (lecture) | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `subscriptions` | Abonnements (lecture) | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `monitoring` | Surveillance | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `health` | État du service | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `agencies` | Agences (lecture) | Délégable à un admin | Lecture de chiffres ; aucune action sensible. |
| `crm` | CRM | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `pipeline` | Pipeline de prospects | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `visits` | Visites | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `complaints` | Réclamations | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `incidents` | Incidents | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `marketing` | Marketing | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `campaigns` | Campagnes | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `newsletters` | Newsletters | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `broadcast` | Diffusion de messages | Délégable à un admin | Opérations courantes de relation client ; chaque action est journalisée. |
| `categories` | Catégories | Délégable à un admin | Référentiels : erreur visible mais réversible ; historique conservé. |
| `places` | Lieux | Délégable à un admin | Référentiels : erreur visible mais réversible ; historique conservé. |
| `zones` | Quartiers et zones | Délégable à un admin | Référentiels : erreur visible mais réversible ; historique conservé. |
| `languages` | Langues | Délégable à un admin | Référentiels : erreur visible mais réversible ; historique conservé. |
| `redirects` | Redirections | Délégable à un admin | Référentiels : erreur visible mais réversible ; historique conservé. |
| `listings.csv` | Export des annonces | Délégable à un admin | Export contenant des données personnelles : motif obligatoire et consultation journalisée. |
| `listings.pdf` | Export des annonces (PDF) | Délégable à un admin | Même contenu et mêmes règles que l'export CSV des annonces : motif obligatoire et consultation journalisée. |
| `export.csv` | Export de données | Délégable à un admin | Export contenant des données personnelles : motif obligatoire et consultation journalisée. |
| `backup` | Sauvegarde manuelle | **Superadmin seul** | Données complètes de la plateforme. |
| `backups` | Sauvegardes | **Superadmin seul** | Données complètes de la plateforme. |
| `restores` | Restaurations | **Superadmin seul** | Peut écraser les données de production. |
| `offers` | Offres et tarifs | **Superadmin seul** | Effet financier direct. |
| `settings` | Réglages de la plateforme | **Superadmin seul** | Modifie le comportement global. |
| `logo` | Logos et marque | **Superadmin seul** | Identité de la plateforme. |
| `legal` | Pages légales | **Superadmin seul** | Engagement juridique. |
| `seo` | Référencement | **Superadmin seul** | Visibilité publique de toute la plateforme. |
| `ai` | Assistance IA | **Superadmin seul** | Aide à la rédaction : à cadrer avant délégation. |
| `security-log` | Journal de sécurité | **Superadmin seul** | Contient des traces de sécurité sensibles. |
| `countries` | Pays | **Superadmin seul** | Active un pays entier de la plateforme. |

**31 modules délégables, 12 réservés au Superadmin** (total 43 = tous les segments de `/staff/owner/*` du code ; vérifié par test).

## 3. Tests exigés à l'étape 3
Pour chaque route `/staff/*` et `/staff/owner/*` : refus (403) pour un utilisateur ordinaire, un modérateur (Owner Center), et un admin sans attribution ; accès accepté pour le rôle prévu ; action journalisée.
