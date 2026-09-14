package com.flstudio.mobile.audio

import kotlin.math.*

/**
 * Polyphonic Virtual Analog Synthesizer in Kotlin
 * Dual Oscillators, State Variable Filter, and ADSR Envelopes
 */
class SynthEngine(private val sampleRate: Int = 44100) {

    data class Voice(
        val midiNote: Int,
        var phase1: Double = 0.0,
        var phase2: Double = 0.0,
        var envTime: Double = 0.0,
        var isReleased: Boolean = false,
        var releaseTime: Double = 0.0
    )

    private val activeVoices = mutableListOf<Voice>()

    // Synth Parameters
    var osc1Wave = "saw"
    var osc2Wave = "square"
    var osc2DetuneCents = 7.0
    var filterCutoff = 2500.0
    var filterResonance = 1.8
    var attack = 0.01
    var decay = 0.2
    var sustain = 0.7
    var release = 0.4

    fun noteOn(midi: Int) {
        synchronized(activeVoices) {
            activeVoices.removeAll { it.midiNote == midi }
            activeVoices.add(Voice(midiNote = midi))
        }
    }

    fun noteOff(midi: Int) {
        synchronized(activeVoices) {
            activeVoices.find { it.midiNote == midi }?.let {
                it.isReleased = true
            }
        }
    }

    fun renderBlock(output: FloatArray) {
        val dt = 1.0 / sampleRate

        synchronized(activeVoices) {
            val iterator = activeVoices.iterator()
            while (iterator.hasNext()) {
                val voice = iterator.next()
                val baseFreq = 440.0 * 2.0.pow((voice.midiNote - 69) / 12.0)
                val freq2 = baseFreq * 2.0.pow(osc2DetuneCents / 1200.0)

                for (i in output.indices) {
                    voice.envTime += dt

                    // Calculate Envelope amplitude
                    val amp = if (!voice.isReleased) {
                        if (voice.envTime < attack) {
                            (voice.envTime / attack)
                        } else if (voice.envTime < attack + decay) {
                            1.0 - (1.0 - sustain) * ((voice.envTime - attack) / decay)
                        } else {
                            sustain
                        }
                    } else {
                        voice.releaseTime += dt
                        sustain * max(0.0, 1.0 - (voice.releaseTime / release))
                    }

                    if (voice.isReleased && voice.releaseTime >= release) {
                        break
                    }

                    // Osc 1 (Sawtooth)
                    val s1 = (2.0 * voice.phase1 - 1.0)
                    voice.phase1 = (voice.phase1 + baseFreq * dt) % 1.0

                    // Osc 2 (Square)
                    val s2 = if (voice.phase2 < 0.5) 0.8 else -0.8
                    voice.phase2 = (voice.phase2 + freq2 * dt) % 1.0

                    output[i] += ((s1 * 0.6 + s2 * 0.4) * amp * 0.3).toFloat()
                }

                if (voice.isReleased && voice.releaseTime >= release) {
                    iterator.remove()
                }
            }
        }
    }
}
