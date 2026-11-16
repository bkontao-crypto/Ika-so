# Signer l'application Android IKA SÔ (APK de publication)

Ce document explique comment créer la clé de signature, la brancher au projet et générer l'APK signé.
Il se trouve dans le dossier de l'application (`Android/IkaSo-Android/`).

## 1. Créer la clé de signature (une seule fois)

Depuis un terminal (l'outil `keytool` est installé avec Android Studio / le JDK) :

```
keytool -genkeypair -v -keystore ika-so-release.jks -alias ikaso -keyalg RSA -keysize 2048 -validity 10000
```

- Choisissez un mot de passe pour le fichier, puis un mot de passe pour la clé (notez-les).
- Renseignez votre nom et votre organisation.

> **À conserver absolument** : le fichier `ika-so-release.jks` et les deux mots de passe.
> Sans eux, vous ne pourrez plus publier de mise à jour acceptée par les téléphones qui ont déjà l'application.
> Gardez une copie hors de l'ordinateur (clé USB, gestionnaire de mots de passe). **Ne jamais le mettre dans le dépôt GitHub.**

## 2. Indiquer la clé au projet

Créez le fichier `Android/IkaSo-Android/keystore.properties` (ce fichier est déjà ignoré par Git) :

```
storeFile=C:/chemin/complet/vers/ika-so-release.jks
storePassword=mot_de_passe_du_fichier
keyAlias=ikaso
keyPassword=mot_de_passe_de_la_cle
```

Sur Windows, utilisez des `/` dans le chemin. Le chemin est absolu.

## 3. Brancher la signature dans Gradle

Dans `app/build.gradle.kts` :

**a)** Tout en haut du fichier, avant le bloc `plugins { }`, ajoutez :

```kotlin
import java.util.Properties

val keystoreProps = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
```

**b)** Dans le bloc `android { }`, ajoutez `signingConfigs` juste avant `buildTypes` :

```kotlin
signingConfigs {
    create("release") {
        if (keystoreProps.isNotEmpty()) {
            storeFile = file(keystoreProps.getProperty("storeFile"))
            storePassword = keystoreProps.getProperty("storePassword")
            keyAlias = keystoreProps.getProperty("keyAlias")
            keyPassword = keystoreProps.getProperty("keyPassword")
        }
    }
}
```

**c)** Dans le bloc `release { }` de `buildTypes`, ajoutez la ligne :

```kotlin
release {
    isMinifyEnabled = true
    isShrinkResources = true
    proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    if (keystoreProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
}
```

Sans `keystore.properties`, le projet se compile comme avant, mais l'APK release n'est pas signé.

## 4. Générer l'APK signé

**Dans Android Studio :** Build ▸ Generate Signed App Bundle / APK ▸ APK ▸ choisir le fichier `.jks`, l'alias `ikaso`, les mots de passe ▸ variante `release`.

**En ligne de commande**, dans le dossier `Android/IkaSo-Android` :

```
./gradlew assembleRelease        (Windows : gradlew.bat assembleRelease)
```

Le fichier se trouve dans : `app/build/outputs/apk/release/app-release.apk`

## 5. Vérifier la signature

```
apksigner verify --print-certs app-release.apk
```

(`apksigner` est dans le dossier `build-tools` du SDK Android.) Le résultat doit afficher « Verifies » et le nom de votre clé.

## 6. Empreinte SHA-256 (pour les liens vérifiés)

```
keytool -list -v -keystore ika-so-release.jks -alias ikaso
```

Notez la ligne « SHA256 ». Elle servira au fichier `assetlinks.json` (liens vérifiés App Links), à déclarer côté site.

## Points importants

- **Mises à jour** : toute nouvelle version doit être signée avec **la même clé**. Sinon Android refuse l'installation par-dessus (« conflit de signature »).
- **APK déjà en ligne** : l'APK actuel (`public/downloads/ika-so.apk`) a une origine non documentée. Si elle n'a pas été signée avec cette clé, les personnes qui l'ont installée devront la désinstaller avant d'installer la nouvelle version.
- **Version** : augmentez `versionCode` (entier, +1 à chaque publication) et `versionName` dans `app/build.gradle.kts` avant chaque génération.
- Ne partagez jamais `keystore.properties` ni le fichier `.jks`.
