# IKA SÔ — application Android (Android Studio)

Application native (Kotlin) qui embarque le site **IKA SÔ** — https://ika-so.onrender.com — dans un WebView rapide et compact.

## Ouvrir et lancer
1. Android Studio (Koala 2024.1 ou plus récent) → **File ▸ Open** → dossier `IkaSo-Android` (attendre la synchronisation Gradle).
2. Brancher un téléphone (débogage USB) ou lancer un émulateur → ▶ **Run**.
3. APK de test : **Build ▸ Build APK(s)**. Pour publier : **Build ▸ Generate Signed App Bundle / APK** (avec votre keystore).

## Ce que fait l'application
- Nom **IKA SÔ**, logo officiel (icône adaptative, écran de démarrage, écran de verrouillage). Identifiant : `com.ikaso.app`.
- Écrans de tout format : zoom autorisé (pincement), images et tableaux contenus, encoches/barres système gérées, clavier qui ne masque pas les champs.
- Tirer vers le bas pour actualiser ; message « Réveil du serveur… » si l'hébergeur met du temps à répondre ; écran « Pas de connexion » avec reprise automatique au retour du réseau.
- **Connexion Google** (version 1.0.3) : la connexion se fait dans le navigateur du téléphone (Google refuse les WebViews), puis revient dans l'application par `ikaso://login?ticket=…` (ticket à usage unique, 60 s). Non couverte : la liaison Google depuis « Mon profil » dans l'application (passer par le navigateur).
- Session par cookie conservée (vous restez connecté). Bouton Retour : navigation arrière, puis « Appuyez encore pour quitter ».
- **Géolocalisation** (« près de moi », carte) avec demande d'autorisation ; **photos / documents** via le sélecteur de fichiers et la caméra.
- **Partage** d'annonces (feuille de partage Android), **impression / PDF** (`window.print`), fichiers `blob:` de l'espace admin enregistrés dans Téléchargements/IKA SO, téléchargements classiques avec la session.
- Liens **WhatsApp, appel, e-mail** ouverts dans les applications du téléphone ; page de paiement externe dans le navigateur, retour automatique dans l'application via le lien du site.
- Verrouillage empreinte / code (option, désactivé par défaut) : appui long sur l'icône ▸ **Réglages de l'application** (inactif sur les builds `debug`, dont l'identifiant porte le suffixe `.debug`).

## Changer l'adresse du site
`app/build.gradle.kts` (`BASE_URL`, `SITE_HOST`) et `app/src/main/AndroidManifest.xml` (`android:host`).

## Signature (release)
Créez un keystore, puis ajoutez au bloc `release` un `signingConfig`. Sans clé, l'APK release n'est pas installable.
