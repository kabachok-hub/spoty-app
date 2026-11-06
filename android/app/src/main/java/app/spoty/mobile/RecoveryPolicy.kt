package app.spoty.mobile

/** No timers, network calls or UI state. Each queue occurrence gets one retry. */
class RecoveryPolicy {
    enum class Decision { RETRY, NEXT, STOP }
    private val retried = LinkedHashSet<String>()
    private var consecutiveUnavailable = 0

    fun failed(occurrenceId: String, hasNext: Boolean, repeatOne: Boolean, offline: Boolean): Decision {
        if (offline) return Decision.STOP
        if (retried.add(occurrenceId)) {
            if (retried.size > 50) retried.remove(retried.first())
            return Decision.RETRY
        }
        consecutiveUnavailable++
        return if (repeatOne || !hasNext || consecutiveUnavailable >= 3) Decision.STOP else Decision.NEXT
    }

    fun healthyProgress() { consecutiveUnavailable = 0 }
    fun newQueue() { retried.clear(); consecutiveUnavailable = 0 }
}

