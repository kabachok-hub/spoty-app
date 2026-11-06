package app.spoty.mobile

/** Position coverage, not elapsed wall time. Pause/seek/error cannot imply rejection. */
class ListeningCoverage {
    private var ranges = listOf<Pair<Double, Double>>()
    private var position = 0.0
    private var at = 0L
    private var running = false
    private var negative = true
    private var failed = false
    private var sent = false
    var heard = 0.0; private set
    fun sample(current: Double, now: Long, playing: Boolean) {
        val delta = current - position
        if (at > 0 && running && delta > 0 && delta <= (now - at) / 1000.0 + 1) {
            val sorted = (ranges + (position.coerceAtLeast(0.0) to current)).sortedBy { it.first }
            val merged = mutableListOf<Pair<Double, Double>>()
            for (range in sorted) {
                if (merged.isNotEmpty() && range.first <= merged.last().second) {
                    val previous = merged.removeAt(merged.lastIndex)
                    merged.add(previous.first to maxOf(previous.second, range.second))
                } else merged.add(range)
            }
            ranges = merged.take(128); heard = ranges.sumOf { it.second - it.first }
        } else if (at > 0 && (delta < 0 || delta > (now - at) / 1000.0 + 1)) negative = false
        position = current; at = now; running = playing
    }
    fun interrupt(error: Boolean = false) {
        if (at > 0 || error) { negative = false; running = false }
        failed = failed || error
    }
    fun finish(duration: Double, manual: Boolean): String? {
        if (sent || failed || duration !in 45.0..7200.0) return null
        sent = true
        return when {
            heard >= duration * .85 -> "completed"
            manual && running && negative && heard >= 3 && heard <= minOf(20.0, duration * .2) -> "early_skip"
            else -> null
        }
    }
}
