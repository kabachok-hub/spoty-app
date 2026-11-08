package app.spoty.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.ContentMetadata
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

@UnstableApi
class AudioCache(context: Context) {
    companion object {
        private var shared: SimpleCache? = null
        @Synchronized private fun cache(context: Context): SimpleCache = shared ?: SimpleCache(
            File(context.applicationContext.cacheDir, "audio-v1"), LeastRecentlyUsedCacheEvictor(32L * 1024 * 1024),
            StandaloneDatabaseProvider(context.applicationContext)).also { shared = it }
    }
    private val cache = cache(context)
    val factory: CacheDataSource.Factory = CacheDataSource.Factory().setCache(cache)
        .setUpstreamDataSourceFactory(DefaultDataSource.Factory(context, DefaultHttpDataSource.Factory().setConnectTimeoutMs(10000).setReadTimeoutMs(45000)))
        .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    private val handler = Handler(Looper.getMainLooper())
    private val executor = ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, ArrayBlockingQueue(2))
    private val jobs = mutableMapOf<String, CacheWriter>()
    private val attempted = LinkedHashMap<String, Long>()
    private var closed = false
    fun hasStart(url: String): Boolean {
        if (url.startsWith("file:")) return android.net.Uri.parse(url).path?.let { File(it).isFile } ?: false
        val size = ContentMetadata.getContentLength(cache.getContentMetadata(url))
        return cache.isCached(url,0,minOf(if (size > 0) size else 32768L,32768L))
    }

    /** Same canonical versioned URLs as playback. No current source/time changes. */
    fun warm(urls: List<String>) {
        if (closed) return
        val wanted = urls.filter { it.startsWith("https://") }.distinct().take(2).toSet()
        for (key in jobs.keys.toList()) if (key !in wanted) { jobs.remove(key)?.cancel() }
        val now = SystemClock.elapsedRealtime()
        for (url in wanted) {
            if (jobs.containsKey(url) || now - (attempted[url] ?: -60000L) < 30000) continue
            val length = ContentMetadata.getContentLength(cache.getContentMetadata(url))
            if (length > 0 && cache.isCached(url, 0, minOf(length, 12L * 1024 * 1024))) continue
            val writer = CacheWriter(factory.createDataSource(), DataSpec.Builder().setUri(url).build(), null) { requestLength, bytesCached, _ ->
                if (requestLength > 12L * 1024 * 1024 || bytesCached > 12L * 1024 * 1024) throw java.io.IOException("Prefetch size bound")
            }
            jobs[url] = writer
            try {
                executor.execute {
                    try { writer.cache() } catch (_: Exception) { /* Optional prefetch must not stop audio. */ }
                    finally { handler.post { if (jobs[url] === writer) jobs.remove(url) } }
                }
                attempted[url] = now
                while (attempted.size > 64) attempted.remove(attempted.keys.first())
            } catch (_: RejectedExecutionException) { jobs.remove(url); writer.cancel() }
        }
    }
    fun close() {
        closed = true; jobs.values.forEach { it.cancel() }; jobs.clear(); executor.shutdownNow()
        // SimpleCache belongs to the application process, so service restarts do not race a release.
    }
}
