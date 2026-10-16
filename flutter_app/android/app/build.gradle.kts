import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
    
}

val uploadSigningFile = rootProject.file("key.properties")
val uploadSigning = Properties()
if (uploadSigningFile.exists()) {
    uploadSigningFile.inputStream().use { uploadSigning.load(it) }
    for (property in listOf("storeFile", "storePassword", "keyAlias", "keyPassword")) {
        require(!uploadSigning.getProperty(property).isNullOrBlank()) {
            "Missing $property in android/key.properties"
        }
    }
    require(file(uploadSigning.getProperty("storeFile")).exists()) {
        "Upload keystore configured in android/key.properties was not found"
    }
} else if (gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }) {
    throw GradleException("Release signing requires android/key.properties and your upload keystore. Debug signing is not permitted for release builds.")
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
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.happinotes.happinotes_flutter"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
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
                storeFile = file(uploadSigning.getProperty("storeFile"))
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
