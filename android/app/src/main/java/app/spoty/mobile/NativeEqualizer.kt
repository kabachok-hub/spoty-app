package app.spoty.mobile
import android.media.audiofx.Equalizer
import org.json.JSONObject
import kotlin.math.abs

/** Optional device effect; unsupported hardware never prevents playback. */
class NativeEqualizer {
    private var effect: Equalizer? = null
    private var session = 0
    private var lastSettings = ""
    fun apply(audioSession: Int, settings: JSONObject?) {
        if (audioSession <= 0 || settings == null) return
        val signature = settings.toString()
        if (session == audioSession && lastSettings == signature) return
        try {
            if (!settings.optBoolean("enabled")) { release(); session = audioSession; lastSettings = signature; return }
            if (session != audioSession || effect == null) { release(); effect = Equalizer(0, audioSession); session = audioSession }
            val eq = effect ?: return
            val input = settings.optJSONArray("bands")
            val frequencies = listOf(60.0, 230.0, 910.0, 3600.0, 14000.0)
            val limits = eq.bandLevelRange
            for (band in 0 until eq.numberOfBands.toInt()) {
                val hz = eq.getCenterFreq(band.toShort()) / 1000.0
                val nearest = frequencies.indices.minBy { abs(kotlin.math.ln(hz / frequencies[it])) }
                val gain = ((input?.optDouble(nearest, 0.0) ?: 0.0).coerceIn(-12.0, 12.0) * 100).toInt()
                eq.setBandLevel(band.toShort(), gain.coerceIn(limits[0].toInt(), limits[1].toInt()).toShort())
            }
            eq.enabled = true; lastSettings = signature
        } catch (_: Exception) { release(); session = audioSession; lastSettings = signature }
    }
    fun release() { try { effect?.release() } catch (_: Exception) { }; effect = null; session = 0; lastSettings = "" }
}
