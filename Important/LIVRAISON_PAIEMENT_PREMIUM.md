# Paiement du Premium (bouton « Demander le Premium »)

## Ce qui change
- Le bouton mène désormais à un vrai paiement : choix de la formule → page de paiement du fournisseur (CinetPay / PayDunya) → retour sur le site.
- Le Premium n'est activé que lorsque le fournisseur confirme le paiement (webhook vérifié, montant contrôlé), comme pour la mise à la une. Une facture est émise.
- Si les paiements sont désactivés ou si aucune formule Premium n'a de prix, le bouton garde l'ancien comportement (contacter un conseiller).
- Remboursement complet : les jours Premium donnés par ce paiement sont retirés.

## À faire avant la mise en ligne
1. Appliquer `migrations/044_premium_paiement.sql` (retour arrière : `scripts/rollback/044_premium_paiement_down.sql`).
2. Fixer les prix et activer les formules `PREMIUM_30`, `PREMIUM_90`, `PREMIUM_365` (Admin > Offres, ou espace propriétaire > Abonnements & formules). Elles démarrent inactives à 0 FCFA.
3. Vérifier que `PAYMENT_PROVIDER` et les clés du fournisseur sont posées (voir docs/fournisseurs.md). Premier essai réel avec un petit montant.

## Fichiers touchés
server/services/payments.js, stats.js, rights.js · public/js/pages/premium.js, account.js, payments.js · public/css/espace.css · test/premium-payment.test.js

## Suivi de conversion des invitations Premium
- Chaque invitation (bandeau, bouton du haut, cadeaux verrouillés, carte « Passez Premium », page Partenaires…) mène à `#/premium?from=<emplacement>`. L'arrivée sur la page enregistre un événement `premium_cta_clicked` ; le lancement du paiement `premium_checkout_started` ; le paiement confirmé `payment_completed` (avec `kind=PREMIUM` et l'emplacement d'origine).
- L'emplacement est une liste fermée côté serveur (`PREMIUM_ORIGINS`) : aucun texte libre n'est enregistré. Il est aussi gardé sur le paiement (`ika_payments.origin`), si bien que paiements lancés et payés sont exacts même collecte éteinte.
- Lecture : Owner Control Center > « Conversion Premium » (30 derniers jours) : clics → paiements lancés → payés, par emplacement. Taux affiché à partir de 20 clics.
- Mêmes règles que les autres statistiques : rien n'est compté tant que `ANALYTICS_ENABLED=true` ET le réglage `analytics_enabled` ne sont pas activés ; « Ne pas suivre »/GPC respecté ; l'identifiant de compte n'est joint qu'avec consentement.
- À appliquer : `migrations/045_suivi_premium.sql` (après la 044 ; retour arrière fourni).

## Nouveau profil annonceur public (maquette « Profil annonceur — Entête MAJ »)
- Remplace l'ancienne page `#/annonceur/:id` (public/js/pages/advertiser.js + public/css/profil.css). Tous les accès existants (annuaire, fiche d'annonce, messagerie, centre de contrôle) y mènent déjà : rien d'autre à brancher.
- Une présentation par type de compte : agence (badge « Agence vérifiée », « À propos de l'agence », « Contacter l'agence ») ou particulier (rôle du compte, « Contacter l'annonceur »). Son propre profil : bouton « Modifier mon profil » à la place des boutons de contact.
- Données réelles uniquement : photo de couverture et avatar (initiales à défaut), annonces, avis (notation, filtres, réponse, signalement), confiance, antécédents, signalement du profil, partage. Les rubriques de la maquette sans donnée dans Ika So (abonnés, « Suivre », publications, équipe, services) ne sont pas affichées.
- Test : test/advertiser-profile-page.test.js (rendu agence, particulier, son propre profil, sur faux DOM).
