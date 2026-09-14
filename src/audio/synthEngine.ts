/**
 * Web Audio Polyphonic Synthesizer Engine with Dual Oscillators,
 * Filter & Amp ADSR Envelopes, LFO Modulation, and FX Rack (Delay, Reverb, Distortion).
 */

import { SynthParams } from '../types';
import { getAudioContext, getMasterGain } from './audioContext';

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  osc1Type: 'sawtooth',
  osc1Octave: 0,
  osc1Detune: 0,
  osc1Mix: 0.8,

  osc2Type: 'square',
  osc2Octave: -1,
  osc2Detune: 7,
  osc2Mix: 0.5,

  filterType: 'lowpass',
  filterCutoff: 2400,
  filterResonance: 4.5,
  filterEnvAmount: 0.6,

  ampAttack: 0.02,
  ampDecay: 0.25,
  ampSustain: 0.65,
  ampRelease: 0.35,

  filterAttack: 0.04,
  filterDecay: 0.3,
  filterSustain: 0.3,
  filterRelease: 0.4,

  lfoRate: 3.5,
  lfoDepth: 0.15,
  lfoTarget: 'none',
  lfoType: 'sine',

  glide: 0,

  distortion: 0.15,
  delayTime: 0.28,
  delayFeedback: 0.35,
  delayMix: 0.2,
  reverbDecay: 1.8,
  reverbMix: 0.25,
};

export const SYNTH_PRESETS: Record<string, SynthParams> = {
  'Cyber Saw Lead': {
    ...DEFAULT_SYNTH_PARAMS,
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc2Octave: 0,
    osc2Detune: 14,
    osc1Mix: 0.9,
    osc2Mix: 0.8,
    filterCutoff: 3800,
    filterResonance: 3,
    ampAttack: 0.01,
    ampRelease: 0.2,
    distortion: 0.3,
    delayMix: 0.25,
    reverbMix: 0.3,
  },
  '808 Sub Bass': {
    ...DEFAULT_SYNTH_PARAMS,
    osc1Type: 'sine',
    osc1Octave: -2,
    osc1Detune: 0,
    osc1Mix: 1.0,
    osc2Type: 'triangle',
    osc2Octave: -1,
    osc2Detune: 0,
    osc2Mix: 0.3,
    filterCutoff: 450,
    filterResonance: 2,
    filterEnvAmount: 0.3,
    ampAttack: 0.01,
    ampDecay: 0.6,
    ampSustain: 0.4,
    ampRelease: 0.25,
    distortion: 0.2,
    delayMix: 0,
    reverbMix: 0,
  },
  'Analog Warm Pad': {
    ...DEFAULT_SYNTH_PARAMS,
    osc1Type: 'sawtooth',
    osc1Octave: 0,
    osc1Detune: -6,
    osc2Type: 'triangle',
    osc2Octave: 0,
    osc2Detune: 8,
    filterCutoff: 1600,
    filterResonance: 1.5,
    ampAttack: 0.4,
    ampDecay: 0.8,
    ampSustain: 0.8,
    ampRelease: 1.2,
    lfoRate: 1.2,
    lfoDepth: 0.25,
    lfoTarget: 'cutoff',
    reverbMix: 0.45,
    delayMix: 0.25,
  },
  'Chiptune Arp': {
    ...DEFAULT_SYNTH_PARAMS,
    osc1Type: 'square',
    osc1Octave: 0,
    osc2Type: 'square',
    osc2Octave: 1,
    osc2Detune: 4,
    filterCutoff: 8000,
    ampAttack: 0.005,
    ampDecay: 0.15,
    ampSustain: 0.4,
    ampRelease: 0.1,
    distortion: 0.1,
    delayMix: 0.35,
    reverbMix: 0.15,
  },
  'Pluck Bell': {
    ...DEFAULT_SYNTH_PARAMS,
    osc1Type: 'triangle',
    osc1Octave: 1,
    osc2Type: 'sine',
    osc2Octave: 2,
    filterCutoff: 5000,
    filterResonance: 6,
    filterEnvAmount: 0.8,
    ampAttack: 0.002,
    ampDecay: 0.4,
    ampSustain: 0.05,
    ampRelease: 0.5,
    reverbMix: 0.4,
    delayMix: 0.3,
  },
};

export class SynthEngine {
  private activeVoices: Map<number, { stop: (time: number) => void }> = new Map();

  // Create FX Chain for this synth instance
  private createFxChain(ctx: AudioContext, params: SynthParams, destination: AudioNode) {
    const inputNode = ctx.createGain();

    // 1. Distortion Waveshaper
    const distortionNode = ctx.createWaveShaper();
    distortionNode.curve = this.makeDistortionCurve(params.distortion);
    distortionNode.oversample = '4x';

    // 2. Delay
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = Math.max(0.01, params.delayTime);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = Math.min(0.85, params.delayFeedback);
    const delayWet = ctx.createGain();
    delayWet.gain.value = params.delayMix;

    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);

    // 3. Simple Convolver/Reverb
    const reverbConvolver = ctx.createConvolver();
    reverbConvolver.buffer = this.generateImpulseResponse(ctx, params.reverbDecay);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = params.reverbMix;
    reverbConvolver.connect(reverbWet);

    // Dry path
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;

    // Routing
    inputNode.connect(distortionNode);
    distortionNode.connect(dryGain);
    distortionNode.connect(delayNode);
    distortionNode.connect(reverbConvolver);

