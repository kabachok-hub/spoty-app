package app.spoty.mobile

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import org.junit.Assert.*
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder

class TrackGainTest {
    private fun process(gain: Float, values: List<Short>): List<Short> {
        val processor = TrackGainProcessor(); processor.targetGain = gain
        processor.configure(AudioFormat(48000,2,C.ENCODING_PCM_16BIT)); processor.flush()
        val input = ByteBuffer.allocateDirect(values.size*2).order(ByteOrder.nativeOrder())
        values.forEach { input.putShort(it) }; input.flip(); processor.queueInput(input)
        val output = processor.output.order(ByteOrder.nativeOrder()); val result = mutableListOf<Short>()
        while (output.hasRemaining()) result.add(output.short)
        return result
    }
    @Test fun unityIsBitExact() { val input = listOf<Short>(0,1000,-1000,32767,-32768,7); assertEquals(input,process(1f,input)) }
    @Test fun loudSongsAreAttenuatedAndQuietSongsAreAmplified() {
        assertEquals(listOf<Short>(500,-500),process(.5f,listOf(1000,-1000)))
        assertEquals(listOf<Short>(2000,-2000),process(2f,listOf(1000,-1000)))
    }
    @Test fun outputDoesNotOverflowAtPeaks() { assertEquals(listOf<Short>(32767,-32768),process(2f,listOf(30000,-30000))) }
    @Test fun invalidGainFallsBackToUnity() { val processor = TrackGainProcessor(); processor.targetGain = Float.NaN; assertEquals(1f,processor.targetGain) }
}
