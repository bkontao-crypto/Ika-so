# Recensement des activations — 27 novembre 2026

Code de `docs/audit-analytics` (identique à `main` `36ac9f8` hors documents). Aucun code ni valeur par défaut modifié. Production non vérifiée.

**Limites :** recensement centré sur les interrupteurs, établi à partir des routes, réglages, configuration et recherches ciblées. Les boutons n’ont pas été cliqués dans un navigateur. « Essayé » = appel à l’API sur une base PostgreSQL neuve et jetable. « Code » = lecture seulement. Un interrupteur qui agit ne prouve pas que toute la fonctionnalité marche.

> **Mise à jour du 28 novembre 2026 :** sur la branche `fix/modules-crm-premium` (non fusionnée), « Module CRM » et « Module Premium » ferment désormais l’accès côté serveur, activés par défaut. La première ligne du tableau D décrit l’état antérieur, encore valable sur `main`.

## A. Interrupteurs dont l’effet a été essayé
| Fonctionnalité | Défaut (base neuve) | Commande | Constat une fois coupée |
|---|---|---|---|
| Collecte d’audience | Activée | Réglage en base ou `ANALYTICS_ENABLED=false` (pas de bouton trouvé) | Réglage en base : une page vue envoyée n’a rien écrit. Variable : non rejouée. |
| Journal de sécurité | Activé | API du bouton « Journal de connexions » | Échec de connexion non journalisé |
| Découvrir | Activé | Règles officielles | Liste vide, publication refusée (403) |
| Alertes programmées | Activées | Règles officielles | Création refusée (403). Résumés déjà en file : non vérifiés |
| Paiement en ligne | **Éteint** | Politique de paiement + fournisseur | Ouvert puis refermé avec un fournisseur factice ; aucun paiement tenté |

## B. Interrupteurs présents, effet non rejoué ici (code)
| Fonctionnalité | Défaut | Remarque |
|---|---|---|
| Badge Étoile | **Éteint** | Réglages du badge |
| Offres Premium et mise en avant (5 dans `ika_offers`) | **Éteintes** | Le paiement lit uniquement les offres actives |
| Formules de boost (4) | **Éteintes** | Réglage par formule |
| Préférences ; pixels Meta, Google, TikTok | **Éteints** | « Services et consentement » ; un pixel exige un identifiant et envoie des données à un tiers |
| Liens vidéo dans Découvrir | **Éteints** | Règles officielles |
| WhatsApp à la décision Premium | **Éteint** | Refusé tant que jeton, numéro et modèle manquent |
| Double authentification obligatoire | **Éteinte** | Ne pas l’imposer avant d’avoir vérifié la récupération (risque de blocage) |
| Demande « Devenir annonceur » obligatoire | Activée | Éteinte : tout compte peut publier |
| Campagnes | Statut par campagne | Les mises en avant publiques lisent le statut « active » |
| Pays et quartiers | Par élément | Boutons d’activation |

## C. Activation par configuration d’un fournisseur (code)
Connexion Google (identifiants et `PUBLIC_URL` en https), SMS, e-mail, fournisseur de paiement, WhatsApp, carte Mapbox. Retirer la configuration les coupe ; chaque envoi ou parcours réel reste à prouver avec le fournisseur.

## D. Interrupteurs sans effet complet : à ne pas considérer comme des coupures
| Interrupteur | Constat |
|---|---|
| « Module CRM » et « Module Premium » | **Masquent des liens seulement** (2 éléments marqués dans `compte-unifie.js`). Essayé : après coupure, les API CRM et Premium répondent encore (200, compte Super Admin). Aucun contrôle serveur ne lit ce réglage. |
| Modules « carte » et « WhatsApp » | Acceptés par le réglage, non reliés au site |
| Langues et catégories | L’écran indique qu’elles ne sont pas lues par le site public ; le code serveur ne les relit que pour leur gestion |

## E. Aucun interrupteur global identifié dans les éléments examinés
Inscription ; fenêtre d’acceptation globale à l’inscription ; publication d’annonces ; messagerie ; commentaires ; avis ; favoris ; visites ; abonnements aux annonceurs ; réclamations ; partenaires ; import d’annonces ; CRM ; demandes Premium (API) ; sauvegarde automatique et contrôle des incidents (planifiés dans `startScheduler`). Certaines ont des permissions, plafonds ou conditions : ce ne sont pas des coupures. Newsletters et diffusions partent sur action manuelle. Cette liste n’est pas garantie exhaustive.

## F. À signaler
- La règle « tout activé par défaut » n’est pas l’état actuel : les éléments en gras ci-dessus sont éteints sur une base neuve. Le réglage réel en production est inconnu.
- L’« aide à la rédaction IA » du serveur (`aiWriteAssist`) assemble des phrases à partir de modèles fixes ; elle n’appelle aucun modèle d’IA. L’« assistance » de détection repose sur des requêtes à règles.

## Preuve de fonctionnement
La suite automatisée (570/570 lors de l’audit) couvre une partie des parcours ; ce recensement n’associe pas encore chaque fonctionnalité à un test. Les fournisseurs réels et la recette dans le navigateur restent à faire.

## Suite proposée (à autoriser)
1. Activer en environnement de développement les éléments éteints sans risque : badge Étoile, offres et boosts (fournisseur factice seulement), préférences, liens vidéo. Décider à part pour les pixels, WhatsApp et la double authentification obligatoire.
2. Rendre réelles les coupures CRM et Premium (contrôle côté serveur).
3. Créer un « centre des activations » (Super Admin) : état, coupure côté serveur, journal des changements, dernière vérification.
4. Ajouter progressivement les coupures manquantes, en laissant activé par défaut ce qui l’est aujourd’hui. La sauvegarde automatique ne devrait pas être traitée comme une fonctionnalité à couper.
