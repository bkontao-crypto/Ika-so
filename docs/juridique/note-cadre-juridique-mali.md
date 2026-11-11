# Note de cadrage juridique — Ika So (Mali)

> **Statut de ce document.** Étude de cadrage rédigée le 3 novembre 2026 par l'assistant de développement, **qui n'est pas un juriste et ne peut pas engager une responsabilité professionnelle**. Elle s'appuie sur des textes maliens lus en ligne le jour même (sources en fin de document), souvent via des extraits ou des résumés : **tout article cité doit être revérifié sur le texte officiel avant usage**. Elle sert à (1) concevoir le logiciel et les procédures dans le bon sens, (2) donner à votre avocat ou notaire une liste précise de points à trancher. Elle ne remplace pas leur avis.
>
> Légende : ✅ lu dans une source citée · 🟡 rapporté par la presse ou un résumé, texte non lu · ❓ non vérifié · ⛔ décision ou avis de professionnel nécessaire.

## 1. Ce qu'est (et ce que n'est pas) Ika So

**Position recommandée : plateforme d'annonces, intermédiaire technique — pas agent immobilier, pas promoteur, pas notaire, pas établissement de paiement.**

Pourquoi cette position compte :
- La loi malienne sur la lutte contre le blanchiment (Loi n° 2016-008 du 17 mars 2016, art. 5) vise « les sociétés immobilières et les agents immobiliers y compris les agents de location » ✅ (via la ligne directrice de la CENTIF). Une plateforme qui toucherait des commissions sur les ventes, négocierait pour le compte des parties ou encaisserait des acomptes entrerait dans une zone d'assujettissement (identification des clients, déclaration de soupçon, conservation 10 ans, contrôle par la DNUH).
- La promotion immobilière exige un agrément et une carte professionnelle (Loi n° 99-040 du 10 août 1999, modifiée par la loi n° 2018-056 du 11 juillet 2018, art. 7) ✅ ; vendre sur plan avec versements avant achèvement exige la forme notariée à peine de nullité (art. 46) ✅.
- **Règles de conception qui en découlent (déjà respectées par le logiciel, à ne pas casser)** : Ika So n'encaisse jamais d'argent d'une partie pour l'autre ; il ne prend aucune commission sur une transaction ; il ne négocie pas ; il vend seulement un service de visibilité (mise à la une) ; il n'affiche pas de « programme neuf » en VEFA (voir §6).
- ⛔ Si un jour le modèle économique change (commission, séquestre, paiement d'acomptes), il faut un avis préalable : agrément, LBC/FT, établissement financier.

**Point de vigilance (qualification d'éditeur ou d'hébergeur).** La loi n° 2016-012 du 6 mai 2016 sur les transactions, échanges et services électroniques exonère les intermédiaires techniques d'une obligation générale de surveillance (art. 48) 🟡. Or Ika So **relit chaque annonce avant publication** : cette pré-modération le rapproche d'un éditeur et peut lui faire perdre le bénéfice de cette protection. ⛔ À arbitrer avec l'avocat : (a) assumer une responsabilité d'éditeur et le dire ; (b) ou adopter une modération a posteriori + procédure de signalement. Le logiciel permet les deux. En attendant, procédure de retrait rapide (§7).

## 2. Données personnelles — Loi n° 2013-015 du 21 mai 2013 (modifiée en 2017 ❓)

Autorité : APDP (art. 20, 27 ; sites : apdp.ml) ✅. Lu dans le texte du Journal officiel n° 26 de 2013 (via extraction automatique) :

| Obligation | Article | Ce que cela impose à Ika So | Où c'est traité |
|---|---|---|---|
| Collecte loyale, finalités déterminées, exactitude, **durée limitée** | 7 ✅ | Ne garder que le nécessaire, pas plus longtemps que nécessaire | `docs/juridique/projet-confidentialite.md` ; durées ⛔ |
| **Consentement** : « expresse, non équivoque, libre, spécifique et informée » | 3(3) ✅ | Case à cocher à l'inscription, **non précochée**, avec date et version enregistrées | **Développé** (migration 016) |
| **Information au moment de la collecte** (identité du responsable, finalités, destinataires, caractère obligatoire ou facultatif, droits, durée) | 15, 16 ✅ | Page « Confidentialité » liée au formulaire d'inscription | **Développé** (`/confidentialite`) ; contenu ⛔ |
| **Accès** gratuit, « sans délai » | 12 ✅ | Export des données du compte | **Développé** (`GET /api/me/export`) |
| **Rectification, mise à jour, verrouillage, suppression** ; réponse **sous 30 jours** ; charge de la preuve au responsable | 13 ✅ | Suppression du compte en libre-service ; sinon traitement manuel ≤ 30 jours | **Développé** (`POST /api/me/delete`) |
| **Opposition** pour motifs légitimes ; information et opposition sans frais pour la **prospection** | 19 ✅ | Aucune prospection commerciale n'est faite aujourd'hui ; ne pas en ajouter sans case dédiée | Règle ; alertes = service demandé par l'utilisateur |
| **Sécurité** : « toutes les précautions utiles » ; sous-traitants à garanties suffisantes | 8 ✅ | Hachage scrypt, HTTPS, accès aux pièces tracé, sauvegardes chiffrées ; **contrats avec hébergeur, base, SMS** | Technique : fait ; contrats ⛔ |
| **Déclaration préalable** des traitements à l'APDP | 33, 57 ✅ | **Déclarer le traitement avant l'ouverture** (défaut de mauvaise foi : sanction administrative) | ⛔ formalité à accomplir |
| **Transfert hors du Mali** : seulement vers un pays au « niveau suffisant de protection » constaté par l'APDP, ou autorisation de l'APDP | 11, 31 ✅ | **Render, Neon, Twilio (ou équivalents) hébergent hors du Mali** : un transfert est probable dès le premier compte | ⛔ **point bloquant à trancher avec l'avocat** (autorisation APDP, clauses contractuelles, ou hébergeur local) |
| Données sensibles : interdites sauf dérogation | 9 ✅ | Ika So ne demande ni santé, ni opinion, ni origine. Les pièces foncières ne sont pas, en soi, « sensibles » ❓ | Ne jamais ajouter de champ sensible |
| Décision fondée **uniquement** sur un traitement automatisé de profilage | 2 ✅ | Aucune décision automatique : modération humaine, alertes de prix seulement indicatives | Respecté (le logiciel ne bloque jamais seul) |
| Sanctions | 59–67 ✅ | Avertissement, mise en demeure, **injonction de cesser**, retrait d'agrément ; **amendes pénales de 5 à 20 M FCFA** (collecte frauduleuse, détournement de finalité, communication à des tiers non autorisés) et **2,5 à 10 M FCFA** (défaut de précautions de sécurité) | Raison de ne pas improviser |

**Ce que le logiciel fait déjà bien** : aucune IP stockée ni journalisée, aucun traceur ni ressource tierce, mots de passe hachés, pièces réservées au personnel avec traçabilité, numéro de téléphone jamais sur les pages publiques.

**⚠ Tension à arbitrer (journaux et IP).** La loi de 2016 contient, d'après l'analyse lue, une « obligation de coopération et de conservation temporaire des données » des prestataires 🟡 ❓. Ika So ne conserve **aucune** adresse IP par choix de confidentialité. ⛔ L'avocat doit dire si une obligation légale de conservation des données de connexion s'applique à Ika So (ou seulement à l'hébergeur/au fournisseur d'accès). Le logiciel peut, si nécessaire, enregistrer ces données dans une table séparée, chiffrée, à durée courte : **ne pas le faire sans avis**, car c'est une collecte supplémentaire.

## 3. Terrains et logements — le fond du métier

Textes lus : Code domanial et foncier (Ordonnance n° 00-027/P-RM du 22 mars 2000 ❓ numéro à vérifier ; version consolidée 2016, extrait jusqu'à l'art. 178) ✅.

- **Titre foncier** : l'immatriculation est définitive (art. 76) ; le titre est « définitif et inattaquable » et point de départ des droits réels (art. 169) ; une revendication fondée sur un droit non révélé pendant la procédure est irrecevable (art. 170) ; en cas de dol, seule une action personnelle en indemnité est ouverte (art. 171) ; en cas de double immatriculation, **la première régulière prévaut** (art. 170 bis, 170 quater) ✅.
- **Vente** : les actes constituant, transférant ou éteignant des droits réels doivent être **authentiques** pour être inscrits (art. 174) et mentionner identité, capacité et **numéro du titre foncier** (art. 175) ; les droits réels ne sont opposables aux tiers qu'après **publication** (art. 89, 173) ✅. L'inscription suppose que l'acte émane du **titulaire d'une inscription antérieure régulière** (art. 178) ✅.
- **Droits coutumiers** : confirmés (art. 43) mais transmissibles seulement selon la coutume (art. 46) ✅ — ils ne sont pas des titres de propriété immatriculés.
- **Concession urbaine/rurale à usage d'habitation** : droit de **superficie**, **pas** la propriété (art. 61) ; transmissible par acte authentique (art. 63 bis) ✅.
- **Permis d'occuper** : le Code ne le mentionne que pour sa transformation en titre définitif après mise en valeur (art. 35) ✅ ; **« lettre d'attribution » et « titre d'occupation » ne figurent pas** dans l'extrait lu ✅. 
- **Réforme en cours (2021 →)** 🟡 : selon la presse, le ministre de l'Urbanisme déclare que « le seul acte valable aujourd'hui au Mali, c'est le titre foncier », que les actes délivrés par maires, préfets, sous-préfets et chefs de village ne sont plus valables, et que l'immatriculation devient systématique (Bamako zone par zone). **Aucun texte (numéro, date, mesures transitoires) n'a été trouvé** : ❓ ⛔ l'avocat/notaire doit confirmer l'état exact du droit et le sort des permis d'occuper et lettres d'attribution déjà délivrés.

**Conséquence de conception (décidée dans le logiciel).** Le badge ne peut honnêtement porter que sur un **titre foncier** vérifié auprès du service compétent. Il est donc renommé **« Titre foncier contrôlé »**, n'est accordé que si l'annonceur a déclaré « Titre Foncier », et la procédure de contrôle l'exige expressément (voir `procedure-controle-badges.md`). Tout autre document reste « déclaré par l'annonceur, sans garantie ». Cela évite d'afficher une assurance que le droit actuel ne soutient pas.

**Délais et recours à rappeler aux acheteurs (guides)** : retrait dans les deux mois suivant la publicité de la vente (art. 93) ✅ ; droit de revendication limité après immatriculation (art. 170) ✅ ; passer par un notaire pour l'acte authentique (art. 174).

## 4. Annonces, agences et courtage

- ✅ Aucun texte spécifique à la profession d'**agent/courtier immobilier** n'a été trouvé (la loi sur la promotion immobilière ne les régit pas expressément) ❓ : la recherche n'est pas concluante — ⛔ à demander à la DNUH (autorité de contrôle désignée par le décret n° 2021-0681/PT-RM du 24 septembre 2021, selon la CENTIF ✅) et à l'avocat : une agence doit-elle détenir une carte, un agrément, une inscription particulière ?
- Les agences sont **assujetties à la LBC/FT** (Loi 2016-008 art. 5 ✅). La ligne directrice de la CENTIF demande, pour une personne morale : acte de forme juridique, **RCCM**, **NIF**, pouvoirs des représentants, **extrait RCCM de moins de 3 mois** ✅. Ika So s'aligne : pour le badge « Agence vérifiée », exiger un **extrait RCCM de moins de 3 mois** et le NIF, et rappeler dans les conditions que l'agence reste seule responsable de ses obligations LBC/FT (identification de ses clients, déclaration de soupçon, conservation 10 ans, virement ou chèque au-delà du seuil fixé par le ministre des Finances — art. 14 ✅, seuil ❓ ; déclaration à la CENTIF des espèces ≥ 15 000 000 FCFA ✅).
- Ika So n'est **pas** lui-même assujetti tant qu'il reste dans le périmètre du §1 ❓ (⛔ à confirmer).

## 5. Contrat en ligne avec les utilisateurs — Loi n° 2016-012

D'après l'analyse lue 🟡 (155 articles, dix titres) :
- **Rétractation de 14 jours calendaires** pour le destinataire d'un contrat à distance, sans motif ni frais (art. 72) ; exceptions : biens personnalisés, périssables (art. 75) ; **les services exécutés immédiatement ne sont pas évoqués dans l'analyse** ❓. La mise à la une démarre dès le paiement. ⛔ Avocat : le consommateur peut-il renoncer à la rétractation pour un service pleinement exécuté ? En attendant : **rembourser sur demande dans les 14 jours** (le logiciel sait retirer la mise à la une et noter le remboursement).
- Information avant conclusion + confirmation du contrat (Titre IV, ch. III) ; **mentions obligatoires de l'éditeur** (Titre V, ch. III, liste non lue ❓) : prévoir une page **Mentions légales** (identité, forme juridique, adresse, RCCM/NIF, contact, directeur de publication, hébergeur) ⛔ à compléter.
- **Prospection électronique** en principe interdite sans consentement (Titre II), avec droit d'opposition gratuit ✅🟡 : aucune prospection aujourd'hui ; les alertes demandées par l'utilisateur (recherche enregistrée) sont un service sollicité.
- **Loi sur la cybercriminalité** (Loi n° 2019-056 du 5 décembre 2019 ❓ numéro et contenu non lus) : à faire examiner (infractions liées aux contenus, obligations de coopération, conservation des données).

## 6. Ce qu'Ika So s'interdit (garde-fous de conception)

1. Aucun versement d'acompte, de séquestre ou de commission via la plateforme.
2. Aucune annonce de **vente sur plan (VEFA)** : elle exige l'agrément du promoteur (art. 7) et la forme notariée (art. 46). Si un promoteur veut publier, ⛔ prévoir un champ « numéro d'agrément » vérifié avant publication.
3. Aucun badge « sécurisé », « garanti », « certifié » : seulement « déclaré » ou « contrôlé » avec la portée écrite.
4. Aucune donnée sensible, aucune prospection, aucun transfert non couvert.

## 7. Procédure de signalement et de retrait (« notice and takedown »)

Proposition à valider : tout signalement d'annonce, de commentaire ou de personne est traité par un modérateur **sous 48 heures** ; retrait immédiat si l'illégalité est manifeste (fraude, bien d'autrui, contenu illicite) ; le signalant et l'annonceur sont informés ; le motif est tracé (journal d'audit) ; conservation des éléments utiles à une réquisition judiciaire pendant une durée ⛔ à fixer ; point de contact légal publié dans les mentions légales. Le logiciel couvre le signalement, le retrait, la restriction, la liste noire et la traçabilité ; **le délai de 48 h est un engagement humain** à tenir.

## 8. Questions précises à poser à l'avocat / au notaire (liste de travail)

1. **Transfert à l'étranger** : quelle formalité APDP pour héberger chez Render/Neon/Twilio ? Hébergeur au Mali obligatoire ?
2. **Déclaration APDP** : modèle, délai, coût ; faut-il un correspondant ?
3. **Conservation des données de connexion** : obligation applicable à Ika So ? Durée ?
4. **Statut éditeur/hébergeur** avec pré-modération ; clause de responsabilité acceptable.
5. **Documents fonciers** : état actuel du droit sur permis d'occuper, lettre d'attribution, attestations de vente, actes des maires/chefs de village ; liste des pièces valables pour une annonce.
6. **Agences** : carte/agrément exigés ? rôle de la DNUH ?
7. **Rétractation et services numériques** ; mentions légales ; facturation (TVA, mentions) ; forme sociale de l'éditeur.
8. **Durées de conservation** (comptes, messages, pièces, factures ; l'obligation comptable de 10 ans est à confirmer ❓).
9. **Âge minimal et capacité** : 18 ans proposé ❓.
10. **Loi applicable et juridiction** ; médiation/arbitrage en ligne (art. 152 ❓).
11. **Cybercriminalité** : obligations de coopération et de signalement.

## Sources consultées (3 novembre 2026)
- Loi n° 2013-015 (Journal officiel du Mali n° 26 de 2013) : <https://sgg-mali.ml/JO/2013/mali-jo-2013-26.pdf> ; présentation de l'APDP : <https://primature.ml/apdp-autorite-de-protection-des-donnees-a-caractere-personnel/> ; <https://www.africadataprotection.org/pays/mali.html>
- Code domanial et foncier (consolidé 2016, extrait) : <https://sgg-mali.ml/codes/mali-code-domanial-foncier-2000-maj-2016.pdf>
- Réforme domaniale (presse) : <https://bamada.net/lutte-contre-les-litiges-fonciers-au-mali-les-nouvelles-reformes-domaniales-fixent-le-titre-foncier-comme-seul-acte-de-propriete-valable>
- Ligne directrice LBC/FT du secteur immobilier (CENTIF) : <https://centif.ml/wp-content/uploads/2023/04/Ligne-directrice-immobilier.pdf>
- Loi n° 2016-012 (analyse de Kamena) : <https://regnum-ms.com/caren/static/aml/resources/files/CAREN/01.Mardi16/02SessionESSORCommerceElectroniq/03__Kamena__%20Analyse_de_la_loi_de_2016_relative_aux_transactions__echanges_et_services_electroniques_au_Mali.pdf>
- Loi régissant la promotion immobilière (n° 99-040 modifiée) : <https://sgg-mali.ml/autres-textes-consolides/loi-rgissant-la-promotion-immobilire.pdf>
- Non lus ou non accessibles : texte intégral de la loi 2016-012, loi sur la cybercriminalité de 2019, droit de la consommation, code pénal (escroquerie, faux), fiscalité de l'enregistrement des mutations, textes de la réforme foncière 2021.
