# Consentement à l'inscription : constats et options

28 novembre 2026 — base `main` `eff3d40`. **Aucun code modifié. Ce n'est pas un avis juridique.** La déclaration du propriétaire et la règle « tout activé pendant le développement » restent en vigueur.

## Constats (lecture du code)

| # | Constat | Source |
|---|---|---|
| 1 | La fenêtre n'offre qu'un bouton, « Continuer ». La fermer annule l'inscription. | `components/data-consent.js` |
| 2 | Son texte cite les conditions et la politique de confidentialité. Il ne nomme ni la collecte de données ni les catégories. La phrase « Vous pourrez les désactiver » ne dit pas clairement ce que « les » désigne. | idem |
| 3 | « Continuer » accepte sur l'appareil Préférences, Statistiques, Cartes et Marketing. | `pages/login.js`, `core/consent.js` |
| 4 | **Défaut :** il remplace aussi un refus déjà enregistré. Reproduit sur la logique : après « Tout refuser » (aucune catégorie), `acceptAllConsent` les accepte toutes. | `core/consent.js` |
| 5 | **Défaut :** le bouton Google est affiché aussi en mode Connexion. Un membre existant qui se connecte ainsi ré-accepte donc tout sur son appareil. Établi par lecture ; parcours Google non joué. La connexion par e-mail n'est pas concernée. | `pages/login.js` |
| 6 | Côté serveur, un nouveau compte reçoit « Collecte de mes données : acceptée ». Effet constaté dans la mesure d'audience : les actions sont rattachées au compte. Le choix serveur d'un compte existant n'est pas réécrit à la connexion. | `accounts.js`, `analytics.js` |
| 7 | Le serveur accepte déjà un refus (`essential`) ; les écrans web ne le proposent pas à l'inscription. | `accounts.js` |
| 8 | La version de texte enregistrée est `stats-2026-11-06-provisoire`. Elle ne correspond pas à une version identifiée de la fenêtre actuelle, ce qui affaiblit la trace. | `analytics.js` |
| 9 | Existant et fonctionnel dans le code : « Gérer mes choix » (dont « Tout refuser ») et l'interrupteur « Collecte de mes données » dans le profil. | `consent-panel.js`, `mon-profil.js` |

Le code cite une décision du propriétaire pour l'écran unique (23/11) et l'acceptation de toutes les catégories (24/11). Toute option qui la change exige son accord.

## Repères légaux à faire vérifier
Loi malienne n° 2013-015, [copie hébergée par l'AMRTP](https://amrtp-mali.com/wp-content/uploads/2025/08/LOI-2013-015.pdf). Lecture par extraction automatique : texte intégral non contrôlé.
- Art. 3, 3° : le consentement est défini comme « toute manifestation de volonté expresse, non équivoque, libre, spécifique et informée ».
- Art. 15 : informations dues lors de la collecte. Art. 18 : information sur le stockage dans l'appareil et les moyens de s'y opposer. Art. 19 : opposition, dont la prospection.
- L'extraction n'a pas trouvé d'article général disant quand le consentement est obligatoire : **ne pas en conclure qu'il ne l'est pas**.
- La [loi n° 2017-070](https://sgg-mali.ml/JO/2017/mali-jo-2017-53.pdf) modifie les art. 21, 25, 36, 42 et 49 (l'Autorité). D'autres modifications n'ont pas été recherchées de façon exhaustive.

Questions au juriste : un bouton unique suffit-il ? Faut-il un accord distinct pour le marketing et pour les envois à des sociétés étrangères (art. 11) ? Quelles déclarations à l'APDP (art. 57) ?

## Options

| Option | Contenu | Pour | Contre |
|---|---|---|---|
| A. Ne rien changer | Attendre le lancement | Aucun travail ; tests inchangés | Les refus continuent d'être écrasés |
| B. Respecter un choix existant | Si un choix valide existe sur l'appareil, le conserver. Sinon, comportement actuel. | Petite correction ; premier visiteur toujours « tout activé » ; texte inchangé | Ne traite ni 1, 2 ni 8 ; choix serveur du nouveau compte toujours « acceptée » |
| C. Deux boutons | « Tout accepter » et « Continuer sans les options », de même importance ; les deux créent le compte. Texte et version de texte à jour. | Refus réel ; reste un seul écran ; serveur déjà prêt | Texte à valider ; règle à fixer pour les connexions Google (reprendre B) |
| D. Cases distinctes | Une case non cochée par finalité, conditions à part | Choix le plus détaillé | Écran plus long ; moins de fonctions activées pendant les essais |

**Proposition technique :** B maintenant, puis C ou D avant le lancement selon le juriste. B ne rend pas à lui seul le parcours conforme.

**Limite de B :** il protège un choix encore enregistré dans ce navigateur (six mois). Un autre appareil, un stockage effacé ou un choix expiré sont traités comme une première visite.

**Application Android :** son code transmet le choix reçu de la fenêtre du site. C et D demanderaient de vérifier ce parcours.
