# Dossier pour le juriste — activer les statistiques d'usage d'Ika So

> **Statut : PROJET, à faire relire par un juriste malien avant toute activation.** Rédigé le 6 novembre 2026 par l'assistant de développement, qui **n'est pas juriste**. Les articles de loi cités viennent de la note de cadrage `note-cadre-juridique-mali.md` (loi n° 2013-015 du 21 mai 2013, modifiée en 2017). Une vérification en ligne du 6 novembre 2026 confirme l'existence de cette loi, de l'APDP et de ses mises en demeure pour défaut de formalités déclaratives ; ces sources sont des sites d'actualité et de synthèse (fiabilité moyenne), **pas le texte officiel**.
> Légende : ✅ fait dans le logiciel · ⬜ à faire · ⛔ avis du juriste nécessaire.

## 1. Résumé (10 lignes)
Ika So veut mesurer l'usage de la plateforme (nombre de vues d'annonces, contacts, inscriptions…) pour piloter l'activité et lutter contre les abus. Le logiciel sait maintenant enregistrer 13 types d'actions, **mais la collecte est éteinte et le restera jusqu'à votre avis**. Il faut décider : (1) si les actions d'un compte connecté peuvent être comptées sans consentement distinct ; (2) comment traiter les visiteurs non connectés (bandeau) ; (3) les durées de conservation ; (4) la formalité auprès de l'APDP ; (5) les textes à publier. Les projets de textes sont aux sections 5 et 6.

