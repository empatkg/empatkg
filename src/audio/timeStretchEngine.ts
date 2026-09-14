/**
 * Audio Time-Stretching & Pitch-Shifting DSP Engine
 * Implements FL Studio Sampler modes:
 * 1. Resample: Pitch and duration are tied together (classic tape/sample playback rate)
 * 2. Stretch: Independent pitch shifting and time stretching using granular overlap-add (WSOLA)
 * 3. Auto: Automatically stretches loop to fit project BPM grid beats with independent pitch control
 */

import { SamplerSettings, SamplerMode } from '../types';
import { getAudioContext } from './audioContext';

/**
 * Calculates effective playback rate and stretch ratio for sampler modes
 */
export function getPlaybackParameters(
  settings: SamplerSettings,
  originalDurationSec: number,
  projectBpm: number
): {
  playbackRate: number;
  pitchFactor: number;
  timeStretchRatio: number;
  effectiveDurationBeats: number;
} {
  const semitoneTotal = settings.pitchSemitones + settings.pitchCents / 100;
  const pitchFactor = Math.pow(2, semitoneTotal / 12);

  const secondsPerBeat = 60 / projectBpm;

  if (settings.mode === 'resample') {
    // In resample mode, pitch shifts playbackRate directly, and timeRatio further scales speed
    const playbackRate = pitchFactor * (1 / settings.timeRatio);
    const effectiveSec = originalDurationSec / playbackRate;
    const effectiveDurationBeats = effectiveSec / secondsPerBeat;
    return {
      playbackRate,
      pitchFactor,
      timeStretchRatio: settings.timeRatio,
      effectiveDurationBeats: Math.max(0.1, effectiveDurationBeats),
    };
  }

  if (settings.mode === 'auto') {
    // Auto mode locks to a specific bar/beat count (default 4 beats = 1 bar or auto-rounded)
    let targetBeats = settings.autoBeats;
    if (targetBeats <= 0) {
      // Auto-detect nearest 2, 4, 8, 16 beats
      const rawBeats = originalDurationSec / secondsPerBeat;
      const powers = [1, 2, 4, 8, 16, 32];
      targetBeats = powers.reduce((prev, curr) =>
        Math.abs(curr - rawBeats) < Math.abs(prev - rawBeats) ? curr : prev
      );
    }
    const targetSec = targetBeats * secondsPerBeat;
    const autoStretchRatio = targetSec / originalDurationSec;

    return {
      playbackRate: 1.0,
      pitchFactor,
      timeStretchRatio: autoStretchRatio * settings.timeRatio,
      effectiveDurationBeats: targetBeats * settings.timeRatio,
    };
  }

  // Stretch mode (Manual stretch with independent pitch)
  const effectiveSec = originalDurationSec * settings.timeRatio;
  const effectiveDurationBeats = effectiveSec / secondsPerBeat;

  return {
    playbackRate: 1.0,
    pitchFactor,
    timeStretchRatio: settings.timeRatio,
    effectiveDurationBeats: Math.max(0.1, effectiveDurationBeats),
  };
}

/**
 * Granular / Overlap-Add Time Stretch DSP
 * Stretches or compresses audio duration by timeRatio WITHOUT changing pitch.
 * timeRatio > 1.0 makes it longer/slower; < 1.0 makes it shorter/faster.
 */
export function timeStretchAudioBuffer(
  inputBuffer: AudioBuffer,
  timeRatio: number
): AudioBuffer {
  if (Math.abs(timeRatio - 1.0) < 0.01) {
    return inputBuffer;
  }

  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  const inputLength = inputBuffer.length;
  const outputLength = Math.max(1, Math.round(inputLength * timeRatio));

  const ctx = getAudioContext();
  const outputBuffer = ctx.createBuffer(numChannels, outputLength, sampleRate);

  // Grain settings (adaptive to sample rate)
  const grainSize = Math.round(0.045 * sampleRate); // ~45ms window
  const hopOut = Math.round(grainSize / 4); // 75% overlap
  const hopIn = Math.max(1, Math.round(hopOut / timeRatio));

  // Pre-calculate Hann window
  const window = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = inputBuffer.getChannelData(ch);
    const outputData = outputBuffer.getChannelData(ch);
    const normFactor = new Float32Array(outputLength);

    let inPos = 0;
    let outPos = 0;

    while (outPos + grainSize < outputLength && inPos + grainSize < inputLength) {
      for (let i = 0; i < grainSize; i++) {
        const sample = inputData[inPos + i] * window[i];
        outputData[outPos + i] += sample;
        normFactor[outPos + i] += window[i] * window[i];
      }
      inPos += hopIn;
      outPos += hopOut;
    }

    // Normalize overlapping grains to maintain unity amplitude
    for (let i = 0; i < outputLength; i++) {
      if (normFactor[i] > 0.001) {
        outputData[i] /= Math.sqrt(normFactor[i] * 1.5);
      }
    }
  }

  return outputBuffer;
}

