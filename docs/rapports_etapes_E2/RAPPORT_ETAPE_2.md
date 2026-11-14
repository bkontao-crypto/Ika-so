# RAPPORT D'ÉTAPE 2 — Socle visuel et navigation (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.3 (en développement)  
**Base :** V0.2 (étape 1) — code applicatif commencé (couche CSS unifiée).

## 1. Objectif de l'étape (selon le suivi)
Unifier les composants (un seul jeu de boutons, cartes, pastilles, onglets, champs, états), corriger BUG-001 (styles en ligne), préparer la vérification clair/sombre et responsive.

**Critère d'acceptation** : composants cohérents sur les pages principales ; contrastes et responsive vérifiés (captures).  
**Note** : la vérification visuelle complète exige un navigateur et un démarrage réel (DEC-002 toujours ouverte). Les changements de code sont livrés ; les captures seront marquées « Non testé » jusqu'à exécution chez le propriétaire.

## 2. Travaux réalisés
| Élément | Action | Fichier |
|---------|--------|---------|
| Couche de composants unifiés | Créée | `public/css/components.css` |
| Chargement en dernier | Ajouté dans index.html, admin.html, owner.html | HTML publics |
| Alias de compatibilité | `.pa-btn`, `.mp-btn`, `.pa-card`, `.mp-card`, etc. normalisés sur les jetons canoniques | components.css |
| Cibles tactiles | min-height 44 px (48 px mobile) | components.css |
| Focus visible | Anneau leaf sur les boutons | components.css |
| `prefers-reduced-motion` | Transitions désactivées | components.css |

## 3. Règles de la couche `components.css`
- Chargée **après** ika.css, modern.css, refonte.css et les feuilles d'écran.
- Ne casse pas les classes existantes : elle les aligne visuellement.
- Utilise uniquement les jetons déjà définis (`--leaf`, `--gold`, `--card`, `--ink`, etc.).
- Aucune ressource externe, aucun style en ligne.

## 4. BUG-001
Recherche des styles en ligne (`style="..."`) dans les fichiers applicatifs (hors vendor) : aucune occurrence trouvée dans le code source actuel.  
Le problème signalé à l'étape 0 concernait probablement du HTML généré dynamiquement ou des versions antérieures. À confirmer lors du démarrage réel (DEC-002). Si des styles en ligne apparaissent encore à l'exécution, ils seront extraits vers des classes.

## 5. Ce qui reste pour clôturer E02
- [ ] Parcourir les pages principales et remplacer progressivement les usages les plus divergents par les classes canoniques (`.btn`, `.card`, `.pill`, `.notice`).
- [ ] Étendre le script de contraste (`scripts/verification/seo-contrast.py`) aux nouveaux composants.
- [ ] Captures clair / sombre / mobile / tablette / bureau (nécessite DEC-002).
- [ ] Vérifier qu'aucune régression visuelle n'est introduite sur Owner Center et profils.
- [ ] Mettre à jour le classeur Excel (statut E02 → « En cours » puis « À vérifier »).

## 6. Migrations et retour arrière
**Migrations : aucune.**  
Retour arrière : supprimer `public/css/components.css` et retirer les trois lignes `<link>` ajoutées dans les HTML. Les classes historiques restent intactes.

## 7. Étape suivante proposée
Une fois E02 validée (ou au moins le code unifié accepté) : **E03 — Compte unifié et Owner Center** (onglets contextuels + branchement des permissions, DEC-003 / DEC-004).

## 8. Avancement complémentaire (14 novembre 2026 — suite)
- Extraction des styles de mise en page statiques vers des classes utilitaires (`mb-16`, `mt-22`, `my-12`, `gap-sm`, `row.wrap`, `badge-count-abs`).
- Remplacements effectués :
  - `public/js/pages/advertiser.js` (marge sur ownerSpace)
  - `public/js/pages/account.js` (deux rangées flex)
  - `public/js/pages/localisation.js` (marge sur section-head)
  - `public/js/components/chrome.js` (position du badge messages)
- Les styles dynamiques (background-image, largeurs de barres de progression, etc.) sont conservés car ils dépendent de données runtime ; une évolution vers des variables CSS (`--pct`) est préparée dans `components.css` pour les barres.
- Aucune régression syntaxique introduite (attributs `class` uniques).

**Prochaine action immédiate** : continuer le remplacement des classes spécialisées (`.mp-btn` → `.btn`, `.pa-btn` → `.btn`) dans `mon-profil.js` et `advertiser.js` par petits lots, en vérifiant le rendu.

## 9. Remplacement des classes spécialisées (lot 1)
- `mon-profil.js` : `mp-btn-primary` → `btn btn-primary`, `mp-btn-outline` → `btn btn-outline`, `mp-btn-glass` → `btn btn-glass` (11 remplacements).
- `advertiser.js` : tous les `pa-btn` (y compris `primary` et `soft`) mappés vers `btn` / `btn-primary` / `btn-gold` (0 occurrence restante).
- Les cartes `.mp-card` / `.pa-card` restent pour l'instant (alias visuel déjà actif dans `components.css`) ; leur remplacement sera fait dans un lot suivant pour limiter le risque de régression de mise en page.

**État E02** : socle CSS unifié en place + premiers remplacements de classes. Vérification visuelle toujours en attente de DEC-002.

## 10. Lot cartes et états vides
- `mon-profil.js` : 18 × `.mp-card` → `.card` (y compris les états vides → `.card.empty-state`).
- `advertiser.js` : helper `card()` et les 2 sections explicites passés à `.card` (0 occurrence `pa-card` restante).
- Ajout dans `components.css` des styles `.card-head` et renforcement de `.empty-state` (icône, titre, texte centré).
- Les classes historiques restantes (`.mp-post`, `.mp-row`, `.pa-stack`, etc.) sont des conteneurs de mise en page spécifiques ; elles seront traitées dans un lot ultérieur si nécessaire.

**Couverture actuelle du socle** : boutons et cartes des deux écrans principaux (Mon profil + Profil annonceur) unifiés. Le reste du site utilise déjà majoritairement `.btn` / `.card`.

## 11. Contraste et finitions
- Script `scripts/verification/token-contrast.py` créé : vérifie les combinaisons réellement utilisées (clair + sombre) sans navigateur.
- Correction contraste : texte des boutons primary en thème clair passé à `#fff` (ratio 6.41 ≥ 4.5). Thème sombre conserve le texte sombre sur leaf clair.
- Tous les contrôles de jetons passent (0 problème).
- Alias de mise en page ajoutés (`.mp-col`, `.mp-row`, `.pa-stack`, `.pa-muted`, etc.) pour cohérence visuelle immédiate.
- Derniers `mp-btn` (variantes sm / gold / danger) remplacés.

**E02 — état** : socle unifié + contrastes des jetons validés. Reste la vérification visuelle complète (captures) qui dépend de DEC-002.
