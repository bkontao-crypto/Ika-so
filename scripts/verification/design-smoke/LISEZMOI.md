# Test de fumée du design (accueil, annonces, carte, partenaires)

Sans PostgreSQL : un serveur simulé sert `public/` et répond aux appels `/api` avec des données factices.

```
node mock-server.mjs 4173            # visiteur
node mock-server.mjs 4174 user       # compte connecté (autre terminal)
mkdir captures && python run.py      # nécessite Python + playwright + chromium
```

Contrôle : onglets, ordre sponsorisées/annonces, recherche de la Carte (filtres envoyés à `/listings`), recherche rapide,
catégories, absence de défilement horizontal sur mobile, aucune erreur JavaScript. Ne remplace pas une recette sur la vraie base.
