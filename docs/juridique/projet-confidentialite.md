> **PROJET NON VALIDÉ.** Rédigé à partir de ce que le logiciel fait réellement (vérifié dans le code le 02/11/2026). Il doit être relu et complété par un juriste malien avant publication : lois applicables sur les données personnelles au Mali, autorité de protection, droits des personnes, transferts hors du pays (hébergement, SMS). Les passages ⛔ sont des décisions du propriétaire.

# Politique de confidentialité — Ika So

## Qui nous sommes
⛔ Raison sociale, adresse, contact pour les questions de données : à compléter (structure juridique non encore choisie).

## Ce que nous recueillons
| Donnée | Pourquoi | Qui peut la voir |
|---|---|---|
| Nom affiché, adresse e-mail, mot de passe (conservé sous forme **hachée**, jamais en clair) | Créer et protéger votre compte | Vous ; l'équipe (nom, e-mail) pour la modération |
| Numéro de téléphone et code de vérification (SMS) | Vérifier que le numéro est le vôtre | Équipe ; **visiteurs connectés seulement via le bouton « contacter »** (compté), jamais sur les pages publiques |
| Annonces, photos, descriptions | Publier votre bien | Le public, après relecture par l'équipe |
| Pièces justificatives (titre, RCCM…) | Contrôle d'un badge | **Équipe seulement** ; chaque ouverture est enregistrée |
| Messages, demandes de visite | Échanger avec l'autre personne | Les deux personnes ; l'équipe seulement si un signalement est fait (extrait des derniers messages) |
| Avis donnés et reçus (note, texte) | Informer les autres sur un annonceur | **Le public** : le texte, la note, la date et « Prénom N. » de l'auteur ; l'équipe en cas de signalement |
| Favoris, recherches enregistrées, alertes | Vous prévenir et vous faciliter la vie | Vous |
| Paiements (offre, montant, état, numéro de facture) | Facturer la mise à la une | Vous ; équipe d'administration |
| Journal technique (erreurs, actions de modération) | Sécurité et réparation | Équipe technique |

## Ce que nous ne recueillons pas
- **Aucune adresse IP n'est enregistrée** par l'application : elle sert seulement, en mémoire, à freiner les abus, et n'est ni stockée ni écrite dans les journaux. ⛔ L'hébergeur, lui, peut en conserver : à vérifier dans ses conditions.
- Aucun traceur publicitaire, aucune ressource tierce chargée par le site (pas de CDN, pas d'analytique tierce).
- Numéro de carte : jamais (le paiement passe par le fournisseur de paiement choisi ⛔).

## Cookies et stockage dans votre appareil
- Un cookie de **session** (`ika_session`, HttpOnly, 30 jours) pour vous garder connecté.
- Dans votre appareil : brouillon d'annonce en cours, copie des dernières annonces vues pour la lecture hors connexion. Rien de privé (messages, compte) n'y est gardé.

## Transferts hors du Mali (art. 11)
Les serveurs, la base de données et l'envoi de SMS peuvent être situés **hors du Mali**. ⛔ Formalité auprès de l'APDP et pays concernés : à compléter avant l'ouverture au public (point bloquant identifié dans la note juridique).

## Qui traite vos données pour nous
⛔ À compléter avec les choix définitifs : hébergeur du site (Render ?), base de données (Neon ?), envoi de SMS (Twilio ou autre), fournisseur de paiement mobile money, stockage des sauvegardes. Pour chacun : pays, rôle, durée. Les sauvegardes sont chiffrées et conservées hors du serveur.

## Combien de temps
Constaté dans le logiciel : annonces visibles 45 jours (renouvelables) ; session 30 jours. **Durées par défaut (fixées provisoirement, à valider par un juriste malien)** :
- codes SMS : 7 jours · sessions expirées : 7 jours après l'expiration ;
- pièces justificatives (fichier) : effacées 90 jours après la décision de contrôle ; la décision et la note restent ;
- notifications : 180 jours après lecture, 365 jours au plus ;
- conversations : supprimées après 24 mois sans message ; demandes de visite closes : 24 mois ;
- annonces refusées, expirées ou archivées : 12 mois, sauf si un paiement y est lié ;
- journal d'actions de l'équipe : 36 mois ;
- factures et paiements : 10 ans (obligation comptable, à confirmer) ;
- comptes inactifs depuis 24 mois : signalés à l'équipe, jamais supprimés automatiquement ;
- sauvegardes : ⛔ durée à fixer avec l'hébergeur.
Le nettoyage est une commande manuelle (simulation d'abord), jamais une minuterie.

## Vos droits (Loi n° 2013-015, art. 12, 13, 19)
- **Accès** (art. 12) : gratuit ; dans « Mon profil », bouton « Télécharger mes données » (fichier JSON).
- **Rectification, mise à jour, suppression** (art. 13) : modification dans votre profil ; **suppression du compte** par vous-même dans « Mon profil » (mot de passe demandé). Toute autre demande écrite reçoit une réponse **sous 30 jours**.
- **Opposition** (art. 19) : pour motifs légitimes ; aucune prospection commerciale n'est envoyée.
- **Ce que la suppression efface** : profil, numéro, annonces (sauf celles liées à un paiement, retirées de la vue publique et anonymisées), photos, favoris, recherches, alertes, messages et conversations, brouillons, pièces justificatives. **Ce qui peut subsister** : les factures et paiements (obligation comptable ⛔ durée à confirmer) ; les signalements déposés contre un compte et la trace d'actions de modération (sans votre identité directe) ; l'inscription en liste noire d'un compte banni (⛔ à confirmer).
- Recours : Autorité de protection des données à caractère personnel (APDP), Bamako.

## Sécurité
Précautions utiles (art. 8) : mots de passe hachés (scrypt), connexion chiffrée (HTTPS) en production, accès aux pièces réservé à l'équipe et tracé, sauvegardes chiffrées. Aucune sécurité n'est absolue : en cas d'incident touchant des données personnelles, ⛔ procédure d'information des personnes et de l'autorité à définir.

## Mineurs
Le service est réservé aux personnes de **18 ans ou plus** (confirmation demandée à l'inscription). Âge fixé par défaut ; à valider par un juriste malien.

## Changements
Toute modification sera publiée ici avec sa date.