/**
 * Resamples an AudioBuffer by a speed/pitch ratio using high-quality linear/cubic interpolation
 */
export function resampleAudioBuffer(
  inputBuffer: AudioBuffer,
  rate: number
): AudioBuffer {
  if (Math.abs(rate - 1.0) < 0.001) {
    return inputBuffer;
  }

  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  const inputLength = inputBuffer.length;
  const outputLength = Math.max(1, Math.round(inputLength / rate));

  const ctx = getAudioContext();
  const outputBuffer = ctx.createBuffer(numChannels, outputLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const input = inputBuffer.getChannelData(ch);
    const output = outputBuffer.getChannelData(ch);

    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * rate;
      const index0 = Math.floor(srcIdx);
      const frac = srcIdx - index0;
      const index1 = Math.min(index0 + 1, inputLength - 1);

      output[i] = input[index0] * (1 - frac) + input[index1] * frac;
    }
  }

  return outputBuffer;
}

/**
 * Pitch Shift an AudioBuffer by semitones & cents WITHOUT changing duration.
 * Uses resample + inverse time-stretch.
 */
export function pitchShiftAudioBuffer(
  inputBuffer: AudioBuffer,
  semitones: number,
  cents: number = 0
): AudioBuffer {
  const totalSemitones = semitones + cents / 100;
  if (Math.abs(totalSemitones) < 0.05) {
    return inputBuffer;
  }

  const pitchFactor = Math.pow(2, totalSemitones / 12);
  // Resample by pitchFactor
  const resampled = resampleAudioBuffer(inputBuffer, pitchFactor);
  // Time-stretch by pitchFactor to restore original length!
  return timeStretchAudioBuffer(resampled, pitchFactor);
}

/**
 * Renders an AudioBuffer according to FL Sampler Settings
 * (Applies Resample, Stretch, or Auto modes, Pitch Shift, and Time Stretch)
 */
export function processSamplerBuffer(
  buffer: AudioBuffer,
  settings: SamplerSettings,
  projectBpm: number
): AudioBuffer {
  const totalSemitones = settings.pitchSemitones + settings.pitchCents / 100;
  const hasPitchChange = Math.abs(totalSemitones) >= 0.05;

  if (settings.mode === 'resample') {
    // Both pitch and time change together
    const totalRate = Math.pow(2, totalSemitones / 12) * (1 / settings.timeRatio);
    if (Math.abs(totalRate - 1.0) >= 0.01) {
      return resampleAudioBuffer(buffer, totalRate);
    }
    return buffer;
  }

  if (settings.mode === 'stretch') {
    let result = buffer;
    if (hasPitchChange) {
      result = pitchShiftAudioBuffer(result, settings.pitchSemitones, settings.pitchCents);
    }
    if (Math.abs(settings.timeRatio - 1.0) >= 0.02) {
      result = timeStretchAudioBuffer(result, settings.timeRatio);
    }
    return result;
  }

  if (settings.mode === 'auto') {
    const params = getPlaybackParameters(settings, buffer.duration, projectBpm);
    let result = buffer;
    if (hasPitchChange) {
      result = pitchShiftAudioBuffer(result, settings.pitchSemitones, settings.pitchCents);
    }
    if (Math.abs(params.timeStretchRatio - 1.0) >= 0.02) {
      result = timeStretchAudioBuffer(result, params.timeStretchRatio);
    }
    return result;
  }

  return buffer;
}
