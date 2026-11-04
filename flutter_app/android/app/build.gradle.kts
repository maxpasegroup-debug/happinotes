
import java.util.Properties

plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

// Load upload signing configuration from android/key.properties
val uploadSigningFile = rootProject.file("key.properties")
val uploadSigning = Properties()

if (uploadSigningFile.exists()) {
    uploadSigningFile.inputStream().use {
        uploadSigning.load(it)
    }

    for (property in listOf("storeFile", "storePassword", "keyAlias", "keyPassword")) {
        require(!uploadSigning.getProperty(property).isNullOrBlank()) {
            "Missing $property in android/key.properties"
        }
    }

    val uploadKeystoreFile = rootProject.file(
        uploadSigning.getProperty("storeFile")
    )

    require(uploadKeystoreFile.exists()) {
        "Upload keystore configured in android/key.properties was not found"
    }
} else if (gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true)
    }) {
    throw GradleException(
        "Release signing requires android/key.properties and your upload keystore. " +
            "Debug signing is not permitted for release builds."
    )
}

android {
    namespace = "com.happinotes.happinotes_flutter"
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.happinotes.happinotes_flutter"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (uploadSigningFile.exists()) {
            create("release") {
                keyAlias = uploadSigning.getProperty("keyAlias")
                keyPassword = uploadSigning.getProperty("keyPassword")
                storeFile = rootProject.file(
                    uploadSigning.getProperty("storeFile")
                )
                storePassword = uploadSigning.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            if (uploadSigningFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
