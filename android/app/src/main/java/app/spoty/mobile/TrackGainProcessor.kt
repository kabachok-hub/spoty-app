package app.spoty.mobile

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.UnhandledAudioFormatException
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import java.nio.ByteBuffer
import kotlin.math.exp
import kotlin.math.roundToInt

@UnstableApi
class TrackGainProcessor : BaseAudioProcessor() {
    @Volatile var targetGain = 1f
        set(value) { field = if (value.isFinite()) value.coerceIn(.05f,2f) else 1f }
    private var gain = 1f
    private var smoothing = .0001f
    override fun onConfigure(input: AudioFormat): AudioFormat {
        if (input.encoding != C.ENCODING_PCM_16BIT && input.encoding != C.ENCODING_PCM_FLOAT) throw UnhandledAudioFormatException(input)
        smoothing = (1 - exp(-1.0 / (input.sampleRate * input.channelCount * .08))).toFloat()
        return input
    }
    override fun onFlush() { gain = targetGain }
    override fun queueInput(input: ByteBuffer) {
        val output = replaceOutputBuffer(input.remaining())
        val target = targetGain.coerceIn(.05f, 2f)
        if (target == 1f && gain == 1f) output.put(input)
        else if (inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT) {
            while (input.hasRemaining()) { gain += (target - gain) * smoothing; output.putFloat((input.float * gain).coerceIn(-1f,1f)) }
        } else {
            while (input.hasRemaining()) { gain += (target - gain) * smoothing; output.putShort((input.short * gain).roundToInt().coerceIn(-32768,32767).toShort()) }
        }
        output.flip()
    }
}

@UnstableApi
class GainRenderers(context: Context, private val gain: TrackGainProcessor) : DefaultRenderersFactory(context) {
    override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioOutputPlaybackParams: Boolean): AudioSink {
        return DefaultAudioSink.Builder(context).setEnableFloatOutput(false).setAudioProcessors(arrayOf(gain)).build()
    }
}
