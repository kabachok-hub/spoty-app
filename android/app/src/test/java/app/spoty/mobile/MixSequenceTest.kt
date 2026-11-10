package app.spoty.mobile

import org.junit.Assert.*
import org.junit.Test

class MixSequenceTest {
    @Test fun startsAfterCurrentCardInsteadOfFirstHomeCard() {
        assertEquals(listOf("c", "a"), mixSequence(listOf("a", "b", "c"), "b", null, setOf("b")))
    }
    @Test fun preservesExplicitNextEvenWhenHomeIsUnavailable() {
        assertEquals(listOf("b"), mixSequence(emptyList(), "a", "b", setOf("a")))
    }
    @Test fun visitedFeedFinishesInsteadOfReplayingOrInventingRadio() {
        assertTrue(mixSequence(listOf("a", "b", "c"), "c", null, setOf("a", "b", "c")).isEmpty())
    }
    @Test fun preferredAndDuplicateHomeEntriesOnlyOccurOnce() {
        assertEquals(listOf("b", "c"), mixSequence(listOf("a", "b", "b", "c"), "a", "b", setOf("a")))
    }
}
