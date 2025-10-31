plugins {
    // Version declarations for plugins are placed in module to avoid wrapper files
    id("com.android.application") version "8.5.2" apply false
    kotlin("android") version "1.9.24" apply false
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
