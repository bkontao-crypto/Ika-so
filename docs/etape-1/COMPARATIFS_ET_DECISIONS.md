# Comparatifs et décisions sourcées — Étape 1 (v0.2)

**Méthode :** 3 recherches web le 11 novembre 2026 (marché, paiement, cartographie). Les informations sont **paraphrasées** ; chaque ligne porte une note de fiabilité : **A** source officielle · **B** presse ou analyse indépendante · **C** blog commercial ou fournisseur (à confirmer). **Aucune source officielle de fournisseur (CinetPay, PayDunya, Mapbox, Orange, Moov) n'a été consultée : tout chiffre ci-dessous est à confirmer à la source avant décision d'achat.** Aucun concurrent n'a été parcouru en navigateur : le benchmark d'interface reste à compléter (étape 2).

## 1. Marché immobilier en ligne au Mali et en Afrique de l'Ouest
| Constat | Source | Fiab. | Conséquence pour IKA SO |
|---|---|---|---|
| Plusieurs portails existent au Mali : Se Loger au Mali et bamako-immobilier.com cités en tête (date de l'infographie non vérifiée) ; CoinAfrique et Tadiago pour les petites annonces | onlinemarketplaces.com/articles/infographic-top-property-portals-of-africa/ ; apps.apple.com/ci/app/tadiago/id6744528036 | B / A | Se positionner sur la **confiance** (vérification, profils annonceurs, avis) plutôt que sur le seul volume |
| Afribaba : consultation sans compte ; compte requis pour publier, modifier et répondre aux messages ; tableau de bord des annonces actives, expirées ou supprimées | clubic.com/telecharger-fiche594196-afribaba.html | B | Conserver la consultation sans compte et l'espace « Mes annonces » avec statuts |
| Un article sur Lagos (2019) décrit des portails comme de simples supports publicitaires où les annonces expirent rarement, ce qui expose les utilisateurs | techcabal.com/fr/2019/11/14/La-promesse-non-tenue-des-services-immobiliers-num%C3%A9riques-%C3%A0-Lagos/ | B (ancien, Nigeria) | **Expiration automatique** des annonces et signalement des biens indisponibles comme différenciateurs |
| Un acteur kényan (Reemio) précise qu'il n'est pas agent immobilier et n'intervient pas dans les transactions | wearetech.africa (article Reemio) | B | Afficher clairement le rôle d'IKA SO : intermédiaire d'information, pas partie à la transaction |
| Un blog rappelle que les offres entre particuliers sont des annonces, pas des prix constatés | blog.iambeezy.app/fr/louer-logement-cout-reel-bamako-mali-2026/ | C | Garder le libellé « prix déclarés » partout (ordonnance 1.0) |

## 2. Paiement (Premium, mise à la une)
| Constat | Source | Fiab. |
|---|---|---|
| Orange Money et Moov Money sont présentés comme les deux portefeuilles à couvrir au Mali, Orange en premier | kolonell.com/fr/blog/accepter-paiement-mali-bamako-mobile-money-2026 ; cartdna.com/fr-fr/shopify-payment-guide/africa/mali | C |
| CinetPay et PayDunya couvrent Orange Money, Moov et carte ; frais annoncés ≈ 2,5 % + 100 FCFA (CinetPay) et ≈ 3 % (PayDunya) ; CinetPay plus large en nombre de pays | kolonell.com/fr/blog/comparatif-agregateurs-paydunya-cinetpay-bamako-2026 ; …/choisir-agregateur-mobile-money-afrique-ouest-2026 | C (source unique, commerciale) |
| Point d'attention cité : stabilité des rappels (webhooks) et fraîcheur des statuts | même source | C |

**Décision proposée D-E1-01 :** conserver CinetPay et PayDunya (déjà intégrés, aucun actif par défaut). Avant toute activation (étape 8) : confirmer auprès de chaque fournisseur la couverture Mali, les frais, les délais de règlement et la procédure de test ; rejouer le parcours complet en bac à sable ; ne rien activer sans votre accord.

## 3. Cartographie
| Constat | Source | Fiab. |
|---|---|---|
| Mapbox : 50 000 chargements de carte web et 100 000 requêtes de géocodage **temporaire** par mois inclus ; au-delà ≈ 5 $ / 1 000 chargements | storerocket.io/learn/mapbox-pricing ; usagepricing.com/blueprint/mapbox | B/C |
| Le géocodage **permanent** (résultats conservés en base) n'a **aucun** quota gratuit (≈ 5 $ / 1 000) | mêmes sources | B/C |
| Alternative sans licence : MapLibre + OpenStreetMap, mais les serveurs publics d'OpenStreetMap ne sont pas un service de production : tuiles et hébergement à fournir | storerocket.io/learn/google-maps-api-alternatives | C |
| Couverture détaillée de Bamako et du Mali : **non trouvée, à vérifier** | — | — |

**Décision proposée D-E1-02 :** conserver Mapbox GL (jeton public) avec surveillance des quotas ; **ne pas stocker de résultats de géocodage Mapbox** (payant) : s'appuyer sur la table de lieux locale (migration 058) et sur la saisie du propriétaire ; garder la carte locale de secours ; étudier MapLibre auto-hébergé à l'étape 5 après test de couverture réelle sur Bamako.

## 4. Autres décisions de l'étape
- **D-E1-03 Parcours public :** consultation sans compte, compte requis pour publier, contacter et répondre (pratique du marché, déjà en place).
- **D-E1-04 Matrice Owner Center :** 32 modules délégables, 12 réservés au Superadmin (voir `MATRICE_DROITS.md`) → **DEC-003**, par défaut appliquée si vous ne répondez pas.
- **D-E1-05 Modèle « Mes biens » :** introduire une entité « bien » distincte de « l'annonce » (un bien peut avoir plusieurs annonces successives), liée en option aux annonces existantes pour ne rien casser → **DEC-004**, par défaut appliquée à l'étape 3.
