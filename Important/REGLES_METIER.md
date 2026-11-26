# Règles métier — IKA SO

Document de référence des règles métier. Il ne contient que des règles décidées par le propriétaire ou constatées dans le code.
Ce qui est seulement proposé est marqué **À VALIDER** : ce n'est pas une règle tant que le propriétaire ne l'a pas confirmé.
Dernière mise à jour : 25 novembre 2026 (section « Badge Étoile »).

---

## Badge Étoile (compte certifié)

### A. Règles en vigueur (constatées dans le code le 25 novembre 2026)

1. **Nature.** Le badge Étoile atteste qu'un compte est identifié (identité vérifiée sur pièces). Il est **indépendant du Premium** : l'un ne donne jamais l'autre. Il ne garantit ni la qualité d'un bien ni la réussite d'une transaction.
2. **Ouverture.** Le badge est fermé tant que le Superadmin ne l'a pas activé dans les réglages. Tous les réglages (activation, pièces exigées, prix, durée, délai, conservation, étapes, textes) se modifient depuis l'écran d'administration, et chaque changement est tracé.
3. **Qui peut demander.** Tout compte actif ; si le réglage est actif (par défaut oui), le numéro de téléphone doit être confirmé par code. Un compte peut avoir un seul dossier ouvert (en constitution ou en attente) à la fois.
4. **Types de compte et pièces par défaut.**
   - Particulier / propriétaire et autre professionnel : carte d'identité, photo d'identité récente, certificat de résidence (obligatoires) ; selfie avec la pièce (facultatif).
   - Agence : carte d'identité, photo, registre de commerce (RCCM), justificatif de siège (obligatoires) ; selfie (facultatif).
5. **Confidentialité des pièces.** Les pièces sont privées : jamais servies publiquement. Chaque ouverture d'une pièce par le personnel est tracée (qui, quand, quelle pièce).
6. **Cycle d'un dossier.** En constitution (DRAFT) → envoyé (PENDING) → accepté (APPROVED) ou refusé (REJECTED). Le titulaire peut retirer son dossier (CANCELLED) tant qu'il n'est pas décidé : les pièces sont alors supprimées. Un badge accordé peut être retiré (REVOKED).
7. **Envoi.** Conditions acceptées, toutes les pièces obligatoires présentes, téléphone joignable (8 chiffres au moins). Le personnel concerné est notifié.
8. **Étude en 3 étapes** : Étude, Vérification, Confirmation. Les étapes demandées sont réglables (au moins une). Chaque validation est tracée à la personne ; elle peut être retirée avec un motif obligatoire.
9. **Décision.** Approuver exige que toutes les étapes demandées soient validées (et le paiement reçu s'il est exigé). Refuser ou retirer exige un motif de 3 caractères au moins, transmis au titulaire. Un dossier déjà décidé ne peut plus être décidé.
10. **Validité.** Durée réglable (12 mois par défaut). Un renouvellement s'ajoute à la fin de la validité en cours. Un badge est actif tant que sa date de fin n'est pas passée.
11. **Renouvellement.** Proposé au titulaire dans les 30 jours avant la fin de la validité.
12. **Retrait.** Le retrait annule tous les badges accordés du compte et notifie le titulaire avec le motif.
13. **Effacement des pièces.** Si une durée de conservation est réglée, les pièces des dossiers décidés sont effacées après ce délai. Par défaut, aucune durée (0) : conservation jusqu'à suppression manuelle.
14. **Rappels d'expiration.** Notification du titulaire 30 jours avant la fin du badge, puis à l'expiration, une seule fois par échéance.
15. **Notifications.** Le titulaire est notifié de l'acceptation, du refus (avec motif) et du retrait (avec motif).

### B. Écarts constatés entre les règles et le fonctionnement (audit du 25 novembre 2026)

- **Paiement non branché.** Le réglage « paiement exigé » et le prix existent, mais aucun paiement Étoile n'est possible et rien ne marque un dossier comme payé. Activer « paiement exigé » rend toute approbation impossible.
- **Affichage public absent.** L'étoile n'apparaît que dans les paramètres du titulaire ; aucun profil public ni aucune annonce ne l'affiche, contrairement à ce que promet l'écran de demande.
- **Rappels et effacement manuels.** Ils ne s'exécutent que lorsqu'un membre du personnel lance le traitement « sweep » : il n'y a pas de minuterie.

### C. Règles proposées — À VALIDER par le propriétaire

| N° | Proposition | Décision |
|---|---|---|
| E1 | Le paiement du badge est un type de paiement à part (`STAR`) ; le dossier n'est marqué payé que sur confirmation signée du fournisseur, avec le bon montant (comme pour le Premium). Tant que ce n'est pas branché, « paiement exigé » reste désactivé. | À valider |
| E2 | Un badge actif s'affiche sur le profil public et sur les annonces du titulaire (étoile et texte « Compte certifié »). Il disparaît à l'expiration ou au retrait, sans attendre le traitement manuel. | À valider |
| E3 | Durée de conservation des pièces après décision fixée par défaut (valeur à choisir selon la loi en vigueur au Mali), avec effacement automatique. | À valider |
| E4 | Chaque décision et chaque validation d'étape est enregistrée au journal d'audit dans la même opération : si l'écriture du journal échoue, la décision n'est pas prise. | À valider |
| E5 | Séparation des rôles : la personne qui décide (acceptation ou refus) ne peut pas être celle qui a validé toutes les étapes. | À valider (question posée au propriétaire) |
| E6 | Un dossier de renouvellement ne peut être ouvert que dans les 30 jours avant la fin du badge (contrôle côté serveur, et non seulement dans l'interface). | À valider |
