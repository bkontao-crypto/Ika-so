# RAPPORT D'ÉTAPE 31 — Bootstrap, masquage modules, prévisualisation (E09) (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 3.2 (en développement)  
**Base :** V3.1 (page réglages)  
**Étape officielle :** E09 — Personnalisation Superadmin

## 1. Objectif
Livrer en une fois : branchement dans le point d'entrée, masquage des modules, prévisualisation des couleurs.

## 2. Travaux réalisés
| Élément | Fichier | Statut |
|---------|---------|--------|
| Bootstrap | `public/js/bootstrap-settings.js` | Créé |
| Masquage modules | `applyModuleFlags` (data-module) | Implémenté |
| Prévisualisation couleurs | `public/js/pages/admin-settings.js` | Ajoutée |
| Documentation | `docs/etape-9/BRANCHEMENT_APP.md` | Créée |

## 3. Détails
- `bootstrapSettings()` charge `/superadmin-settings/public` et applique couleurs + textes + modules.
- Éléments avec `data-module="crm|map|premium|whatsapp"` sont masqués si le flag est `false`.
- Sur la page d'édition, les inputs couleur mettent à jour `--leaf` et `--gold` en direct.
- Auto-exécution possible via `<script type="module" src="/js/bootstrap-settings.js">`.

## 4. Prochaines actions proposées
- [ ] Ajouter les attributs `data-module` sur les menus existants.
- [ ] Prévisualisation des textes d'accueil en direct.
- [ ] Passage à E10 — Intelligence et différenciation.
- [ ] Tests visuels des couleurs et du masquage.

## 5. Migrations
Aucune.

**E09 lot 3 — avancement** : bootstrap + masquage modules + prévisualisation.
