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
        versionCode = 3
        versionName = "1.0.2"

        // >>> Adresse du site IKA SÔ (changez-la ici ET dans AndroidManifest.xml si le domaine change)
        buildConfigField("String", "BASE_URL", "\"https://ika-so.onrender.com/\"")
        buildConfigField("String", "SITE_HOST", "\"ika-so.onrender.com\"")
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
}
