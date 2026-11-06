package app.spoty.mobile

import android.app.PendingIntent
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.pow

@UnstableApi
class PlaybackService : MediaSessionService() {
    companion object { var instance: PlaybackService? = null; private set }
    private lateinit var player: ExoPlayer
    private var session: MediaSession? = null
    private val handler = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val recovery = RecoveryPolicy()
    private val equalizer = NativeEqualizer()
    private lateinit var audioCache: AudioCache
    private var equalizerSettings: JSONObject? = null
    private var queue = mutableListOf<JSONObject>()
    private var played = linkedSetOf<String>()
    private var clientId = ""
    private var revision = 0L
    private var uiPlayToken = 0L
    private var generation = 0L
    private var shuffle = false
    private var error: String? = null
    private var notice: String? = null
    private var changing = false
    private var technicalTransition = false
    private var continuing = false
    private var continuationWaiting = false
    private var continuationAttempt = ""
    private var continuationJob = false
    private var lastPosition = 0L
    private var healthyMs = 0L
    private var waitingSince = 0L
    private var tickCount = 0
    private var coverage = ListeningCoverage()
    private var coverageDuration = 0.0
    private var occurrence = ""
    private var historyRecorded = false
    private var eventId = UUID.randomUUID().toString()
    var observer: ((JSONObject) -> Unit)? = null

