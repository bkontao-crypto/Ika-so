# Branchement dans le point d'entrée principal (E09)

## 1. Importer le bootstrap
Dans `public/js/app.js` (ou le script principal) :

```js
import { bootstrapSettings } from "/js/bootstrap-settings.js";
bootstrapSettings();
```

Ou simplement ajouter dans `index.html` avant la fermeture de `body` :

```html
<script type="module" src="/js/bootstrap-settings.js"></script>
```

## 2. Marquer les modules
Ajouter `data-module` sur les éléments à masquer :

```html
<a href="/crm-leads.html" data-module="crm">Mes leads</a>
<a href="#/carte" data-module="map">Carte</a>
<a href="#/premium" data-module="premium">Premium</a>
```

Si le flag correspondant est `false`, l'élément est masqué.

## 3. Prévisualisation
Sur la page `/admin-settings.html`, les sélecteurs de couleur mettent à jour `--leaf` et `--gold` en direct.
