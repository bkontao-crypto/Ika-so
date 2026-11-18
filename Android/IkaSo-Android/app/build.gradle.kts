plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ikaso.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ikaso.app"
        minSdk = 29                 // Android 10+ : enregistrement des fichiers sans permission de stockage
        targetSdk = 34
        versionCode = 6
        versionName = "1.0.5"

        // >>> Adresse du site IKA SÔ (changez-la ici ET dans AndroidManifest.xml si le domaine change)
        buildConfigField("String", "BASE_URL", "\"https://ika-so.onrender.com/\"")
        buildConfigField("String", "SITE_HOST", "\"ika-so.onrender.com\"")
        // Identifiant client OAuth « Application Web » (= GOOGLE_CLIENT_ID du serveur). Public, pas un secret.
        // À fournir dans gradle.properties : GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${(project.findProperty("GOOGLE_WEB_CLIENT_ID") as String?) ?: ""}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signature : voir README (keystore.properties) ; sans clé, l'APK release n'est pas installable.
        }
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
    }
    buildFeatures { buildConfig = true; viewBinding = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.biometric:biometric:1.1.0")     // verrouillage empreinte / code
    implementation("androidx.credentials:credentials:1.3.0")  // connexion Google native (sélecteur de compte)
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
