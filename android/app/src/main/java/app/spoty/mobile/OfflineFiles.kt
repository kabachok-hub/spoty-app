package app.spoty.mobile

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class OfflineFiles private constructor(private val context: Context) {
    companion object {
        private var shared: OfflineFiles? = null
        @Synchronized fun get(context: Context) = shared ?: OfflineFiles(context.applicationContext).also { shared = it }
    }
    private val vault = TokenVault(context)
    private var marker: String? = "uninitialized"
    private var account = "guest"
    private var loadedOwner = ""
    private var entries = JSONObject()
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var phase = "idle"
    @Volatile private var progress = 0
    @Volatile private var cancelled = false
    @Volatile private var connection: HttpURLConnection? = null
    private var message = ""
    private fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    @Synchronized private fun owner(): String {
        val current = context.getSharedPreferences("session", Context.MODE_PRIVATE).getString("encrypted", null)
        if (current != marker) { marker = current; account = vault.account(vault.get())?.toString() ?: "guest" }
        return hash(account)
    }
    private fun directory(key: String) = File(context.filesDir, "offline/$key").apply { mkdirs() }
    @Synchronized private fun metadata(): JSONObject {
        val key = owner()
        if (key != loadedOwner) {
            entries = try { JSONObject(File(directory(key), "index.json").readText()) } catch (_: Exception) { JSONObject() }
            loadedOwner = key
        }
        return entries
    }
    @Synchronized private fun save() {
        val root = directory(loadedOwner); val part = File(root, "index.tmp")
        part.writeText(entries.toString()); check(part.renameTo(File(root, "index.json")))
    }
    private fun limit(key: String = owner()) = context.getSharedPreferences("offline-limits", Context.MODE_PRIVATE).getInt(key, 512)
    @Synchronized fun list(): JSONObject {
        val data = metadata(); val rows = data.keys().asSequence().map { data.getJSONObject(it) }.toList().sortedByDescending { it.optLong("addedAt") }
        return JSONObject().put("tracks", JSONArray(rows)).put("limitMB", limit())
    }
    fun status() = JSONObject().put("phase", phase).put("progress", progress).put("message", message)
    @Synchronized fun setLimit(mb: Int): JSONObject {
        require(mb in listOf(128,512,1024,2048))
        val data = metadata(); require(data.keys().asSequence().sumOf { data.getJSONObject(it).optLong("bytes") } <= mb * 1024L * 1024)
        context.getSharedPreferences("offline-limits", Context.MODE_PRIVATE).edit().putInt(owner(), mb).apply()
        return list()
    }
    @Synchronized fun remove(id: String): JSONObject {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,80}")))
        metadata().remove(id); File(directory(owner()), hash(id)+".audio").delete(); save(); return list()
    }
    @Synchronized fun source(id: String, source: String): File? {
        val row = metadata().optJSONObject(id) ?: return null
        if (Uri.parse(row.optString("url")).getQueryParameter("recording_version") != Uri.parse(source).getQueryParameter("recording_version")) return null
        return File(directory(owner()), hash(id)+".audio").takeIf { it.isFile && it.length() == row.optLong("bytes") }
    }
    @Synchronized fun played(id: String) { metadata().optJSONObject(id)?.let { it.put("lastPlayedAt", System.currentTimeMillis()); save() } }
    fun cancel() { cancelled = true; connection?.disconnect() }
    @Synchronized fun start(input: JSONObject): JSONObject {
        require(phase != "downloading")
        val track = input.getJSONObject("track"); val id = track.getString("id"); val source = input.getString("url")
        require(id.matches(Regex("[A-Za-z0-9_-]{1,80}")))
        val uri = Uri.parse(source)
        require(uri.scheme == "https" && uri.userInfo == null && uri.authority == Uri.parse(BuildConfig.SERVER_ORIGIN).authority && uri.path == "/api/v1/stream")
        require(uri.getQueryParameter("track_id") == id && uri.queryParameterNames.all { it in listOf("track_id","q","duration","recording_version") })
        val key = owner(); val root = directory(key); val part = File(root, hash(id)+".part")
        val safe = JSONObject()
        for (field in listOf("id","title","artist_name","artist_id","album_title","cover_url")) safe.put(field, track.optString(field).take(if (field == "cover_url") 2000 else 300))
        safe.put("duration", track.optDouble("duration",0.0).coerceIn(0.0,14400.0))
        metadata(); cancelled = false; progress = 0; message = ""; phase = "downloading"
        executor.execute {
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND)
            try {
                val conn = URL(source).openConnection() as HttpURLConnection
                connection = conn; conn.instanceFollowRedirects = false; conn.connectTimeout = 15000; conn.readTimeout = 45000
                require(conn.responseCode == 200 && (conn.contentType?.startsWith("audio/") == true || conn.contentType?.startsWith("application/octet-stream") == true))
                val size = conn.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L; require(size in 10000..(32L*1024*1024))
                synchronized(this) {
                    require(owner() == key)
                    val used = metadata().keys().asSequence().sumOf { metadata().getJSONObject(it).optLong("bytes") }
                    require(used + size <= limit(key)*1024L*1024) { "Лимит офлайн-хранилища исчерпан" }
                }
                conn.inputStream.use { inputStream -> part.outputStream().use { output ->
                    val buffer = ByteArray(32768); var count = 0L
                    while (true) { val n = inputStream.read(buffer); if (n < 0) break
                        count += n; require(!cancelled && count <= size); output.write(buffer,0,n); progress = (count*100/size).toInt()
                    }
                    require(!cancelled && count == size)
                } }
                synchronized(this) {
                    require(!cancelled && owner() == key)
                    check(part.renameTo(File(root, hash(id)+".audio")))
                    val now = System.currentTimeMillis()
                    metadata().put(id, JSONObject().put("track",safe).put("bytes",size).put("addedAt",now).put("lastPlayedAt",now).put("url",source)); save()
                }
                phase = "ready"
            } catch (error: Exception) {
                part.delete(); message = if (cancelled) "Скачивание отменено" else "Не удалось сохранить песню. Проверьте соединение и свободное место."
                phase = "error"
            } finally { connection?.disconnect(); connection = null }
        }
        return status()
    }
}
