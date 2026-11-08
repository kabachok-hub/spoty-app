package app.spoty.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlin.math.cos
import kotlin.math.sin

/** A temporary outgoing tail. The primary player remains the only MediaSession owner. */
@UnstableApi
class NativeBlend(private val context: Context, private val player: ExoPlayer, private val cache: AudioCache,
    private val master: () -> Float, private val gain: (String?) -> Float) {
    private val handler = Handler(Looper.getMainLooper())
    private var tail: ExoPlayer? = null
    private val processor = TrackGainProcessor()
    private var seconds = 0.0
    private var prepared = ""
    private var pending = false
    private var fading = false
    private var started = 0L
    private var duration = 1L
    private var expected = ""
    private var ownUntil = 0L
    private var alive = true
    private var incomingWeight = 1f
    private var outgoingWeight = 0f
    fun ownsTransition(id: String?) = id == expected && SystemClock.elapsedRealtime() < ownUntil
    fun configure(value: Double) {
        seconds = if (value in listOf(3.0,5.0,8.0,12.0)) value else 0.0
        if (seconds == 0.0) cancel()
        handler.removeCallbacks(tick)
        if (seconds > 0 && alive) handler.post(tick)
    }
    fun applyVolumes() {
        player.volume = (master() * incomingWeight).coerceIn(0f,1f)
        tail?.volume = (master() * outgoingWeight).coerceIn(0f,1f)
        processor.targetGain = gain(tail?.currentMediaItem?.mediaId)
    }
    fun cancel() {
        fading = false; pending = false; prepared = ""; incomingWeight = 1f; outgoingWeight = 0f
        tail?.pause(); tail?.clearMediaItems(); applyVolumes()
    }
    private fun tail(): ExoPlayer = tail ?: ExoPlayer.Builder(context, GainRenderers(context,processor))
        .setMediaSourceFactory(DefaultMediaSourceFactory(cache.factory)).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),false)
            setHandleAudioBecomingNoisy(true); setWakeMode(C.WAKE_MODE_NETWORK)
            addListener(object : Player.Listener { override fun onPlayerError(error: PlaybackException) { cancel() } })
        }.also { tail = it }
    private val tick = object : Runnable {
        override fun run() {
            if (!alive || seconds <= 0) return
            var delay = 500L
            try {
                val now = SystemClock.elapsedRealtime(); val remaining = player.duration - player.currentPosition
                if (!player.playWhenReady || player.playbackSuppressionReason != Player.PLAYBACK_SUPPRESSION_REASON_NONE) cancel()
                else if (fading) {
                    val p = ((now-started).toDouble()/duration).coerceIn(0.0,1.0)
                    val into = sin(p*Math.PI/2); val out = cos(p*Math.PI/2); val total = maxOf(1.0,into+out)
                    incomingWeight = (into/total).toFloat(); outgoingWeight = (out/total).toFloat(); applyVolumes(); delay = 50
                    if (p >= 1) cancel()
                } else if (player.isPlaying && player.repeatMode != Player.REPEAT_MODE_ONE && player.hasNextMediaItem()
                    && player.duration > seconds*2000 + 10000 && remaining in 200..((seconds+4)*1000).toLong()) {
                    val current = player.currentMediaItem ?: return
                    val shadow = tail(); delay = 50
                    if (prepared != current.mediaId) {
                        prepared = current.mediaId; processor.targetGain = gain(current.mediaId)
                        if (player.audioSessionId > 0) shadow.audioSessionId = player.audioSessionId
                        shadow.setMediaItem(current, player.currentPosition); shadow.volume = 0f; shadow.prepare()
                    }
                    if (pending && shadow.isPlaying) {
                        expected = player.getMediaItemAt(player.nextMediaItemIndex).mediaId; ownUntil = now+750
                        duration = remaining.coerceAtLeast(200); started = now; pending = false; fading = true
                        incomingWeight = 0f; outgoingWeight = 1f; applyVolumes()
                        player.seekToNextMediaItem(); player.play()
                    } else if (!pending && remaining <= seconds*1000 && shadow.playbackState == Player.STATE_READY
                        && cache.hasStart(player.getMediaItemAt(player.nextMediaItemIndex).localConfiguration?.uri.toString())) {
                        shadow.seekTo(player.currentPosition); shadow.play(); pending = true
                    }
                }
            } catch (_: Exception) { cancel() }
            if (alive && seconds > 0) handler.postDelayed(this,delay)
        }
    }
    fun close() { alive = false; handler.removeCallbacksAndMessages(null); cancel(); tail?.release(); tail = null }
}
