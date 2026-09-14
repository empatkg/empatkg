/**
 * Advanced Audio Waveform Editing Tools
 * Normalize, Reverse, Fade In/Out, Silence, Trim/Crop, DC Offset Removal, Invert Phase, Slicing & WAV Export
 */

import { getAudioContext } from './audioContext';

/**
 * Creates a deep copy of an AudioBuffer
 */
export function cloneAudioBuffer(src: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext();
  const dst = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    dst.copyToChannel(src.getChannelData(ch), ch);
  }
  return dst;
}

/**
 * Normalizes an AudioBuffer to target peak dB (default: -0.1 dB or 0 dB)
 */
export function normalizeAudioBuffer(buffer: AudioBuffer, targetDb: number = 0): AudioBuffer {
  const targetAmp = Math.pow(10, targetDb / 20);
  let maxPeak = 0;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  if (maxPeak < 0.0001) return buffer;

  const gain = targetAmp / maxPeak;
  const result = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }

  return result;
}

/**
 * Reverses audio buffer in time
 */
export function reverseAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  const result = cloneAudioBuffer(buffer);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    data.reverse();
  }
  return result;
}

/**
 * Applies a smooth fade in from startNorm to endNorm (0.0 to 1.0)
 */
export function fadeInAudioBuffer(
  buffer: AudioBuffer,
  startNorm: number = 0,
  endNorm: number = 1
): AudioBuffer {
  const result = cloneAudioBuffer(buffer);
  const startSample = Math.max(0, Math.floor(startNorm * buffer.length));
  const endSample = Math.min(buffer.length, Math.floor(endNorm * buffer.length));
  const fadeLength = Math.max(1, endSample - startSample);

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < fadeLength; i++) {
      const fraction = i / fadeLength;
      // Exponential / S-curve fade
      const gain = Math.sin((fraction * Math.PI) / 2);
      data[startSample + i] *= gain;
    }
  }

  return result;
}

/**
 * Applies a smooth fade out from startNorm to endNorm (0.0 to 1.0)
 */
export function fadeOutAudioBuffer(
  buffer: AudioBuffer,
  startNorm: number = 0,
  endNorm: number = 1
): AudioBuffer {
  const result = cloneAudioBuffer(buffer);
  const startSample = Math.max(0, Math.floor(startNorm * buffer.length));
  const endSample = Math.min(buffer.length, Math.floor(endNorm * buffer.length));
  const fadeLength = Math.max(1, endSample - startSample);

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < fadeLength; i++) {
      const fraction = i / fadeLength;
      const gain = Math.cos((fraction * Math.PI) / 2);
      data[startSample + i] *= gain;
    }
  }

  return result;
}

/**
 * Silences a selected region of audio buffer
 */
export function silenceAudioBuffer(
  buffer: AudioBuffer,
  startNorm: number,
  endNorm: number
): AudioBuffer {
  const result = cloneAudioBuffer(buffer);
  const startSample = Math.max(0, Math.floor(startNorm * buffer.length));
  const endSample = Math.min(buffer.length, Math.floor(endNorm * buffer.length));

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      data[i] = 0;
    }
  }

  return result;
}

/**
 * Trims / crops audio buffer to selected region
 */
export function trimAudioBuffer(
  buffer: AudioBuffer,
  startNorm: number,
  endNorm: number
): AudioBuffer {
  const startSample = Math.max(0, Math.floor(startNorm * buffer.length));
  const endSample = Math.min(buffer.length, Math.floor(endNorm * buffer.length));
  const newLength = Math.max(1, endSample - startSample);

  const ctx = getAudioContext();
  const result = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = result.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      dst[i] = src[startSample + i];
    }
  }

  return result;
}

/**
 * Removes DC offset (centers waveform around 0)
 */
export function removeDcOffset(buffer: AudioBuffer): AudioBuffer {
  const result = cloneAudioBuffer(buffer);

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const mean = sum / data.length;
    for (let i = 0; i < data.length; i++) {
      data[i] -= mean;
    }
  }

  return result;
}

/**
 * Inverts audio phase (180 degrees polarity flip)
 */
export function invertPhase(buffer: AudioBuffer): AudioBuffer {
  const result = cloneAudioBuffer(buffer);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = -data[i];
    }
  }
  return result;
}

/**
 * Transient detection for audio slicing (e.g., drum breaks, vocal chops)
 */
export function detectTransients(buffer: AudioBuffer, threshold: number = 0.25): number[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms
  const hop = Math.floor(windowSize / 2);
  const slicePoints: number[] = [0];

  let prevEnergy = 0;
  for (let i = 0; i < data.length - windowSize; i += hop) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += data[i + j] * data[i + j];
    }
    energy = Math.sqrt(energy / windowSize);

    // Sudden increase in energy
    if (energy > threshold && energy > prevEnergy * 2.2) {
      const normPoint = i / data.length;
      if (normPoint - slicePoints[slicePoints.length - 1] > 0.05) {
        slicePoints.push(normPoint);
      }
    }
    prevEnergy = energy;
  }

  if (slicePoints.length === 1) {
    // If no distinct transients, create 4 even slices (quarter notes)
    return [0, 0.25, 0.5, 0.75];
  }

  return slicePoints;
}

/**
 * Encodes an AudioBuffer into a downloadable standard WAV file Blob (16-bit PCM stereo/mono)
 */
export function encodeWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    interleaved = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      interleaved[i * 2] = left[i];
      interleaved[i * 2 + 1] = right[i];
    }
  } else {
    interleaved = buffer.getChannelData(0);
  }

  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = (interleaved.length * bitDepth) / 8;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    let s = Math.max(-1, Math.min(1, interleaved[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}
