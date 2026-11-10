package app.spoty.mobile

/** Follow the visible feed from the current card; do not restart at its first card. */
fun mixSequence(feed: List<String>, current: String?, preferred: String?, visited: Set<String>): List<String> {
    val index = feed.indexOf(current)
    val ordered = if (index < 0) feed else feed.drop(index + 1) + feed.take(index)
    return (listOfNotNull(preferred) + ordered).distinct().filter { it.isNotBlank() && it != current && it !in visited }
}
