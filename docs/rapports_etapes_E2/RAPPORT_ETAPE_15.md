# RAPPORT D'ÉTAPE 15 — Premier lot E07 Professionnels et CRM (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 1.6 (en développement)  
**Base :** V1.5 (liaison bien/annonce E14)  
**Étape officielle ciblée :** E07 — Professionnels et CRM

## 1. Objectif
Démarrer E07 avec une esquisse de CRM léger pour les professionnels.

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Esquisse CRM | `docs/etape-7/ESQUISSE_CRM.md` | Créée |
| Modèle `ika_crm_leads` | Documenté | Prêt |
| Endpoints proposés | Documentés | Prêts |

## 3. Contenu
- Table additive des leads (statut, source, notes, lien annonce).
- Endpoints minimaux `/me/crm/leads`.
- Lien avec les fonctionnalités existantes (centre annonceur, contacts WhatsApp/Call, score).

## 4. Prochaines actions proposées
- [ ] Implémenter la migration + service + routes CRM.
- [ ] Ajouter une section « Leads » dans le centre professionnel.
- [ ] Alimenter automatiquement un lead depuis un contact profil.
- [ ] Filtres et stats simples (nouveaux / en cours / gagnés).

## 5. Migrations
Aucune pour l'instant (esquisse).

**E07 lot 1 — avancement** : esquisse CRM prête.