## 2. Ce que le logiciel fait aujourd'hui (vérifié dans le code)
| Sujet | État |
|---|---|
| Interrupteur | ✅ **Éteint par défaut.** Double commande : variable `ANALYTICS_ENABLED=true` **et** réglage `analytics_enabled='true'` en base. Éteint : aucune écriture. |
| Actions comptées (13) | Inscription, connexion, déconnexion, vue d'annonce, création d'annonce, favori ajouté / retiré, clic « Appeler » / « WhatsApp » (annonce ou profil), commentaire, signalement, message envoyé, demande de visite |
| Contenu d'un événement | Type, date et heure, identifiant du compte **si la personne est connectée**, identifiant de l'annonce ou de l'annonceur concerné, classe d'appareil (téléphone / tablette / ordinateur), robot oui/non, classe d'origine (direct, moteur de recherche, Facebook, Instagram, TikTok, WhatsApp, autre) |
| Ce qui n'est **jamais** enregistré | Adresse IP, cookie, adresse de la page d'origine, texte saisi (messages, avis, commentaires), mot de passe, numéro de téléphone, position GPS |
| Visiteur non connecté | ✅ Événement sans aucun identifiant (ni cookie ni empreinte) : permet de **compter**, pas de **reconnaître**. Pays, sessions et visiteurs uniques : **non collectés** (exigent un identifiant, donc un consentement) |
| « Ne pas suivre » / GPC | ✅ Respectés : aucun événement si le navigateur l'envoie (à confirmer : ⛔ question 3) |
| Droits des personnes | ✅ L'export (`/api/me/export`) contient les événements liés au compte ; la suppression du compte les efface |
| Accès aux données | ⬜ Les tableaux de bord n'existent pas encore ; aucun écran ne lit ces événements |
| Durées et purge automatique | ⬜ Non écrites (proposition section 4) |
| Consentement individuel (compte connecté) | ✅ **Écrit avec un texte provisoire** : case « Statistiques d'usage » dans « Profil », **non cochée**, facultative ; sans accord, les actions sont comptées **sans identifiant de compte** ; un refus retire l'identifiant des actions passées. Version du texte et date enregistrées (migration 027). À reformuler selon votre avis |
| Bandeau visiteur | ⬜ Non écrit : inutile tant qu'aucun identifiant de visiteur n'existe (les événements anonymes n'en portent aucun). Texte proposé section 6 pour le jour où des sessions seraient ajoutées |

## 3. Questions au juriste (par ordre d'importance)
1. ⛔ **Base du traitement pour les personnes connectées.** Le consentement exprès existe déjà à l'inscription (art. 3(3)), mais il porte sur le compte et la politique de confidentialité. Le comptage des actions d'un compte (statistiques, lutte contre la fraude) peut-il s'appuyer sur ce consentement et l'information (art. 15-16), ou faut-il un consentement distinct, facultatif et refusable sans conséquence ? *Recommandation du développeur : prévoir la case distincte « statistiques », refusable, tant que vous n'avez pas tranché.*
2. ⛔ **Visiteurs non connectés.** L'événement anonyme (sans identifiant) est-il hors du champ de la loi, ou faut-il tout de même un bandeau ? *Recommandation : bandeau avec « Accepter » et « Refuser » de même visibilité ; refus = comptage sans identifiant seulement.*
3. ⛔ **Signal « Ne pas suivre » et GPC** : faut-il les respecter ? (Le logiciel les respecte, par prudence.)
4. ⛔ **Durées de conservation** (section 4) : valider ou corriger.
5. ⛔ **Formalité auprès de l'APDP** : le traitement « statistiques d'usage » est-il couvert par la déclaration déjà prévue (plan de conformité, ligne 2) ou exige-t-il une déclaration distincte ? Quel délai, avant l'activation ?
6. ⛔ **Transfert hors du Mali** (art. 11, 31) : les événements sont stockés dans la même base que le reste. Même régime que le plan de conformité, ligne 3 (bloquant déjà).
7. ⛔ **Pays du visiteur.** Pour une répartition par pays, il faudrait une localisation approximative à partir de l'adresse IP (non conservée). Est-ce admissible, avec quelle information ? *Aujourd'hui : non collecté.*
8. ⛔ **Accès du personnel** aux statistiques individuelles (par annonceur ou par compte) : conditions, traçabilité (prévue : chaque consultation sensible est journalisée).
9. ⛔ **Lutte contre la fraude** (doublons, pics artificiels, comptes multiples) : base juridique distincte des statistiques commerciales ? Durée spécifique ?
10. ⛔ **Mineurs** : le service est réservé aux 18 ans et plus ; confirmer qu'aucune mesure supplémentaire n'est nécessaire.

## 4. Durées de conservation proposées (décision D-3, option A « équilibrée »)
| Donnée | Durée proposée | Alternatives (D-3) |
|---|---|---|
| Événements bruts (et sessions, quand elles existeront) | **12 mois** | B : 6 mois · C : 24 mois |
| Chiffres agrégés (sans identifiant de personne) | **5 ans** | B : 3 ans · C : 10 ans |
| Journal d'audit des actions de l'équipe | **5 ans** (aujourd'hui 36 mois dans la politique : à harmoniser ⛔) | B : 3 ans · C : 10 ans |
| Événements d'un compte supprimé | **Effacés avec le compte** ✅ | — |
Purge : par lots, tracée, commande manuelle d'abord (comme le nettoyage existant), jamais de minuterie sans votre accord ⬜.

## 5. Texte proposé — à ajouter à la politique de confidentialité **au moment de l'activation**
> ⛔ Ne pas publier avant validation. Aujourd'hui la politique publiée dit encore, à raison, qu'il n'y a pas d'analytique : ne la modifier qu'à l'activation.

**Statistiques d'usage.** Pour savoir comment Ika So est utilisé et pour détecter les abus, nous comptons certaines actions : inscription, connexion, consultation d'une annonce, ajout aux favoris, clic sur « Appeler » ou « WhatsApp », commentaire, signalement, message, demande de visite.
- **Ce que nous enregistrons :** le type d'action, la date et l'heure, l'annonce ou l'annonceur concerné, le type d'appareil (téléphone, tablette, ordinateur) et la provenance générale (par exemple « moteur de recherche »). Si vous êtes connecté, l'action est rattachée à votre compte. [⛔ à ajuster selon la réponse à la question 1]
- **Ce que nous n'enregistrons pas :** votre adresse IP, vos messages ou textes saisis, votre numéro de téléphone, votre position, ni aucun cookie de suivi. Aucun service de statistiques extérieur n'est utilisé.
- **Pourquoi :** mesurer l'activité de la plateforme, améliorer le service et détecter les comportements abusifs. Nous ne vendons ni ne cédons ces données.
- **Qui y a accès :** l'équipe d'administration autorisée ; la consultation de données individuelles est enregistrée.
- **Combien de temps :** 12 mois pour le détail de chaque action ; 5 ans pour des chiffres globaux qui ne permettent pas de vous identifier. [⛔ durées à valider]
- **Votre choix :** vous pouvez refuser les statistiques [bandeau / réglage du profil]. Votre navigateur peut aussi envoyer « Ne pas suivre » : nous le respectons. Refuser n'a aucune conséquence sur votre usage du service.
- **Vos droits :** accès (le détail de vos actions est inclus dans « Télécharger mes données »), suppression (effacé avec votre compte), opposition, recours auprès de l'APDP.

## 6. Textes proposés pour le consentement
**Bandeau (visiteur, première visite) — deux boutons identiques en taille et en importance :**
> **Ika So compte certaines actions pour s'améliorer.** Nous n'enregistrons ni votre adresse IP ni vos messages, et nous n'utilisons aucun service extérieur. [En savoir plus]
> [ Refuser ]  [ Accepter ]
> *Refuser ne change rien à votre usage. Vous pouvez changer d'avis dans « Mon profil ».*

**Réglage dans « Mon profil » (compte connecté) :**
> ☐ J'autorise Ika So à rattacher mes actions (annonces vues, favoris, contacts) à mon compte pour produire des statistiques. *Facultatif, non précoché, modifiable à tout moment.*

Règles techniques en place : case non précochée ; date et version du texte enregistrées (migration 027) ; refus ou absence de choix = comptage sans identifiant ; refus ultérieur = identifiant retiré des actions passées ; aucun écran bloqué.

## 7. Liste de contrôle technique avant activation
| # | Point | État |
|---|---|---|
| 1 | Interrupteur double, éteint par défaut ; `.env.example` à `false` | ✅ |
| 2 | « Ne pas suivre » / GPC respectés | ✅ |
| 3 | Aucune IP, cookie, texte saisi ou page d'origine dans les événements (test automatique) | ✅ |
| 4 | Export et suppression couvrent les événements d'un compte (test automatique) | ✅ |
| 5 | Essai sur PostgreSQL des migrations 021 à 026 et de l'insertion des événements | ⬜ **bloquant** |
| 6 | Réglage du profil écrit (texte provisoire), date + version du choix enregistrées ; **texte final du juriste à reporter** ; bandeau visiteur seulement si des identifiants de visiteur sont ajoutés | 🟡 |
| 7 | Les événements d'un compte sans accord ne sont pas rattachés au compte (test automatique) | ✅ |
| 8 | Purge de rétention (commande manuelle, simulation d'abord) | ⬜ |
| 9 | Contrôle d'accès et journal de consultation des statistiques individuelles | ⬜ |
| 10 | Politique de confidentialité mise à jour (section 5) et plan de conformité à jour | ⬜ après avis |
| 11 | Formalité APDP effectuée | ⛔ |
| 12 | Essai de restauration des sauvegardes (plan de conformité, ligne 18) | ⬜ |

## 8. Procédure d'activation et retour arrière
1. Avis écrit du juriste ; formalité APDP ; textes validés ; points 5 à 12 ci-dessus terminés.
2. Sauvegarde vérifiée (`scripts/backup.sh`), puis publication des textes.
3. Activation en deux temps : réglage en base (`analytics_enabled = true`), puis variable d'environnement `ANALYTICS_ENABLED=true` et redémarrage. La date de début de collecte est à renseigner à la main dans le réglage `analytics_start_date` (le logiciel ne l'écrit pas).
4. Surveillance : le service tient des compteurs internes (enregistrés / ignorés / échecs) mais **aucun écran ne les affiche encore** ⬜ ; en attendant, surveiller la taille de la table et les ralentissements.
5. **Arrêt immédiat à tout moment** : remettre `ANALYTICS_ENABLED=false` (ou le réglage à `false`) ; aucune migration à défaire. Effacement complet : `scripts/rollback/023_evenements_sessions_down.sql` (⚠ supprime tout ce qui a été collecté).