    override fun onCreate() {
        super.onCreate(); instance = this
        audioCache = AudioCache(this)
        val sources = DefaultMediaSourceFactory(audioCache.factory)
            .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(0))
        val loadControl = DefaultLoadControl.Builder().setBufferDurationsMs(15000, 45000, 1000, 2000).build()
        player = ExoPlayer.Builder(this).setMediaSourceFactory(sources).setLoadControl(loadControl).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            setHandleAudioBecomingNoisy(true); setWakeMode(C.WAKE_MODE_NETWORK)
        }
        session = MediaSession.Builder(this, player).setSessionActivity(PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).build()
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
                if (changing) return
                val next = item?.mediaId.orEmpty()
                if (next != occurrence || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) {
                    finishCoverage(reason == Player.MEDIA_ITEM_TRANSITION_REASON_SEEK && !technicalTransition)
                    occurrence = next; coverage = ListeningCoverage(); historyRecorded = false; eventId = UUID.randomUUID().toString()
                    coverageDuration = trackDuration()
                    current()?.getJSONObject("track")?.let { played.add(it.getString("id")) }
                    if (shuffle && player.repeatMode == Player.REPEAT_MODE_ALL && queue.all { it.getJSONObject("track").getString("id") in played }) {
                        played.clear(); current()?.getJSONObject("track")?.let { played.add(it.getString("id")) }
                    }
                    if (played.size > 300) played = LinkedHashSet(played.toList().takeLast(300))
                    current()?.getJSONObject("track")?.put("queued_next", false)
                    healthyMs = 0; waitingSince = 0; lastPosition = player.currentPosition
                    error = null; technicalTransition = false
                    if (shuffle) handler.post { if (instance === this@PlaybackService) arrange() }
                    publish(true); persist(); fillQueue(); warmUpcoming()
                }
            }
            override fun onPlaybackStateChanged(state: Int) {
                waitingSince = 0
                if (state == Player.STATE_BUFFERING) coverage.interrupt()
                if (state == Player.STATE_ENDED && !changing) {
                    finishCoverage(false)
                    continuationWaiting = player.playWhenReady && player.repeatMode == Player.REPEAT_MODE_OFF
                    if (continuationWaiting) {
                        fillQueue()
                        if (!continuationJob && !player.hasNextMediaItem()) {
                            continuationWaiting = false; player.pause()
                            error = "Пока не удалось подобрать продолжение. Выберите другой микс."
                        }
                    }
                }
                if (!changing) publish()
            }
            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (!playWhenReady) { coverage.interrupt(); continuationWaiting = false }
                waitingSince = 0
                if (playWhenReady && !changing) fillQueue()
                if (!changing) { publish(); persist() }
            }
            override fun onPositionDiscontinuity(old: Player.PositionInfo, new: Player.PositionInfo, reason: Int) {
                if (old.mediaItem?.mediaId == new.mediaItem?.mediaId) coverage.interrupt()
                lastPosition = new.positionMs; healthyMs = 0; waitingSince = 0
            }
            override fun onPlayerError(problem: PlaybackException) {
                coverage.interrupt(true); recover()
            }
        })
        try {
            getSharedPreferences("player", MODE_PRIVATE).getString("resume", null)?.let { saved ->
                sync(JSONObject(saved).put("playing", false).put("clientId", "restore").put("revision", 0))
            }
        } catch (_: Exception) { getSharedPreferences("player", MODE_PRIVATE).edit().clear().apply() }
        handler.post(tick)
    }
    private fun id(entry: JSONObject) = entry.getString("occurrenceId")
    private fun current() = queue.find { id(it) == player.currentMediaItem?.mediaId }
    private fun index() = queue.indexOfFirst { id(it) == player.currentMediaItem?.mediaId }
    private fun trackDuration() = current()?.optJSONObject("track")?.optDouble("duration", 0.0) ?: 0.0
    private fun media(entry: JSONObject): MediaItem {
        val track = entry.getJSONObject("track")
        val metadata = MediaMetadata.Builder().setTitle(track.optString("title")).setArtist(track.optString("artist_name"))
            .setAlbumTitle(track.optString("album_title"))
        val artwork = track.optString("cover_url")
        if (artwork.startsWith("https://")) metadata.setArtworkUri(Uri.parse(artwork))
        return MediaItem.Builder().setMediaId(id(entry)).setUri(entry.getString("url")).setMediaMetadata(metadata.build()).build()
    }
    private fun validate(entry: JSONObject) {
        require(id(entry).length in 1..160)
        val uri = Uri.parse(entry.getString("url"))
        require(uri.scheme == "https" && uri.authority == Uri.parse(BuildConfig.SERVER_ORIGIN).authority && uri.path == "/api/v1/stream")
        require(uri.getQueryParameter("track_id") == entry.getJSONObject("track").getString("id"))
    }
    fun sync(data: JSONObject): JSONObject {
        val newClient = data.getString("clientId"); val incoming = data.getLong("revision")
        if (newClient == clientId && incoming < revision) return snapshot(true)
        val array = data.getJSONArray("queue")
        require(array.length() <= 1000)
        val fresh = (0 until array.length()).map { array.getJSONObject(it).also(::validate) }.toMutableList()
        require(fresh.map(::id).toSet().size == fresh.size)
        val selected = fresh.getOrNull(data.optInt("index", -1))
        val sameOccurrence = selected != null && id(selected) == player.currentMediaItem?.mediaId
        val manualChange = selected != null && selected.getJSONObject("track").optString("id") != current()?.getJSONObject("track")?.optString("id")
        val token = data.optLong("playToken")
        val newPlayback = !sameOccurrence || token != uiPlayToken
        val structureChanged = queue.map { id(it) to it.getString("url") } != fresh.map { id(it) to it.getString("url") }
        val oldPosition = player.currentPosition
        clientId = newClient; revision = incoming
        changing = true
        try {
            if (newPlayback) {
                finishCoverage(manualChange); generation++; continuationAttempt = ""; continuing = false; continuationWaiting = false
                coverage = ListeningCoverage(); historyRecorded = false; eventId = UUID.randomUUID().toString(); recovery.newQueue()
                coverageDuration = selected?.getJSONObject("track")?.optDouble("duration", 0.0) ?: 0.0
                played.clear(); selected?.getJSONObject("track")?.let { played.add(it.getString("id")) }
            } else if (structureChanged) { generation++; continuationAttempt = "" }
            queue = fresh; uiPlayToken = token; shuffle = data.optBoolean("shuffle")
            equalizerSettings = data.optJSONObject("equalizer")
            equalizer.apply(player.audioSessionId, equalizerSettings)
            player.repeatMode = when (data.optString("repeat")) { "one" -> Player.REPEAT_MODE_ONE; "all" -> Player.REPEAT_MODE_ALL; else -> Player.REPEAT_MODE_OFF }
            if (selected == null) {
                player.pause(); player.clearMediaItems(); occurrence = ""
            } else {
                occurrence = id(selected)
                arrange(selected)
                val physicalIndex = (0 until player.mediaItemCount).first { player.getMediaItemAt(it).mediaId == id(selected) }
                if (newPlayback || data.optBoolean("seek")) {
                    player.seekTo(physicalIndex, (data.optDouble("position", 0.0).coerceAtLeast(0.0) * 1000).toLong())
                    if (!newPlayback || data.optDouble("position", 0.0) > 0) coverage.interrupt()
                    waitingSince = 0
                } else if (player.currentMediaItemIndex != physicalIndex) player.seekTo(physicalIndex, oldPosition)
                val volume = data.optDouble("volume", .5).coerceIn(0.0, 1.5)
                player.volume = (minOf(1.0, volume).pow(2.8) * .5 + maxOf(0.0, volume - 1.0)).toFloat().coerceIn(0f, 1f)
                if (newPlayback || player.playbackState == Player.STATE_IDLE) player.prepare()
                player.playWhenReady = data.optBoolean("playing")
            }
            error = null; notice = null
        } finally { changing = false }
        publish(true); persist(); if (player.playWhenReady) { fillQueue(); warmUpcoming() }
        return snapshot(true)
    }
    /** Minimal playlist edits keep the current decoder/position when UI edits upcoming items. */
    private fun arrange(selected: JSONObject? = current()) {
        val logicalIndex = queue.indexOfFirst { id(it) == selected?.let(::id) }
        val slots = queue.map { val t = it.getJSONObject("track"); QueueSlot(id(it), t.getString("id"), t.optJSONObject("playback_context")?.optString("id").orEmpty(), t.optBoolean("queued_next")) }
        val order = queueOrder(slots, logicalIndex, shuffle, played)
        for ((target, occurrenceId) in order.withIndex()) {
            val entry = queue.first { id(it) == occurrenceId }
            val found = (target until player.mediaItemCount).firstOrNull { player.getMediaItemAt(it).mediaId == occurrenceId }
            if (found == null) player.addMediaItem(target, media(entry))
            else {
                if (found != target) player.moveMediaItem(found, target)
                val old = player.getMediaItemAt(target)
                if (old.localConfiguration?.uri.toString() != entry.getString("url")) player.replaceMediaItem(target, media(entry))
            }
        }
        if (player.mediaItemCount > order.size) player.removeMediaItems(order.size, player.mediaItemCount)
    }
    fun snapshot(full: Boolean = false): JSONObject = JSONObject().put("clientId", clientId).put("revision", revision)
        .put("playToken", uiPlayToken)
        .put("occurrenceId", player.currentMediaItem?.mediaId ?: "")
        .put("position", player.currentPosition.coerceAtLeast(0) / 1000.0)
        .put("duration", if (player.duration > 0) player.duration / 1000.0 else trackDuration())
        .put("playWhenReady", player.playWhenReady && (player.playbackState != Player.STATE_ENDED || (continuing && continuationWaiting)))
        .put("playing", player.isPlaying).put("shuffle", shuffle)
        .put("playedTrackIds", JSONArray(played.toList()))
        .put("repeat", when (player.repeatMode) { Player.REPEAT_MODE_ONE -> "one"; Player.REPEAT_MODE_ALL -> "all"; else -> "off" })
        .put("continuing", continuing && continuationWaiting).put("error", error ?: JSONObject.NULL).put("notice", notice ?: JSONObject.NULL)
        .also { if (full) it.put("queue", JSONArray(queue)) }
    private fun publish(full: Boolean = false) { if (!changing) observer?.invoke(snapshot(full)) }
    private fun persist() {
        if (changing) return
        val saved = snapshot(true).put("index", index()).put("playing", false).put("playToken", uiPlayToken)
        getSharedPreferences("player", MODE_PRIVATE).edit().putString("resume", saved.toString()).apply()
    }
    fun logout() {
        generation++; queue.clear(); played.clear(); continuationWaiting = false; continuing = false
        changing = true; player.pause(); player.clearMediaItems(); changing = false
        getSharedPreferences("player", MODE_PRIVATE).edit().clear().apply(); publish(true)
        audioCache.warm(emptyList())
    }
    private fun warmUpcoming() {
        if (!player.playWhenReady || player.repeatMode == Player.REPEAT_MODE_ONE) { audioCache.warm(emptyList()); return }
        val start = player.currentMediaItemIndex + 1
        audioCache.warm((start until minOf(start + 2, player.mediaItemCount)).mapNotNull { player.getMediaItemAt(it).localConfiguration?.uri?.toString() })
    }
    private fun recover() {
        if (!player.playWhenReady || current() == null) return
        val online = (getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager).activeNetwork != null
        val decision = recovery.failed(player.currentMediaItem!!.mediaId, player.hasNextMediaItem(), player.repeatMode == Player.REPEAT_MODE_ONE, !online)
        coverage.interrupt(true); waitingSince = 0
        when (decision) {
            RecoveryPolicy.Decision.RETRY -> {
                notice = "Повторная загрузка записи…"
                val position = player.currentPosition.coerceAtLeast(0)
                player.stop(); player.seekTo(position); player.prepare()
            }
            RecoveryPolicy.Decision.NEXT -> { notice = "Запись недоступна. Включаем следующую."; technicalTransition = true; player.seekToNextMediaItem(); player.prepare() }
            RecoveryPolicy.Decision.STOP -> { player.pause(); error = "Не удалось загрузить запись. Проверьте подключение или выберите другой трек."; player.stop() }
        }
        publish(true)
    }
    private fun finishCoverage(manual: Boolean) {
        val entry = queue.find { id(it) == occurrence } ?: return
        val duration = coverageDuration
        val result = coverage.finish(duration, manual) ?: return
        val body = JSONObject().put("event_id", eventId).put("track_id", entry.getJSONObject("track").getString("id"))
            .put("outcome", result).put("heard_seconds", minOf(duration, coverage.heard)).put("duration", duration)
        post("/me/history/feedback", body)
    }
    private fun post(path: String, body: JSONObject) {
        val vault = TokenVault(this); val token = vault.get() ?: return
        worker.execute { try { AppHttp(vault).request(path, body, token) } catch (_: Exception) { /* Best effort; no persistent telemetry. */ } }
    }
    private fun fillQueue() {
        val active = current() ?: return
        if (player.repeatMode != Player.REPEAT_MODE_OFF || !player.playWhenReady || continuationJob) return
        val remaining = if (shuffle) queue.count { it.getJSONObject("track").getString("id") !in played } else queue.size - index() - 1
        if (remaining > 8 || continuationAttempt == id(active)) return
        continuationAttempt = id(active); continuationJob = true; continuing = true
        val expected = generation; val vault = TokenVault(this); val token = vault.get()
        val track = JSONObject(active.getJSONObject("track").toString()); val existing = queue.map { it.getJSONObject("track").getString("id") }
        worker.execute {
            val result = try { Continuation(AppHttp(vault)).next(track, existing, token) } catch (_: Exception) { emptyList() }
            handler.post {
                if (instance !== this) return@post
                continuationJob = false
                if (expected != generation || vault.get() != token) { continuing = false; if (player.playWhenReady) fillQueue(); return@post }
                val known = queue.map { it.getJSONObject("track").getString("id") }.toMutableSet()
                val fresh = result.filter { known.add(it.getString("id")) }.take(50)
                continuing = false
                if (fresh.isNotEmpty() && queue.size < 900) {
                    queue.addAll(fresh.map(Continuation::entry)); arrange()
                    if (continuationWaiting && player.playWhenReady) { continuationWaiting = false; player.seekToNextMediaItem(); player.prepare() }
                } else if (continuationWaiting) {
                    continuationWaiting = false; player.pause(); error = "Пока не удалось подобрать продолжение. Выберите другой микс."
                }
                publish(true); persist()
            }
        }
    }
    private val tick = object : Runnable {
        override fun run() {
            val position = player.currentPosition
            equalizer.apply(player.audioSessionId, equalizerSettings)
            if (player.duration > 0) coverageDuration = player.duration / 1000.0
            val delta = position - lastPosition; lastPosition = position
            coverage.sample(position.coerceAtLeast(0) / 1000.0, SystemClock.elapsedRealtime(), player.isPlaying)
            if (player.isPlaying && delta in 1..2500) {
                healthyMs += delta; waitingSince = 0
                if (healthyMs >= 5000) { recovery.healthyProgress(); notice = null }
                if (!historyRecorded) {
                    historyRecorded = true
                    current()?.getJSONObject("track")?.let { t -> post("/me/history", JSONObject().put("track_id", t.getString("id"))
                        .put("title", t.optString("title")).put("artist_name", t.optString("artist_name"))
                        .put("cover_url", t.optString("cover_url")).put("duration", t.optInt("duration"))) }
                }
            } else {
                healthyMs = 0
                if (player.playWhenReady && player.playbackSuppressionReason == Player.PLAYBACK_SUPPRESSION_REASON_NONE
                    && player.playbackState in listOf(Player.STATE_BUFFERING, Player.STATE_READY)) {
                    val now = SystemClock.elapsedRealtime(); if (waitingSince == 0L) waitingSince = now
                    if (now - waitingSince >= if (player.playbackState == Player.STATE_BUFFERING) 45000 else 20000) { coverage.interrupt(true); recover() }
                } else waitingSince = 0
            }
            publish(); tickCount++
            if (tickCount % 5 == 0) { persist(); if (player.playWhenReady) { fillQueue(); warmUpcoming() } }
            handler.postDelayed(this, 1000)
        }
    }
    override fun onGetSession(info: MediaSession.ControllerInfo): MediaSession? = session
    override fun onDestroy() {
        persist(); handler.removeCallbacksAndMessages(null); observer = null; instance = null
        audioCache.close(); worker.shutdownNow(); equalizer.release(); session?.release(); player.release(); super.onDestroy()
    }
}
