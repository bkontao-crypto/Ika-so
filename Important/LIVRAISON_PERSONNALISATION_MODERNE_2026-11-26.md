# Livraison — Personnalisation du site, interface moderne (26 novembre 2026)

Branche : `feature/personnalisation-site-moderne` (retour arrière : ne pas fusionner, ou `git revert -m 1 <commit de fusion>`).

## Ce qui change (affichage seulement)
- Nouvelle coque de la page « Personnalisation du site » : onglets sur plusieurs lignes (plus de défilement qui cache « Référencement »), phrase d'aide sous les onglets, navigation clavier ← →.
- Bouton « Enregistrer la section » en haut : déclenche le bouton d'enregistrement de la section affichée (même appel serveur qu'avant).
- Suivi des modifications non enregistrées : pastille sur l'onglet, bandeau en haut, alerte à la fermeture de la page, confirmation avant d'enregistrer une section si une autre section a des modifications en attente (la page se recharge après chaque enregistrement).
- L'onglet affiché est conservé après un enregistrement.
- Pied de page : espace de travail en deux colonnes, formulaire à gauche, aperçu en direct à droite (ordinateur / téléphone), compteur de caractères, avertissement sur une adresse de lien douteuse.

## Fichiers
- `public/js/owner/v-customize.js` (nouveau) : vue complète + pied de page.
- `public/js/owner/main.js` : import et 4 routes (`customize`, `settings`, `homepage`, `seo`) vers la nouvelle vue.
- `public/css/owner-customize.css` (nouveau) et `public/owner.html` (une ligne `<link>`).
- Inchangés : `v-modules.js` (l'ancienne `customizeView` y reste, non utilisée), `v-header.js`, tous les endpoints `/staff/…`, la base de données.

## Vérifications
- Syntaxe ES de `v-customize.js` contrôlée avec Node (`--check`) : OK.
- Diff de `main.js` : 2 ajouts, 1 suppression (contrôlé sur le commit).
- Non exécuté : affichage dans le navigateur, enregistrement réel de chaque section, thème sombre, mobile, tests automatiques du dossier `test/`.
