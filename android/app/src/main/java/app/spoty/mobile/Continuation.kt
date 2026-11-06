package app.spoty.mobile

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

class Continuation(private val api: AppHttp) {
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
    fun next(track: JSONObject, existing: List<String>, token: String?): List<JSONObject> {
        val context = track.optJSONObject("playback_context")
        val visited = mutableSetOf<String>()
        context?.optJSONArray("visitedMixIds")?.let { array -> for (i in 0 until array.length()) visited.add(array.optString(i)) }
        context?.optString("id")?.let { visited.add(it) }
        val excluded = existing.toSet()
        fun fresh(array: JSONArray): List<JSONObject> = (0 until minOf(array.length(), 100))
            .mapNotNull { array.optJSONObject(it) }.filter { it.optString("id") !in excluded && it.optDouble("duration") >= 45 }
            .distinctBy { it.optString("id") }
        if (context?.optString("id")?.startsWith("autoplay-radio-") != true) {
            try {
                val home = JSONObject(api.request("/recommendations/home", expectedToken = token))
                val candidates = mutableListOf<JSONObject>()
                context?.optJSONObject("nextMix")?.let { candidates.add(it) }
                for (key in listOf("daily_mixes", "best_mixes", "recommended_stations")) {
                    val rows = home.optJSONArray(key) ?: continue
                    for (i in 0 until rows.length()) rows.optJSONObject(i)?.let { candidates.add(it) }
                }
                for (mix in candidates.filter { it.optString("query").isNotBlank() && it.optString("id") !in visited }.distinctBy { it.optString("id") }.take(3)) {
                    visited.add(mix.optString("id"))
                    try {
                        val rows = fresh(JSONArray(api.request("/recommendations/mix/tracks?q=${encode(mix.getString("query"))}&limit=50&mix_id=${encode(mix.getString("id"))}", expectedToken = token)))
                        if (rows.isNotEmpty()) {
                            val origin = JSONObject(mix.toString()).put("visitedMixIds", JSONArray(visited.toList())).put("type", "mix")
                            return rows.map { it.put("recommended_automatically", true).put("playback_context", origin) }
                        }
                    } catch (_: Exception) { /* A failed context cannot block the radio fallback. */ }
                }
            } catch (_: Exception) { /* Unavailable home does not prevent radio continuation. */ }
        }
        val artist = track.optString("artist_name")
        val rows = fresh(JSONArray(api.request("/tracks/${encode(track.getString("id"))}/similar?artist_name=${encode(artist)}&title=${encode(track.optString("title"))}&limit=40&exclude=${encode(existing.takeLast(300).joinToString(","))}", expectedToken = token)))
        val origin = JSONObject().put("id", "autoplay-radio-${track.optString("artist_id", artist)}")
            .put("title", "$artist: радио").put("query", artist).put("type", "radio").put("visitedMixIds", JSONArray(visited.toList()))
        return rows.map { it.put("recommended_automatically", true).put("playback_context", origin) }
    }
    companion object {
        fun entry(track: JSONObject): JSONObject {
            val url = BuildConfig.SERVER_ORIGIN + "/api/v1/stream?track_id=${URLEncoder.encode(track.getString("id"), "UTF-8")}&q=${URLEncoder.encode(track.optString("artist_name") + " - " + track.optString("title"), "UTF-8")}&duration=${track.optInt("duration")}&recording_version=0"
            return JSONObject().put("occurrenceId", UUID.randomUUID().toString()).put("track", track).put("url", url)
        }
    }
}