    dryGain.connect(destination);
    delayWet.connect(destination);
    reverbWet.connect(destination);

    return inputNode;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount * 50;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private generateImpulseResponse(ctx: AudioContext, decaySeconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.round(rate * Math.max(0.1, decaySeconds));
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * (decaySeconds / 3)));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    return impulse;
  }

  /**
   * Triggers a MIDI note on the synthesizer
   */
  triggerNote(
    midiNote: number,
    velocity: number = 0.8,
    params: SynthParams = DEFAULT_SYNTH_PARAMS,
    startTime?: number,
    duration?: number,
    outputNode?: AudioNode
  ): void {
    const ctx = getAudioContext();
    const now = startTime !== undefined ? startTime : ctx.currentTime;
    const targetOut = outputNode || getMasterGain();

    // Stop existing note if playing
    if (this.activeVoices.has(midiNote)) {
      this.activeVoices.get(midiNote)!.stop(now);
      this.activeVoices.delete(midiNote);
    }

    const fxInput = this.createFxChain(ctx, params, targetOut);

    // Calculate frequencies
    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const freq1 = baseFreq * Math.pow(2, params.osc1Octave) * Math.pow(2, params.osc1Detune / 1200);
    const freq2 = baseFreq * Math.pow(2, params.osc2Octave) * Math.pow(2, params.osc2Detune / 1200);

    // Oscillators
    const osc1 = ctx.createOscillator();
    osc1.type = params.osc1Type === 'noise' ? 'sawtooth' : params.osc1Type;
    osc1.frequency.setValueAtTime(freq1, now);

    const osc2 = ctx.createOscillator();
    osc2.type = params.osc2Type === 'noise' ? 'square' : params.osc2Type;
    osc2.frequency.setValueAtTime(freq2, now);

    const osc1Gain = ctx.createGain();
    osc1Gain.gain.setValueAtTime(params.osc1Mix, now);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(params.osc2Mix, now);

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = params.filterType;
    filter.Q.setValueAtTime(params.filterResonance, now);

    // Filter Envelope
    const baseCutoff = Math.max(20, Math.min(20000, params.filterCutoff));
    const peakCutoff = Math.max(20, Math.min(20000, baseCutoff + params.filterEnvAmount * 8000));
    filter.frequency.setValueAtTime(baseCutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, peakCutoff), now + Math.max(0.005, params.filterAttack));
    const sustainCutoff = baseCutoff + (peakCutoff - baseCutoff) * params.filterSustain;
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(20, sustainCutoff),
      now + Math.max(0.005, params.filterAttack + params.filterDecay)
    );

    osc1Gain.connect(filter);
    osc2Gain.connect(filter);

    // Amp Envelope
    const ampGain = ctx.createGain();
    const peakGain = Math.max(0.001, velocity * 0.4);
    ampGain.gain.setValueAtTime(0.0001, now);
    ampGain.gain.exponentialRampToValueAtTime(peakGain, now + Math.max(0.005, params.ampAttack));
    ampGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peakGain * params.ampSustain),
      now + Math.max(0.005, params.ampAttack + params.ampDecay)
    );

    // LFO
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (params.lfoTarget !== 'none' && params.lfoDepth > 0.01) {
      lfo = ctx.createOscillator();
      lfo.type = params.lfoType;
      lfo.frequency.setValueAtTime(params.lfoRate, now);

      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(params.lfoDepth * 200, now);
      lfo.connect(lfoGain);

      if (params.lfoTarget === 'pitch') {
        lfoGain.gain.setValueAtTime(params.lfoDepth * 30, now);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
      } else if (params.lfoTarget === 'cutoff') {
        lfoGain.gain.setValueAtTime(params.lfoDepth * 2000, now);
        lfoGain.connect(filter.frequency);
      }
      lfo.start(now);
    }

    filter.connect(ampGain);
    ampGain.connect(fxInput);

    osc1.start(now);
    osc2.start(now);

    const stopVoice = (releaseTime: number) => {
      const relDuration = Math.max(0.02, params.ampRelease);
      ampGain.gain.cancelScheduledValues(releaseTime);
      ampGain.gain.setValueAtTime(Math.max(0.0001, ampGain.gain.value), releaseTime);
      ampGain.gain.exponentialRampToValueAtTime(0.00001, releaseTime + relDuration);

      const filterRel = Math.max(0.02, params.filterRelease);
      filter.frequency.cancelScheduledValues(releaseTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, baseCutoff), releaseTime + filterRel);

      const killTime = releaseTime + Math.max(relDuration, filterRel) + 0.1;
      try {
        osc1.stop(killTime);
        osc2.stop(killTime);
        lfo?.stop(killTime);
      } catch {
        // already stopped
      }
    };

    if (duration !== undefined && duration > 0) {
      stopVoice(now + duration);
    } else {
      this.activeVoices.set(midiNote, { stop: stopVoice });
    }
  }

  stopNote(midiNote: number, releaseTime?: number): void {
    const ctx = getAudioContext();
    const time = releaseTime !== undefined ? releaseTime : ctx.currentTime;
    if (this.activeVoices.has(midiNote)) {
      this.activeVoices.get(midiNote)!.stop(time);
      this.activeVoices.delete(midiNote);
    }
  }

  stopAllNotes(): void {
    const ctx = getAudioContext();
    this.activeVoices.forEach((voice) => voice.stop(ctx.currentTime));
    this.activeVoices.clear();
  }
}

export const globalSynthEngine = new SynthEngine();
