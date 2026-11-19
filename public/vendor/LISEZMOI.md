# Bibliothèques tierces hébergées chez nous

Pour activer le fond de carte Mapbox (étape 4 bis), déposer ici, depuis le paquet officiel `mapbox-gl` (version à choisir, à figer et à noter dans `SUIVI.md`) :

- `mapbox-gl.js`  (fichier `dist/mapbox-gl.js`)
- `mapbox-gl.css` (fichier `dist/mapbox-gl.css`)

Puis poser `MAPBOX_TOKEN` (jeton public `pk.`, restreint à l'adresse du site). Sans ces deux fichiers ou sans jeton, le site utilise le plan métrique local : rien ne casse.
Vérifier la licence Mapbox GL JS de la version choisie avant la production.

## pdf.js (aperçu des pièces justificatives)

`pdfjs/pdf.min.js` et `pdfjs/pdf.worker.min.js` : paquet `pdfjs-dist` version **3.11.174** (licence Apache-2.0, fichier `pdfjs/LICENSE`). Utilisés par `public/js/owner/proof-viewer.js` pour afficher un PDF dans la page, sans bouton de téléchargement. Hébergés chez nous : la politique de sécurité (`script-src 'self'`) ne change pas.
