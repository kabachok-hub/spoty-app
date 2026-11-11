import org.jetbrains.kotlin.gradle.dsl.JvmTarget
plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
val serverOrigin = providers.environmentVariable("SPOTY_API_ORIGIN").orElse("https://example.invalid").get()
require(serverOrigin.matches(Regex("https://[A-Za-z0-9.-]+(:[0-9]+)?"))) { "SPOTY_API_ORIGIN must be an HTTPS origin without trailing slash" }
android {
    namespace = "app.spoty.mobile"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.spoty.mobile"
        minSdk = 23
        targetSdk = 36
        versionCode = 13
        versionName = "0.3.0"
        buildConfigField("String", "SERVER_ORIGIN", "\"$serverOrigin\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }
dependencies {
    implementation("androidx.activity:activity:1.10.1")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-session:1.11.1")
    implementation("androidx.media3:media3-database:1.11.1")
    implementation("androidx.webkit:webkit:1.14.0")
    testImplementation("junit:junit:4.13.2")
}
tasks.named("preBuild") {
    doFirst { check(serverOrigin != "https://example.invalid") { "Set SPOTY_API_ORIGIN before building" }; check(file("src/main/assets/index.html").exists()) { "Build the bundled frontend first: node scripts/build-android.mjs" } }
}
