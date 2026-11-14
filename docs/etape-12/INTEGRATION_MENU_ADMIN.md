
cat > RAPPORT_ETAPE_12.md << 'EOF'
# RAPPORT D'ÉTAPE 12 — Export CSV du journal d'audit (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.3 (en développement)  
**Base :** V1.2 (vue audit E11)

## 1. Objectif
Permettre l'export CSV du journal d'audit et documenter l'intégration dans le menu admin.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Bouton « Exporter CSV » | `public/js/pages/admin-audit.js` | Ajouté |
| Note d'intégration menu | `docs/etape-12/INTEGRATION_MENU_ADMIN.md` | Créée |

## 3. Détails
- Export des lignes actuellement affichées (après filtre).
- Fichier nommé `audit-moderation-YYYY-MM-DD.csv`.
- Échappement correct des guillemets.
- La vue reste autonome (`/admin-audit.html`).

## 4. Prochaines actions proposées
- [ ] Journaliser les actions de badges (grant / revoke) dès identification des endpoints.
- [ ] Liaison optionnelle annonce ↔ bien à la publication.
- [ ] Pagination ou chargement incrémental du journal si le volume augmente.
- [ ] Filtre par acteur et plage de dates.

## 5. Migrations
Aucune.

**E12 — avancement** : export CSV du journal d'audit disponible.
