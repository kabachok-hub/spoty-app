package app.spoty.mobile

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Files remain in private app storage; only the verified APK is granted to the installer. */
class AppUpdater(private val activity: Activity) {
    @Volatile private var phase = "idle"
    @Volatile private var progress = 0
    private var ready: File? = null
    private var digest = ""
    fun status() = JSONObject().put("phase", phase).put("progress", progress)
    @Synchronized fun start(version: String): JSONObject {
        if (phase == "downloading") return status()
        require(version.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+")))
        phase = "downloading"; progress = 0; ready = null
        Thread {
            try {
                val release = JSONObject(read("https://api.github.com/repos/kabachok-hub/spoty-app/releases/tags/v$version"))
                require(!release.optBoolean("draft") && release.getString("tag_name") == "v$version")
                val assets = release.getJSONArray("assets")
                val name = "Spoty-Android-$version.apk"
                val asset = (0 until assets.length()).map { assets.getJSONObject(it) }.first { it.getString("name") == name && it.getString("state") == "uploaded" }
                val expected = asset.getString("digest")
                require(expected.matches(Regex("sha256:[a-f0-9]{64}")))
                val length = asset.getLong("size"); require(length in 1..100_000_000)
                val url = "https://github.com/kabachok-hub/spoty-app/releases/download/v$version/$name"
                require(asset.getString("browser_download_url") == url)
                val directory = File(activity.cacheDir, "updates").apply { mkdirs() }
                val file = File(directory, "update.apk")
                val connection = connect(url)
                try {
                    require(connection.responseCode == 200)
                    connection.inputStream.use { input -> file.outputStream().use { output ->
                        val buffer = ByteArray(32768); var count = 0L
                        while (true) {
                            val n = input.read(buffer); if (n < 0) break
                            count += n; require(count <= length); output.write(buffer, 0, n)
                            progress = (count * 100 / length).toInt()
                        }
                        require(count == length)
                    } }
                } finally { connection.disconnect() }
                digest = expected.removePrefix("sha256:")
                require(hash(file) == digest); validatePackage(file)
                ready = file; phase = "downloaded"
            } catch (_: Exception) { ready = null; phase = "error"; progress = 0 }
        }.start()
        return status()
    }
    private fun connect(value: String): HttpURLConnection {
        var url = URL(value)
        repeat(6) {
            require(url.protocol == "https" && url.userInfo == null && (url.port == -1 || url.port == 443))
            require(url.host in listOf("api.github.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"))
            val connection = url.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false; connection.connectTimeout = 15000; connection.readTimeout = 30000
            connection.setRequestProperty("Accept", "application/vnd.github+json")
            if (connection.responseCode in listOf(301, 302, 303, 307, 308)) {
                val next = connection.getHeaderField("Location"); connection.disconnect(); url = URL(url, next)
            } else return connection
        }
        error("Redirect limit")
    }
    private fun read(url: String): String {
        val connection = connect(url)
        try { require(connection.responseCode == 200); return connection.inputStream.use { input ->
            val bytes = input.readBytesBounded(2_000_000); String(bytes, Charsets.UTF_8)
        } } finally { connection.disconnect() }
    }
    private fun java.io.InputStream.readBytesBounded(max: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
        while (true) { val n = read(buffer); if (n < 0) break; require(out.size() + n <= max); out.write(buffer, 0, n) }
        return out.toByteArray()
    }
    private fun hash(file: File): String {
        val hash = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val buffer = ByteArray(32768); while (true) { val n = input.read(buffer); if (n < 0) break; hash.update(buffer, 0, n) } }
        return hash.digest().joinToString("") { "%02x".format(it) }
    }
    @Suppress("DEPRECATION")
    private fun validatePackage(file: File) {
        val pm = activity.packageManager
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val candidate = pm.getPackageArchiveInfo(file.path, flags) ?: error("Invalid APK")
        val current = pm.getPackageInfo(activity.packageName, flags)
        require(candidate.packageName == activity.packageName)
        val newer = if (Build.VERSION.SDK_INT >= 28) candidate.longVersionCode > current.longVersionCode else candidate.versionCode > current.versionCode
        require(newer)
        val a = if (Build.VERSION.SDK_INT >= 28) candidate.signingInfo?.apkContentsSigners else candidate.signatures
        val b = if (Build.VERSION.SDK_INT >= 28) current.signingInfo?.apkContentsSigners else current.signatures
        require(!a.isNullOrEmpty() && !b.isNullOrEmpty() && a.toSet() == b.toSet())
    }
    fun install(): JSONObject {
        val file = ready ?: error("Not downloaded")
        require(phase == "downloaded" && hash(file) == digest); validatePackage(file)
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            return status().put("permissionRequired", true)
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", file)
        activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        return status()
    }
}
