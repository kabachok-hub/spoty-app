package app.spoty.mobile

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Background-thread API client; only the existing fixed HTTPS server is reachable. */
class AppHttp(private val vault: TokenVault) {
    fun request(path: String, body: JSONObject? = null, expectedToken: String? = vault.get()): String {
        require(path.startsWith("/") && !path.startsWith("//") && path.length <= 12000)
        check(vault.get() == expectedToken) { "Account changed" }
        val connection = URL(BuildConfig.SERVER_ORIGIN + "/api/v1" + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000; connection.readTimeout = 20000
        connection.instanceFollowRedirects = false
        expectedToken?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        connection.setRequestProperty("Accept", "application/json")
        try {
            if (body != null) {
                connection.requestMethod = "POST"; connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            check(connection.responseCode in 200..299) { "API request failed" }
            return connection.inputStream.use { stream ->
                val bytes = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = stream.read(buffer); if (count < 0) break
                    check(bytes.size() + count <= 5 * 1024 * 1024)
                    bytes.write(buffer, 0, count)
                }
                String(bytes.toByteArray(), Charsets.UTF_8)
            }
        } finally { connection.disconnect() }
    }
}
