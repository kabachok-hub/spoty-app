package app.spoty.mobile

data class QueueSlot(val occurrence: String, val recording: String, val context: String, val next: Boolean)

/** Played items stay behind the active occurrence; explicit next wins over shuffle. */
fun queueOrder(slots: List<QueueSlot>, current: Int, shuffle: Boolean, played: Set<String>): List<String> {
    if (current !in slots.indices || !shuffle) return slots.map { it.occurrence }
    val active = slots[current]
    val priority = slots.getOrNull(current + 1)?.takeIf { it.next }
    val fresh = slots.filter { it.occurrence != active.occurrence && it.occurrence != priority?.occurrence && it.recording !in played }
    val groups = fresh.groupBy { it.context }
    val contexts = listOf(active.context) + groups.keys.filter { it != active.context }
    val upcoming = listOfNotNull(priority) + contexts.flatMap { groups[it].orEmpty().shuffled() }
    val upcomingIds = upcoming.map { it.occurrence }.toSet()
    val past = slots.filter { it.occurrence != active.occurrence && it.occurrence !in upcomingIds }
    return (past + active + upcoming).map { it.occurrence }
}
