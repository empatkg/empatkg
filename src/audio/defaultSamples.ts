/**
 * Procedurally generated high-fidelity studio sample library
 * Provides instant audio clips for drums, synth plucks, and vocal chops
 * so users can test Sampler modes (Stretch, Resample, Auto), pitch shifting, and waveform editing immediately.
 */

import { getAudioContext } from './audioContext';

export interface SamplePreset {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'vocal' | 'synth' | 'loop';
  defaultBeats: number;
  generate: () => AudioBuffer;
}

export function create808Kick(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 0.8;
  const buffer = ctx.createBuffer(1, Math.round(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Fast pitch drop from 160Hz to 42Hz
    const freq = 42 + 120 * Math.exp(-t * 22);
    // Exponential amp decay
    const amp = Math.exp(-t * 4.5);
    // Slight saturation
    const raw = Math.sin(2 * Math.PI * freq * t);
    data[i] = Math.tanh(raw * 1.8) * amp;
  }

  return buffer;
}

export function createSnare(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 0.35;
  const buffer = ctx.createBuffer(1, Math.round(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Tonal body
    const bodyFreq = 180 * Math.exp(-t * 25);
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t * 20);
    // Noise snap
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12);
    data[i] = (body * 0.6 + noise * 0.7) * (1 - t / duration);
  }

  return buffer;
}

export function createHiHat(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 0.12;
  const buffer = ctx.createBuffer(1, Math.round(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const raw = Math.random() * 2 - 1;
    // High pass filter
    const hp = raw - prev * 0.85;
    prev = raw;
    data[i] = hp * Math.exp(-t * 35);
  }

  return buffer;
}

/**
 * Procedural Vocal Formant Chop "Hey / Yeah"
 * Rich in harmonics, showcasing pitch shifting and time stretching dramatically!
 */
export function createVocalChop(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 1.2; // 1.2 seconds, approx 2 beats at 100 BPM
  const buffer = ctx.createBuffer(2, Math.round(sampleRate * duration), sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Formant frequencies for "Yeah / Oh" (F1 ~ 700Hz, F2 ~ 1250Hz, F3 ~ 2600Hz)
  for (let i = 0; i < left.length; i++) {
    const t = i / sampleRate;
    // Fundamental pitch inflection (gliding from C4 261Hz to E4 329Hz then down)
    const pitch = 260 + 70 * Math.sin((t / duration) * Math.PI);
    // Pulse wave oscillator
    const phase = (t * pitch) % 1;
    const pulse = phase < 0.3 ? 1 : -0.3;

    // Resonant formants
    const f1 = Math.sin(2 * Math.PI * 720 * t);
    const f2 = Math.sin(2 * Math.PI * (1200 + 400 * (t / duration)) * t);
    const f3 = Math.sin(2 * Math.PI * 2500 * t);

    const amp = Math.min(1, t * 15) * Math.exp(-t * 2.2);
    const sample = (pulse * 0.3 + f1 * 0.4 + f2 * 0.3 + f3 * 0.15) * amp;

    // Gentle stereo width
    left[i] = Math.tanh(sample * 1.5) * 0.85;
    right[i] = Math.tanh(sample * 1.5) * 0.85;
  }

  return buffer;
}

/**
 * Funky Pluck Lead
 */
export function createPluckLead(): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 0.9;
  const buffer = ctx.createBuffer(2, Math.round(sampleRate * duration), sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const baseFreq = 440; // A4
  for (let i = 0; i < left.length; i++) {
    const t = i / sampleRate;
    const saw1 = ((t * baseFreq) % 1) * 2 - 1;
    const saw2 = ((t * (baseFreq * 1.006)) % 1) * 2 - 1; // Detuned
    const sub = Math.sin(2 * Math.PI * (baseFreq / 2) * t);

    // Fast envelope filter sweep
    const cutoff = 400 + 4000 * Math.exp(-t * 12);
    const filter = Math.sin(2 * Math.PI * cutoff * t);

    const amp = Math.exp(-t * 3.8);
    const out = (saw1 * 0.4 + saw2 * 0.4 + sub * 0.3) * amp * (0.6 + 0.4 * filter);

    left[i] = Math.tanh(out);
    right[i] = Math.tanh(out * 0.98);
  }

  return buffer;
}

/**
 * 2-Bar Drum Break Loop (Ideal for demonstrating Auto & Stretch mode sync to BPM)
 */
export function createDrumLoop(bpm: number = 120): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const secondsPerBeat = 60 / bpm;
  const duration = secondsPerBeat * 8; // 2 bars (8 beats)
  const totalSamples = Math.round(sampleRate * duration);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const kick = create808Kick();
  const snare = createSnare();
  const hat = createHiHat();

  // Pattern beats for 8 beats:
  // Kick on 0, 2.5, 4, 6
  // Snare on 2, 6
  // Hat on every 0.5 beat (8th notes)
  const hitPlacements: Array<{ buffer: AudioBuffer; beat: number; gain: number }> = [
    { buffer: kick, beat: 0, gain: 1 },
    { buffer: kick, beat: 2.5, gain: 0.9 },
    { buffer: kick, beat: 4, gain: 1 },
    { buffer: kick, beat: 6.5, gain: 0.85 },
    { buffer: snare, beat: 2, gain: 0.95 },
    { buffer: snare, beat: 6, gain: 0.95 },
  ];

  for (let b = 0; b < 8; b += 0.5) {
    hitPlacements.push({ buffer: hat, beat: b, gain: b % 1 === 0 ? 0.6 : 0.4 });
  }

  hitPlacements.forEach((hit) => {
    const startSample = Math.round(hit.beat * secondsPerBeat * sampleRate);
    const hitData = hit.buffer.getChannelData(0);
    for (let i = 0; i < hitData.length && startSample + i < totalSamples; i++) {
      left[startSample + i] += hitData[i] * hit.gain;
      right[startSample + i] += hitData[i] * hit.gain;
    }
  });

  return buffer;
}
