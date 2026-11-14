# RAPPORT D'ÉTAPE 3 — Compte unifié et Owner Center (IKA SO)

**Date de démarrage :** 14 novembre 2026 · **Version en cours :** 0.4 (en développement)  
**Base :** V0.3 (socle visuel E02 en cours)

## 1. Objectif
Mettre en place le compte unifié à onglets contextuels (DEC-001) et préparer l'ouverture contrôlée de l'Owner Center aux admins (DEC-003).

## 2. Livrables de ce lot
| Élément | Fichier | Statut |
|---------|---------|--------|
| Module compte unifié | `public/js/pages/compte-unifie.js` | Créé |
| Route `#/profil` | `public/js/app.js` | Pointée vers le nouveau module |
| Route de repli | `#/profil-legacy` | Conserve l'ancien mon-profil |
| Styles onglets | `public/css/components.css` | Ajoutés |
| Onglet Aperçu | Implémenté (rôles + raccourcis Console / Owner Center) | Fonctionnel |
| Autres onglets | Placeholders prêts (biens, annonces, messages, favoris, documents, abonnement, pro, réglages) | À brancher |

## 3. Règles respectées
- Un seul compte, un seul profil.
- Les onglets affichés dépendent des rôles réels (`userFlags()`).
- L'affichage n'accorde aucun droit : les actions restent contrôlées côté serveur.
- Bouton « Console » pour l'équipe, « Owner Center » pour les admins/Superadmin.
- Aucune migration de comptes (conforme à l'étape 1).

## 4. Ce qui reste pour clôturer E03
- [ ] Brancher le contenu réel des onglets sur les pages existantes (mes-annonces, favoris, inbox, etc.).
- [ ] Créer l'entité « bien » (DEC-004) et l'onglet Mes biens.
- [ ] Appliquer la matrice Owner Center (DEC-003) : 29 modules délégables / 11 réservés.
- [ ] Tests d'accès par rôle.
- [ ] Vérification visuelle (DEC-002).

## 5. Migrations et retour arrière
**Migrations : aucune.**  
Retour arrière : remettre la route `#/profil` sur `mon-profil` / `profilePage` dans `app.js` et supprimer `compte-unifie.js`.

## 6. Onglet Annonces branché (14 novembre 2026)
- L'onglet **Annonces** charge désormais `/me/listings`.
- Affichage des annonces non archivées avec :
  - titre, prix, quartier, statut (pastille),
  - motif de refus si présent,
  - actions « Voir », « Modifier », « Gestion avancée »,
  - bouton « Nouvelle annonce ».
- État vide géré (message + lien publier).
- Cache simple pour éviter les rechargements inutiles lors du changement d'onglet.
- Les actions avancées (prolonger, marquer vendu/loué, justificatif, booster) restent accessibles via `#/mes-annonces` (lien « Gestion avancée »).

**Prochain lot** : brancher Favoris et Messages de la même façon.

## 7. Onglets Favoris et Messages branchés
- **Favoris** : charge `/me/favorites`, affiche les cartes avec lien « Voir » et « Gestion des favoris ». État vide géré.
- **Messages** : charge `/me/threads`, affiche les conversations avec indicateur non-lu, dernier message et lien « Ouvrir » vers `#/boite/:id`. Lien vers la boîte complète. État vide géré.
- Caches simples pour les deux onglets.

**Onglets restants en placeholder** : Mes biens (DEC-004), Documents, Abonnement, Pro, Réglages.

## 8. Onglets Documents et Réglages branchés
- **Documents** : charge `/me/proofs`, affiche les justificatifs (titre foncier, RCCM) avec statut et date. État vide géré.
- **Réglages** : affiche les préférences de notification, le consentement statistiques, et les actions « Télécharger mes données » + liens vers la gestion complète (legacy) pour modifier / supprimer.
- Les modifications avancées restent sur `#/profil-legacy?tab=parametres` pour l'instant (évite de dupliquer toute la logique de formulaires).

**Onglets encore en placeholder** : Mes biens (DEC-004), Abonnement, Pro.

## 9. Onglet Abonnement branché
- Charge `/me/center/access`, `/offers` (filtrées PREMIUM) et `/me/payments`.
- Affiche le statut Premium (actif / non actif + date de fin).
- Liste les formules disponibles et les 5 derniers paiements.
- Liens vers `#/premium` et `#/paiements`.

**Onglets encore en placeholder** : Mes biens (DEC-004), Pro (étape 7).

## 10. Onglet Pro (squelette) + esquisse « bien »
- **Pro** : charge `/me/agency`, affiche le statut agence vérifiée et des liens vers `#/agence`, `#/premium`, `#/centre`. Placeholder pour le CRM (étape 7).
- **Mes biens** : esquisse de l'entité créée dans `docs/etape-3/ENTITE_BIEN.md` (modèle SQL, relations, étapes d'implémentation). Placeholder mis à jour avec le lien vers le document.

