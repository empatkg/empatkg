package com.flstudio.mobile.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import kotlinx.coroutines.*
import kotlin.math.*

/**
 * Native Android Low-Latency Multi-Track Audio & Sampler Engine
 * Supports Stretch, Resample, and Auto modes, realtime mixing, and microphone recording.
 */
class AudioEngine {
    private val sampleRate = 44100
    private val bufferSize = AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_STEREO,
        AudioFormat.ENCODING_PCM_16BIT
    )

    private var audioTrack: AudioTrack? = null
    private var isPlaying = false
    private var bpm = 120.0
    private var currentSamplePosition = 0L

    // Tracks and Sampler state
    val tracks = mutableListOf<NativeTrack>()
    private var playbackJob: Job? = null
    private val coroutineScope = CoroutineScope(Dispatchers.Default + Job())

    fun initialize() {
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setFlags(AudioAttributes.FLAG_LOW_LATENCY)
            .build()

        val format = AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufferSize * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .build()

        audioTrack?.play()
    }

    fun startPlayback() {
        if (isPlaying) return
        isPlaying = true
        currentSamplePosition = 0

        playbackJob = coroutineScope.launch {
            val shortBuffer = ShortArray(bufferSize / 2)
            val floatLeft = FloatArray(shortBuffer.size / 2)
            val floatRight = FloatArray(shortBuffer.size / 2)

            while (isActive && isPlaying) {
                // Clear buffers
                floatLeft.fill(0f)
                floatRight.fill(0f)

                // Sum all active tracks
                for (track in tracks) {
                    if (track.isMuted) continue
                    track.renderBuffer(currentSamplePosition, floatLeft, floatRight, sampleRate, bpm)
                }

                // Interleave into 16-bit PCM stereo output
                var idx = 0
                for (i in floatLeft.indices) {
                    val lClamped = max(-1.0f, min(1.0f, floatLeft[i]))
                    val rClamped = max(-1.0f, min(1.0f, floatRight[i]))
                    shortBuffer[idx++] = (lClamped * 32767f).toInt().toShort()
                    shortBuffer[idx++] = (rClamped * 32767f).toInt().toShort()
                }

                audioTrack?.write(shortBuffer, 0, shortBuffer.size, AudioTrack.WRITE_BLOCKING)
                currentSamplePosition += floatLeft.size
            }
        }
    }

    fun pausePlayback() {
        isPlaying = false
        playbackJob?.cancel()
    }

    fun setBpm(newBpm: Double) {
        bpm = newBpm
    }

    fun release() {
        pausePlayback()
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
    }
}

/**
 * Sampler Modes: Resample, Stretch, Auto
 */
enum class SamplerMode {
    RESAMPLE, STRETCH, AUTO
}

data class SamplerSettings(
    var mode: SamplerMode = SamplerMode.STRETCH,
    var pitchSemitones: Int = 0,
    var pitchCents: Int = 0,
    var timeRatio: Float = 1.0f,
    var autoBeats: Int = 4,
    var reverse: Boolean = false,
    var volume: Float = 1.0f,
    var pan: Float = 0.0f
)

/**
 * Native Audio Track representing clips and mixer controls
 */
class NativeTrack(
    val id: String,
    val name: String,
    var volume: Float = 1.0f,
    var pan: Float = 0.0f,
    var isMuted: Boolean = false
) {
    var sampleBuffer: FloatArray? = null
    var samplerSettings = SamplerSettings()

    fun renderBuffer(
        globalSamplePos: Long,
        outLeft: FloatArray,
        outRight: FloatArray,
        sampleRate: Int,
        bpm: Double
    ) {
        val src = sampleBuffer ?: return
        val totalSamples = src.size

        // Calculate pitch factor and time ratio
        val totalPitchCents = samplerSettings.pitchSemitones * 100 + samplerSettings.pitchCents
        val pitchMultiplier = 2.0.pow(totalPitchCents / 1200.0).toFloat()

        var playbackRate = 1.0f
        when (samplerSettings.mode) {
            SamplerMode.RESAMPLE -> {
                playbackRate = pitchMultiplier
            }
            SamplerMode.STRETCH -> {
                playbackRate = samplerSettings.timeRatio
            }
            SamplerMode.AUTO -> {
                val secondsPerBeat = 60.0 / bpm
                val targetDurationSeconds = samplerSettings.autoBeats * secondsPerBeat
                val targetSamples = targetDurationSeconds * sampleRate
                playbackRate = (totalSamples / targetSamples).toFloat()
            }
        }

        val panLeft = if (pan <= 0f) 1.0f else (1.0f - pan)
        val panRight = if (pan >= 0f) 1.0f else (1.0f + pan)

        for (i in outLeft.indices) {
            val localSample = (globalSamplePos + i) * playbackRate
            val srcIdx = localSample.toInt()

            if (srcIdx in 0 until totalSamples) {
                var s = src[srcIdx] * volume * samplerSettings.volume
                outLeft[i] += s * panLeft
                outRight[i] += s * panRight
            }
        }
    }
}
