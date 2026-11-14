# Application des réglages côté frontend (E09)

## Endpoint public
`GET /superadmin-settings/public`  
Retourne les réglages (clé `main` ou l'ensemble).

## Application
Dans le point d'entrée de l'app (ou dans `app.js`) :

```js
import { applySettings } from "/js/pages/admin-settings.js";

const settings = await api("/superadmin-settings/public").catch(() => null);
if (settings) applySettings(settings);
```

`applySettings` :
- Met à jour les variables CSS `--leaf` et `--gold`.
- Remplace les textes portant `data-welcome-title` et `data-welcome-subtitle`.

## Modules
Les flags `modules.crm`, `modules.map`, etc. peuvent être lus pour afficher/masquer des entrées de menu.
