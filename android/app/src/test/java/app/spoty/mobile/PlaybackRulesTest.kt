package app.spoty.mobile
import org.junit.Assert.*
import org.junit.Test

class PlaybackRulesTest {
    @Test fun unavailableQueueHasFiniteBudget() {
        val r = RecoveryPolicy()
        for (i in 1..3) {
            assertEquals(RecoveryPolicy.Decision.RETRY, r.failed("$i", true, false, false))
            assertEquals(if (i == 3) RecoveryPolicy.Decision.STOP else RecoveryPolicy.Decision.NEXT, r.failed("$i", true, false, false))
        }
    }
    @Test fun offlineDoesNotConsumeRetry() {
        val r = RecoveryPolicy()
        assertEquals(RecoveryPolicy.Decision.STOP, r.failed("a", true, false, true))
        assertEquals(RecoveryPolicy.Decision.RETRY, r.failed("a", true, false, false))
    }
    @Test fun repeatOneNeverSkipsAfterFailedRetry() {
        val r = RecoveryPolicy(); r.failed("a", true, true, false)
        assertEquals(RecoveryPolicy.Decision.STOP, r.failed("a", true, true, false))
    }
    @Test fun queueEndStopsAndHealthyDoesNotRestoreOccurrenceRetry() {
        val r = RecoveryPolicy(); r.failed("a", false, false, false); r.healthyProgress()
        assertEquals(RecoveryPolicy.Decision.STOP, r.failed("a", false, false, false))
    }
    private val slots = listOf(QueueSlot("1", "same", "mix-a", false), QueueSlot("2", "same", "mix-a", true),
        QueueSlot("3", "new", "mix-a", false), QueueSlot("4", "tail", "mix-b", false))
    @Test fun explicitNextWinsOverShuffleEvenForDuplicateRecording() {
        val order = queueOrder(slots, 0, true, setOf("same"))
        assertEquals(listOf("1", "2", "3", "4"), order)
    }
    @Test fun currentMixFinishesBeforeNextMix() {
        val rows = listOf(QueueSlot("a", "a", "A", false), QueueSlot("b", "b", "B", false), QueueSlot("c", "c", "A", false))
        repeat(25) { assertEquals(listOf("a", "c", "b"), queueOrder(rows, 0, true, setOf("a"))) }
    }
    @Test fun ordinaryQueueKeepsDuplicateOccurrences() {
        assertEquals(slots.map { it.occurrence }, queueOrder(slots, 0, false, setOf("same")))
    }
    @Test fun shuffleKeepsAlreadyPlayedBehindCurrent() {
        val order = queueOrder(slots, 2, true, setOf("same", "new"))
        assertTrue(order.indexOf("1") < order.indexOf("3")); assertTrue(order.indexOf("4") > order.indexOf("3"))
    }
    private fun hear(seconds: Int, duration: Int = 100): ListeningCoverage {
        val c = ListeningCoverage()
        for (i in 0..seconds) c.sample(i.toDouble(), 1000L + i * 1000, true)
        return c
    }
    @Test fun completedRequiresActualCoverageAndOnlySendsOnce() {
        val c = hear(85)
        assertEquals("completed", c.finish(100.0, false)); assertNull(c.finish(100.0, false))
    }
    @Test fun seekToEndIsNeutral() {
        val c = hear(4); c.sample(99.0, 6000, true); c.sample(100.0, 7000, true)
        assertNull(c.finish(100.0, true))
    }
    @Test fun earlyManualSkipAndTechnicalTransitionAreDifferent() {
        assertEquals("early_skip", hear(5).finish(100.0, true))
        assertNull(hear(5).finish(100.0, false))
        val failed = hear(5); failed.interrupt(true); assertNull(failed.finish(100.0, true))
    }
    @Test fun pauseAndBufferingNeverImplyRejection() {
        val c = hear(5); c.interrupt(); assertNull(c.finish(100.0, true))
    }
    @Test fun repeatSegmentsAreCountedOnce() {
        val c = hear(50); c.interrupt()
        for (i in 0..50) c.sample(i.toDouble(), 53000L + i * 1000, true)
        assertEquals(50.0, c.heard, .001); assertNull(c.finish(100.0, false))
    }
}
