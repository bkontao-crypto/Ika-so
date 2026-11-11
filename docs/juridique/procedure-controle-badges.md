# Procédure de contrôle des badges — version 2 (cadrée sur le droit malien)

> Projet à valider par le propriétaire, un notaire et un avocat. S'appuie sur `note-cadre-juridique-mali.md` (articles cités et niveau de vérification). Le logiciel impose déjà : contrôle humain, note de contrôle obligatoire, retrait automatique si l'annonce est modifiée, traçabilité de chaque ouverture de pièce.

## 0. Principe directeur
Un badge est une **affirmation de l'éditeur** qui engage sa responsabilité. Il ne doit donc dire que ce qui a été réellement vérifié, auprès d'une source qui fait foi. En droit malien, le **titre foncier** est l'acte qui fait foi : immatriculation définitive (Code domanial et foncier, art. 76), titre « définitif et inattaquable » (art. 169), vente par acte authentique mentionnant le numéro du titre (art. 174-175), publication nécessaire pour opposabilité (art. 89, 173). Les autorités indiquent en outre qu'il est désormais le seul acte de propriété valable (déclaration ministérielle rapportée par la presse, texte non retrouvé ❓).

| Badge affiché | Ce qu'il dit | Ce qu'il ne dit pas |
|---|---|---|
| **Titre foncier contrôlé** | Un membre de l'équipe a rapproché le titre foncier annoncé d'une source officielle à la date indiquée, et le nom du titulaire de celui de l'annonceur (ou d'un mandat). | Pas de garantie d'absence d'hypothèque, de litige, de double vente ; pas un avis juridique ; valable à la date du contrôle seulement. |
| **Agence vérifiée** | L'existence et l'immatriculation de l'agence au RCCM ont été contrôlées. | Pas de garantie de qualité ni de conformité à la réglementation de la profession ou à la LBC/FT. |

Tout autre document (lettre d'attribution, permis d'occuper, attestation de vente, bail, « en cours de régularisation ») reste **« déclaré par l'annonceur, sans garantie »** : aucun badge. Cette règle est appliquée par le logiciel : l'acceptation d'une pièce foncière est **refusée** si l'annonce n'a pas déclaré « Titre Foncier ».

## 1. Titre foncier — étapes

| # | Étape | Qui | Preuve conservée |
|---|---|---|---|
| 1 | Ouvrir la pièce (journalisé). Vérifier : document complet, lisible, **numéro du titre foncier**, désignation du bien, titulaire, mentions d'inscriptions. Refuser si illisible, tronqué ou retouché. | Modérateur | Motif de refus |
| 2 | **Source officielle** : demander à l'annonceur une copie récente du titre ou un **certificat d'inscription / état des droits** de moins de 3 mois (règle interne ; par analogie avec l'extrait RCCM de la CENTIF), et rapprocher avec le service des Domaines et du Cadastre / la conservation foncière compétente (visite, courrier, ou vérification déléguée à un notaire partenaire). ⛔ Mode de vérification retenu et coût à décider. | Modérateur ou notaire partenaire | N° du titre, organisme, date de vérification, agent rencontré |
| 3 | **Titulaire** : le nom au titre = nom de l'annonceur (pièce d'identité vue, ex. carte NINA, passeport) **ou** mandat écrit/procuration du titulaire. Si l'annonceur est un héritier ou un acquéreur non inscrit : pas de badge (le droit réel n'est opposable qu'après publication, art. 89, 173, 178). | Modérateur | Type de pièce d'identité vue (jamais recopier son numéro) |
| 4 | **Indices de risque** : bien déjà annoncé par un autre compte, prix très inférieur au marché (alertes automatiques), titulaire décédé/mineur, pression pour payer vite, refus de visite. → ne pas accepter sans second avis. | Modérateur | Alerte fermée avec note |
| 5 | **Décision** : *Accepter* avec une note datée du type « TF n° … de … ; vérifié auprès de … le … ; titulaire = annonceur (CNI vue) ; état des droits < 3 mois ». Sans note, le logiciel refuse. | Modérateur | Note (dans le journal) |
| 6 | **Cas douteux ou contradiction** : *Refuser* avec motif ; si fraude probable → administrateur : restriction/blocage, liste noire, et ⛔ signalement aux autorités à décider. | Administrateur | Journal d'audit |

**Fin de validité** : le badge tombe si l'annonce est modifiée (automatique). ⬜ Recommandation : le faire expirer à **90 jours** après le contrôle (non automatisé aujourd'hui).

## 2. Agence — étapes

| # | Étape | Preuve |
|---|---|---|
| 1 | Demander : **extrait RCCM de moins de 3 mois**, NIF, pouvoirs du gérant/représentant, pièce d'identité du représentant (exigences de la ligne directrice CENTIF pour une personne morale ✅). | Types de pièces, dates |
| 2 | Rapprocher raison sociale, numéro RCCM, activité déclarée (**activité immobilière**), gérant, avec le registre (greffe du tribunal de commerce) ; contrôler la cohérence de l'adresse et du téléphone. | Numéro RCCM, date, source |
| 3 | ⛔ Vérifier les autorisations propres à la profession (carte professionnelle ? inscription auprès de la DNUH ?) **dès que l'avocat aura indiqué ce qui est exigé** ; en attendant, ne pas les mentionner dans le badge. | — |
| 4 | Un **administrateur** accepte (nom de l'agence + note) ; le moderateur ne peut pas. | Note |
| 5 | Revue **annuelle** (⬜ rappel non automatisé) et retrait immédiat si radiation, plainte fondée ou fausse déclaration. | Journal |

**Rappel contractuel à faire signer à l'agence** (conditions) : elle reste seule responsable de ses obligations LBC/FT (identification de ses clients et bénéficiaires effectifs, déclaration de soupçon à la CENTIF, conservation 10 ans, règlement des ventes par virement ou chèque au-delà du seuil légal, déclaration des espèces ≥ 15 M FCFA) ; Ika So n'intervient pas dans le paiement des transactions.

## 3. Règles de conduite
- **Indépendance** : aucun badge offert (partenaires, relations, publicité). Un contrôleur ne contrôle pas ses propres annonces ni celles de proches (conflit d'intérêts déclaré).
- **Minimisation** : ne pas recopier le contenu des pièces ; la note dit ce qui a été contrôlé, pas les données d'identité. Les fichiers de pièces sont supprimés après une durée ⛔ (proposition : **90 jours** après décision ; la note et la date restent).
- **Délais** : réponse à l'annonceur sous **3 jours ouvrés** (⛔ à confirmer) ; sinon relance interne.
- **Contestation** : l'annonceur redépose une pièce ; un **autre** administrateur réexamine.
- **Responsabilité** : le badge porte la date de contrôle ; les formules « garanti », « certifié », « sécurisé » sont **interdites**.
- **Contrôles qualité** : l'administrateur re-contrôle chaque mois 1 badge sur 10 au hasard (⬜ à planifier) ; toute erreur trouvée → retrait, note, rappel au contrôleur.
- **Coopération** : une réquisition de justice ou de l'autorité de contrôle est traitée par un administrateur, jamais par un modérateur, et consignée.

## 4. Formulations publiques (déjà dans le site après cette version)
- Annonce sans badge : « Document déclaré par l'annonceur, sans garantie automatique. Ika So ne certifie pas le titre. »
- Avec badge : « Titre foncier contrôlé par l'équipe le [date]. Ce contrôle ne remplace pas la vérification par un notaire avant tout paiement. »
