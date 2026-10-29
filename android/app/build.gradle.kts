import java.util.Properties

plugins { id("com.android.application") }

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
  if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}
val hasKeystore = keystorePropsFile.exists()

android {
  namespace = "com.farfor.shifts"
  compileSdk = 34
  defaultConfig {
    applicationId = "com.farfor.shifts"
    minSdk = 24
    targetSdk = 34
    versionCode = 5
    versionName = "1.4"
  }
  signingConfigs {
    if (hasKeystore) {
      create("release") {
        storeFile = file(keystoreProps.getProperty("storeFile"))
        storePassword = keystoreProps.getProperty("storePassword")
        keyAlias = keystoreProps.getProperty("keyAlias")
        keyPassword = keystoreProps.getProperty("keyPassword")
        enableV1Signing = false
        enableV2Signing = true
        enableV3Signing = true
      }
    }
  }
  buildTypes {
    release {
      isMinifyEnabled = false
      if (hasKeystore) signingConfig = signingConfigs.getByName("release")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  packaging { resources.excludes += setOf("META-INF/*") }
}