**Compte unifié** : tous les onglets ont maintenant un contenu réel ou un squelette documenté, sauf Mes biens qui attend la validation de DEC-004 pour la migration.

## 11. Entité « bien » implémentée (DEC-004)
- Migration additive `migrations/059_properties.sql` :
  - table `ika_properties`
  - colonne nullable `property_id` sur `ika_listings`
- Service `server/services/properties.js` (mine, create, get)
- Routes :
  - `GET /me/properties`
  - `POST /me/properties`
  - `GET /me/properties/:id`
- Onglet **Mes biens** branché : liste + création rapide (prompt).
- Aucune donnée existante modifiée. Retour arrière : supprimer la migration 059 et les fichiers/routes ajoutés.

**Compte unifié** : tous les onglets sont maintenant fonctionnels ou squelettés. Mes biens est opérationnel (création + liste).

## 12. Owner Center — délégations (DEC-003)
- Migration `060_owner_delegations.sql` : table `ika_owner_delegations`.
- Service dédié `server/services/owner-delegations.js` :
  - liste des modules délégables,
  - `list` / `grant` / `revoke` (réservés SUPERADMIN),
  - `canAccess(userId, module)` pour les contrôles futurs.
- Routes :
  - `GET /staff/owner/delegations`
  - `POST /staff/owner/delegations`
  - `POST /staff/owner/delegations/revoke`
- Le guard historique de `owner-center.js` reste SUPERADMIN-only pour l'instant.
  L'intégration module par module (`guard(userId, "dashboard")` etc.) pourra se faire progressivement
  en appelant `ownerDelegations.canAccess`.

**Infrastructure DEC-003 prête.** Application effective des contrôles par module = étape suivante.

## 13. Intégration de canAccess (modules concrets)
Helper `requireOwnerModule(req, module)` ajouté dans `server/routes/index.js`.

Modules protégés par délégation :
- `GET /staff/owner/dashboard` → module `dashboard`
- `GET /staff/owner/overview` → module `overview`
- `GET /staff/owner/activity` → module `activity`
- `GET /staff/owner/crm` → module `crm`
- `GET /staff/owner/premium-funnel` → module `premium-funnel`

Comportement :
- SUPERADMIN : accès toujours autorisé.
- ADMIN : accès uniquement si le module lui a été attribué via `/staff/owner/delegations`.
- Autres rôles : refus (403).

Les autres routes Owner Center restent SUPERADMIN-only pour l'instant.

## 14. Extension de requireOwnerModule
Modules supplémentaires protégés par délégation :
- `regions`, `subscriptions`, `report`, `report.pdf`
- `pipeline` (GET + POST + stage)
- `trends`, `charts`
- `complaints` (liste)
- `marketing`, `campaigns` (création)
- `monitoring`, `health`, `agencies`

Total : plus de 20 points d'entrée Owner Center passent désormais par `requireOwnerModule`.
Les modules sensibles (sauvegardes, réglages, marque, légal, SEO écriture, etc.) restent SUPERADMIN-only.
