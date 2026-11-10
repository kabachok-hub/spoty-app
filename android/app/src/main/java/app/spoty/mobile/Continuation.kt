package app.spoty.mobile

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

class Continuation(private val api: AppHttp) {
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
    fun next(track: JSONObject, existing: List<String>, token: String?): List<JSONObject> {
        val context = track.optJSONObject("playback_context")
        val tuning = track.optJSONObject("mix_tuning")
        val tuningParams = "&novelty=${tuning?.optInt("novelty",70)?.coerceIn(0,100) ?: 70}&diversity=${tuning?.optInt("diversity",50)?.coerceIn(0,100) ?: 50}"
        val visited = mutableSetOf<String>()
        context?.optJSONArray("visitedMixIds")?.let { array -> for (i in 0 until array.length()) visited.add(array.optString(i)) }
        context?.optString("id")?.let { visited.add(it) }
        val excluded = existing.toSet()
        fun fresh(array: JSONArray): List<JSONObject> = (0 until minOf(array.length(), 100))
            .mapNotNull { array.optJSONObject(it) }.filter { it.optString("id") !in excluded && it.optDouble("duration") >= 45 }
            .distinctBy { it.optString("id") }
        if (context?.optString("id")?.startsWith("autoplay-radio-") != true) {
            val candidates = mutableListOf<JSONObject>()
            context?.optJSONObject("nextMix")?.let { candidates.add(it) }
            // A failed Home refresh must not discard the next card already saved in the queue.
            val home = try { JSONObject(api.request("/recommendations/home", expectedToken = token)) } catch (_: Exception) { JSONObject() }
            val feed = mutableListOf<JSONObject>()
            for (key in listOf("daily_mixes", "best_mixes", "recommended_stations")) {
                val rows = home.optJSONArray(key) ?: continue
                for (i in 0 until rows.length()) rows.optJSONObject(i)?.let { feed.add(it) }
            }
            candidates.addAll(feed)
            val preferred = context?.optJSONObject("nextMix")?.optString("id")
            val order = mixSequence(feed.map { it.optString("id") }, context?.optString("id"), preferred, visited)
            for (mixId in order.take(3)) {
                val mix = candidates.find { it.optString("id") == mixId && it.optString("query").isNotBlank() } ?: continue
                visited.add(mixId)
                try {
                    val rows = fresh(JSONArray(api.request("/recommendations/mix/tracks?q=${encode(mix.getString("query"))}&limit=50&mix_id=${encode(mixId)}$tuningParams", expectedToken = token)))
                    if (rows.isNotEmpty()) {
                        val origin = JSONObject(mix.toString()).put("visitedMixIds", JSONArray(visited.toList()))
                        val next = order.firstOrNull { it !in visited }?.let { id -> candidates.find { it.optString("id") == id } }
                        origin.put("nextMix", next ?: JSONObject.NULL)
                        return rows.map { it.put("recommended_automatically", true).put("playback_context", origin) }
                    }
                } catch (_: Exception) { /* Try the next real feed card, never substitute track radio. */ }
            }
            if (context != null) return emptyList()
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
