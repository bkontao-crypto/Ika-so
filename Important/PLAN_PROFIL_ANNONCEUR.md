# PLAN — Profil annonceur à onglets (cahier du 5 novembre 2026)

**Statut : réalisé le 5 novembre 2026 (livraison 15) — voir `SUIVI_EVOLUTION_IKA_SO.md`.** Le plan ci-dessous est conservé pour mémoire ; écarts : migration 026 (`ika_advertiser_profiles`, `ika_profile_contact_events`), signalement d'annonceur = `ika_user_reports` existante (thread_id nul), horaires en texte libre, couverture et photo de profil incluses. Fichiers examinés : `public/js/pages/advertiser.js` (132 lignes), `server/services/reviews.js` (`publicProfile`), route `GET /api/advertisers/:id`, la maquette HTML fournie et le cahier des charges.

## 1. Constat : la page existe déjà, avec des données réelles
Déjà en place et à conserver : nom (agence vérifiée ou nom du compte), rôle affiché, badge « Agence vérifiée » (date de validation réelle), « Numéro vérifié par SMS », statut de confiance fondé sur des critères constatés, note moyenne et répartition, avis avec réponse de l'annonceur et signalement, ancienneté, annonces en ligne / publiées / vendues ou louées / titres contrôlés / contacts reçus, grille des annonces en ligne.

| Demande du cahier | État | Remarque |
|---|---|---|
| Statistiques, note, date d'inscription | Présent | Calculés par le serveur |
| Grille des annonces actives | Présent | Limitée à 24 : ajouter « voir plus » |
| Avis et évaluations | Présent | |
| Onglets | **Absent** | Page en une seule colonne |
| Couverture, photo / logo | **Absent** | Pas de stockage rattaché au profil |
| Présentation, année de création, zones | **Absent** | Aucun champ |
| Adresse, téléphone, horaires | **Absent** | Le téléphone existe mais n'est jamais affiché publiquement |
| Boutons WhatsApp, Appeler, Partager | **Absent** | |
| « Promoteur vérifié », « Particulier certifié » | **Impossible aujourd'hui** | Aucune procédure de validation n'existe pour ces statuts |

## 2. Maquette HTML fournie : à ne pas intégrer telle quelle
- Données écrites en dur : note 4,9, « 12 avis », « membre depuis 2024 », zones, adresse, horaires. Interdit (« ne jamais simuler les statistiques »).
- Icône « vérifié » toujours affichée : interdit (« jamais de badge sans validation réelle »).
- Icônes Font Awesome (`fa-solid`) : ressource externe, refusée par le test « aucun CDN ». Le site a son propre jeu d'icônes.
- Chemins `public/media/...` et `listing-card.js` : n'existent pas dans ce projet ; les pages sont construites avec la fonction `h()` et `mount()`.
- Balisage : utile comme **référence visuelle** seulement (en-tête, barre d'onglets, quatre panneaux).

## 3. Conception proposée (additive)
**Données** : une table `ika_advertiser_profiles` (clé = compte, supprimée avec lui) : présentation (≤ 1 500 caractères), année de création déclarée, zones d'intervention, adresse, horaires, afficher le téléphone (non par défaut), afficher WhatsApp (non par défaut), références de la couverture et de la photo, date de mise à jour. Aucune colonne existante modifiée ; retour arrière écrit.
**Serveur** : `publicProfile` ajoute un bloc `profile` ; le téléphone n'est renvoyé que si l'annonceur l'a autorisé ; le lien WhatsApp est construit côté serveur ; le clic de contact est enregistré dans `ika_contact_events` (existant), sans présumer d'une conversation. Modification du profil réservée à son propriétaire, validée côté serveur, tracée.
**Images** : réutiliser le stockage et les contrôles d'images existants (formats, taille, fichiers dangereux) ; une image de profil signalée peut être masquée par la modération.
**Interface** : onglets accessibles (rôles `tablist`, flèches du clavier), panneaux chargés à la demande, icônes du site, états vides honnêtes (« Aucune présentation renseignée »). Partager : partage du système ou copie du lien, sans suivi. Respect du budget (CSS ≤ 10 Ko, page ≤ 8 Ko compressés) : la page sera découpée si nécessaire.
**Libellés de confiance** : seuls les badges réels existants. « Particulier certifié » et « Promoteur vérifié » ne sont pas créés tant qu'aucune procédure de vérification n'existe.
**Vie privée** : adresse et horaires affichés pour les agences vérifiées ; pour un particulier, seulement la ville et le quartier.

## 4. Tests prévus
Téléphone absent de la réponse sans autorisation ; seul le propriétaire modifie son profil ; zéro donnée en dur ; onglets au clavier ; clic de contact enregistré une fois ; images refusées si format dangereux ; budget de poids ; compte restreint toujours signalé.

## 5. Limites
Plan non testé. Le numéro de migration est attribué à l'écriture (026 ou suivant) ; la migration des deux emplacements Superadmin reste prévue.
