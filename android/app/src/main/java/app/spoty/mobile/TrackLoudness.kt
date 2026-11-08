package app.spoty.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.Executors

class TrackLoudness(context: Context, private val changed: () -> Unit) {
    private val vault = TokenVault(context)
    private val data = context.getSharedPreferences("track-loudness-v1", Context.MODE_PRIVATE)
    private val worker = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val jobs = mutableSetOf<String>()
    private var alive = true
    private fun key(entry: JSONObject) = MessageDigest.getInstance("SHA-256").digest(entry.getString("url").toByteArray()).joinToString("") { "%02x".format(it) }
    fun gain(entry: JSONObject?) = entry?.let { data.getFloat(key(it),1f).coerceIn(.05f,2f) } ?: 1f
    fun prepare(entry: JSONObject) {
        val key = key(entry)
        if (!alive || data.contains(key) || key in jobs || jobs.size >= 4) return
        jobs.add(key); fetch(key, entry.getJSONObject("track").getString("id"), vault.get(), 0)
    }
    private fun fetch(key: String, id: String, token: String?, attempt: Int) {
        if (!alive) return
        worker.execute {
            val profile = try { JSONObject(AppHttp(vault).request("/stream/loudness?track_id="+URLEncoder.encode(id,"UTF-8"), expectedToken=token)) } catch (_: Exception) { JSONObject() }
            handler.post {
                if (!alive) return@post
                val gain = profile.optDouble("gain",Double.NaN)
                if (profile.optString("status") == "ready" && gain.isFinite() && gain in .05..2.0) {
                    val edit = data.edit()
                    for (old in data.all.keys.take((data.all.size - 255).coerceAtLeast(0))) edit.remove(old)
                    edit.putFloat(key,gain.toFloat()).apply(); jobs.remove(key); changed()
                } else if (attempt < 5 && vault.get() == token) handler.postDelayed({ fetch(key,id,token,attempt+1) },4000)
                else jobs.remove(key)
            }
        }
    }
    fun close() { alive = false; handler.removeCallbacksAndMessages(null); worker.shutdownNow() }
}
