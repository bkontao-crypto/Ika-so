# Workflow de modération — IKA SO

**Objectif** : clarifier le processus pour l'équipe de modération (signalements, réclamations, badges, restrictions).

## 1. Principes
- Les badges (Titre contrôlé, Agence, SMS) ne sont jamais automatiques : ils nécessitent une vérification humaine réelle.
- Un signalement ou une réclamation ne bloque pas automatiquement une annonce ou un compte.
- Toute action de restriction doit être traçable et réversible.
- Priorité : protéger les utilisateurs sans pénaliser les annonceurs de bonne foi.

## 2. Sources d'entrée
| Source | Déclencheur | Priorité |
|--------|-------------|----------|
| Signalement depuis fiche / profil | Utilisateur connecté clique « Signaler » | Moyenne |
| Réclamation (`#/reclamations`) | Formulaire dédié | Haute si liée à une transaction |
| Revue / avis abusif | Signalement d'un avis | Basse |
| Détection interne | Anomalie (photos, prix, contenu) | Selon gravité |

## 3. Statuts des réclamations
- **Ouverte** : nouvellement déposée, non traitée.
- **En cours** : prise en charge par un modérateur.
- **Résolue** : action effectuée, utilisateur informé.
- **Fermée** : sans suite (hors périmètre, doublon, etc.).

Les pastilles colorées sont affichées côté utilisateur pour la transparence.

## 4. Actions possibles sur un compte / annonce
1. Demander des précisions à l'annonceur.
2. Retirer un badge (si document modifié ou non conforme).
3. Masquer temporairement une annonce.
4. Restreindre un compte (bannière visible sur le profil public).
5. Archiver / supprimer (cas graves, après double validation).

## 5. Attribution des badges
- **Titre foncier contrôlé** : vérification auprès de l'organisme compétent (cadastre / conservation foncière). Disparaît si l'annonce est modifiée.
- **Agence vérifiée** : contrôle du registre de commerce.
- **Numéro vérifié par SMS** : code réellement envoyé et validé.

## 6. Outils existants
- Centre d'administration (`/admin`) : modération des annonces, utilisateurs, signalements.
- Page Confiance : explication publique des badges.
- Page Réclamations : dépôt et suivi côté utilisateur.
- Profil annonceur : affichage des badges + possibilité de signaler.

## 7. Bonnes pratiques pour l'équipe
- Toujours documenter la raison d'une action dans les notes internes.
- Prévenir l'annonceur avant une restriction lourde quand c'est possible.
- Vérifier les pièces hors plateforme (ne pas se fier uniquement aux fichiers uploadés).
- Revoir régulièrement les comptes restreints pour lever les sanctions justifiées.

## 8. Points ouverts
- Matrice détaillée des rôles modérateurs (à aligner avec DEC-003 Owner Center).
- Journal d'audit des actions de modération (à renforcer).
- Intégration éventuelle avec les notifications SMS/email pour informer l'annonceur.

*Document créé dans le cadre de l'étape 7 — à valider et enrichir par l'équipe.*
