# Audit de la collecte d’audience — 27 novembre 2026

Périmètre : code de `main` (`36ac9f8`). Lecture du code et essais HTTP sur une base PostgreSQL jetable. **Aucun code, réglage, migration ou donnée réelle modifié. Production non vérifiée. Ce n’est pas un avis juridique.**

## Contexte déclaré par le propriétaire
> « Le site IKA SÔ est en cours de développement. À ce stade, je n’apporte aucune garantie sur sa conformité juridique ou réglementaire. Une fois le développement terminé et avant le lancement, je produirai les différents documents juridiques nécessaires à l’activation de toutes les fonctionnalités soumises à une loi ou à une obligation juridique. »

## Résultat en bref
La collecte est **active par défaut**. Plusieurs protections fonctionnent, mais le choix présenté au visiteur et les documents ne correspondent pas entièrement au comportement du code.

## Conforme au comportement attendu (essayé)
- « Ne pas suivre » (DNT) et GPC : rien n’est écrit (une route essayée pour chacun ; le filtre est commun à l’émission des événements).
- Compte avec le choix `essential` : action enregistrée sans identifiant de compte (choix envoyé directement à l’API, voir écart 2).
- Compte avec le choix `all` : action liée au compte ; après retrait, 0 action encore liée, et la suivante est anonyme.

## Lu dans le code, non rejoué ici
- Les colonnes `visitor_id`, `session_id` et pays sont écrites à vide. L’événement ne contient ni adresse IP, ni texte saisi, ni adresse de la page d’origine (liste fermée de métadonnées).
- Suppression d’un compte : ses événements liés sont effacés. Export des données : événements du compte, limités aux 5 000 plus récents.
- L’Observatoire est réservé au Super Administrateur.

## Écarts
| N° | Priorité | Constat | Preuve | Correction proposée (non faite) |
|---|---|---|---|---|
| 1 | Critique | Sans variable `ANALYTICS_ENABLED`, la collecte est active ; le réglage en base d’une installation neuve vaut `true`. Le code cite une décision du propriétaire du 20/11/2026. Le principe 8 du cahier des charges interdit l’activation sans validation juridique. | `server/config.js`, essai | Décider : éteindre par défaut jusqu’aux documents, ou réviser explicitement le principe. En attendant, vérifier la variable sur l’hébergeur. |
| 2 | Critique avant lancement | À l’inscription (formulaire et bouton Google), la fenêtre n’offre que « Continuer » (ou fermer, ce qui annule). Continuer envoie `all` (actions liées au compte) et accepte sur l’appareil **toutes** les catégories, dont Marketing. Son texte cite les conditions et la confidentialité, pas ces choix. Le retrait se fait ensuite dans les paramètres. Le code cite une décision du 24/11/2026. | `components/data-consent.js`, `pages/login.js`, `core/consent.js` (lecture) | Avis du juriste ; si nécessaire, cases distinctes, non cochées, avec refus aussi simple que l’accord. |
| 3 | Haute | Le choix « Statistiques » du navigateur ne bloque que les pages vues. La durée de visionnage est enregistrée sans lui ; les événements émis par le serveur (fiche vue, contacts, favoris, inscription, etc.) ne le consultent pas. | essai (durée, inscription) ; `routes/index.js`, `core/analytics.js` | Définir ce que couvre le choix, puis appliquer la règle partout ou corriger le texte. |
| 4 | Haute | `POST /api/e` accepte une page vue sans preuve d’accord (le contrôle est dans le navigateur) et conserve le chemin reçu, y compris un identifiant placé dedans. | essai avec un chemin fictif | Normaliser les chemins (remplacer les identifiants), limiter aux routes connues. |
| 5 | Haute | Aucune purge automatique ni commande de rétention trouvée pour les événements bruts. Les durées proposées (12 mois) ne sont pas appliquées. | recherche dans `server/`, `scripts/`, `migrations/` | Purge par lots avec simulation, après validation de la durée. |
| 6 | Moyenne | Chiffres gonflables : trois envois identiques créent trois événements ; une durée est acceptée pour une annonce inexistante. Limites de débit par IP seulement ; robots reconnus par leur agent déclaré. | essai ; `lib/analytics-events.js` | Vérifier l’annonce, dédoublonner sur une courte fenêtre. |
| 7 | Moyenne | Documents périmés : `docs/juridique/dossier-activation-statistiques.md` (collecte « éteinte », double activation, 13 types, aucun écran ; le code compte 25 types et a des écrans), `plan-conformite.md` ligne 19, `Important/ARCHITECTURE_ANALYTICS.md`. `.env.example` indique « allumée par défaut » mais fixe `false`. Le panneau décrit les « Statistiques » comme des pages vues anonymes, alors que d’autres actions peuvent être liées à un compte. | lecture | Mettre à jour les textes après la décision sur les écarts 1 à 3. Relire aussi `projet-confidentialite.md`. |

## Non vérifié
Variables et données de production ; contenu de la politique publiée au regard de la loi ; contrôle d’accès et journalisation de chaque écran qui lit les événements (fiche utilisateur, mouvements du site, centre annonceur, entonnoir Premium) ; journaux de l’hébergeur ; pixels marketing chez les prestataires ; parcours Google réel.

## Décisions attendues du propriétaire
1. Collecte éteinte par défaut pendant le développement ? (recommandé, car conforme au principe 8)
2. Parcours de consentement à l’inscription : à revoir avec le juriste avant lancement.
3. Autoriser les corrections techniques des écarts 3 à 6 sur une branche dédiée.
