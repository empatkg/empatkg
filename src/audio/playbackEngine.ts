/**
 * Multi-track Playback, Live Recording & Offline Mixdown Exporter Engine
 */

import { Track, SamplerSettings, Note, AudioClip, MidiClip, AutomationClip, AutomationPoint } from '../types';
import { getAudioContext, getMasterGain, playMetronomeClick } from './audioContext';
import { globalSynthEngine } from './synthEngine';
import { processSamplerBuffer } from './timeStretchEngine';
import { encodeWavBlob } from './waveformUtils';

interface TrackAudioNodes {
  inputGain: GainNode;
  lowEq: BiquadFilterNode;
  midEq: BiquadFilterNode;
  highEq: BiquadFilterNode;
  dryGain: GainNode;
  wetGain: GainNode;
  preDelay: DelayNode;
  dampingFilter: BiquadFilterNode;
  convolver: ConvolverNode;
  sumGain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
  lastReverbDecay?: number;
}

// Generate algorithmic synthetic impulse response buffer for Reverb plugin
function createReverbImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(0.2, Math.min(6.0, decaySec)) * rate;
  const buffer = ctx.createBuffer(2, length, rate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    // Exponential decay curve
    const env = Math.exp(-3.5 * t);
    left[i] = (Math.random() * 2 - 1) * env;
    right[i] = (Math.random() * 2 - 1) * env;
  }
  return buffer;
}

// Evaluate FL Studio style tension breakpoint automation curve
export function evaluateAutomationClip(clip: AutomationClip, relativeBeat: number): number {
  if (!clip.points || clip.points.length === 0) return 0.5;
  if (clip.points.length === 1) return clip.points[0].value;

  const sorted = [...clip.points].sort((a, b) => a.beat - b.beat);

  if (relativeBeat <= sorted[0].beat) return sorted[0].value;
  if (relativeBeat >= sorted[sorted.length - 1].beat) return sorted[sorted.length - 1].value;

  let p1 = sorted[0];
  let p2 = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (relativeBeat >= sorted[i].beat && relativeBeat <= sorted[i + 1].beat) {
      p1 = sorted[i];
      p2 = sorted[i + 1];
      break;
    }
  }

  const span = p2.beat - p1.beat;
  if (span <= 0) return p1.value;

  let u = (relativeBeat - p1.beat) / span;
  u = Math.max(0, Math.min(1, u));

  // FL Studio Tension curvature: -1 (concave) to +1 (convex)
  const tension = p1.tension || 0;
  let curvedU = u;
  if (tension > 0) {
    curvedU = Math.pow(u, 1 + tension * 3);
  } else if (tension < 0) {
    curvedU = 1 - Math.pow(1 - u, 1 - tension * 3);
  }

  return p1.value + (p2.value - p1.value) * curvedU;
}

export class PlaybackEngine {
  private isPlaying = false;
  private currentBeat = 0;
  private baseBpm = 120;
  private bpm = 120;
  private loopStartBeat = 0;
  private loopEndBeat = 16;
  private isLooping = true;
  private metronomeEnabled = false;

  private animationFrameId: number | null = null;
  private lastAudioTime = 0;
  private nextScheduleBeat = 0;
  private scheduleAheadBeats = 1.0; // schedule ~1 beat ahead

  private activeSourceNodes: AudioNode[] = [];
  private trackNodes: Map<string, TrackAudioNodes> = new Map();
  private automationClips: AutomationClip[] = [];

  private onBeatUpdateCallback?: (beat: number) => void;
  private onPlayStateChangeCallback?: (playing: boolean) => void;
  private onBpmUpdateCallback?: (bpm: number) => void;

  private getTracksRef?: () => Track[];

  init(getTracks: () => Track[]) {
    this.getTracksRef = getTracks;
  }

  setCallbacks(
    onBeatUpdate: (beat: number) => void,
    onPlayStateChange: (playing: boolean) => void,
    onBpmUpdate?: (bpm: number) => void
  ) {
    this.onBeatUpdateCallback = onBeatUpdate;
    this.onPlayStateChangeCallback = onPlayStateChange;
    this.onBpmUpdateCallback = onBpmUpdate;
  }

  setAutomationClips(clips: AutomationClip[]) {
    this.automationClips = clips;
  }

  setBpm(newBpm: number) {
    this.baseBpm = Math.max(40, Math.min(260, newBpm));
    this.bpm = this.baseBpm;
  }

  getBpm() {
    return this.bpm;
  }

  setLoop(start: number, end: number, enabled: boolean = true) {
    this.loopStartBeat = start;
    this.loopEndBeat = Math.max(start + 1, end);
    this.isLooping = enabled;
  }

  setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  getCurrentBeat() {
    return this.currentBeat;
  }

  seek(beat: number) {
    this.stopAllAudio();
    this.currentBeat = Math.max(0, beat);
    this.nextScheduleBeat = this.currentBeat;
    this.onBeatUpdateCallback?.(this.currentBeat);
  }

  play() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastAudioTime = ctx.currentTime;
    this.nextScheduleBeat = this.currentBeat;
    this.onPlayStateChangeCallback?.(true);

    this.tick();
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopAllAudio();
    this.onPlayStateChangeCallback?.(false);
  }

  stop() {
    this.pause();
    this.seek(this.isLooping ? this.loopStartBeat : 0);
  }

  private stopAllAudio() {
    this.activeSourceNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeSourceNodes = [];
    globalSynthEngine.stopAllNotes();
  }

  // Ensure routing nodes (Volume, 3-Band Parametric EQ, Reverb FX & Pan) for each track
  private getTrackNodes(track: Track, ctx: AudioContext, masterOut: AudioNode): TrackAudioNodes {
    let nodes = this.trackNodes.get(track.id);
    if (!nodes) {
      const inputGain = ctx.createGain();

      // 3-Band Parametric Equalizer Nodes
      const lowEq = ctx.createBiquadFilter();
      lowEq.type = 'lowshelf';
      lowEq.frequency.value = track.eq?.lowFreq || 200;

      const midEq = ctx.createBiquadFilter();
      midEq.type = 'peaking';
      midEq.frequency.value = track.eq?.midFreq || 1200;
      midEq.Q.value = 1.0;

      const highEq = ctx.createBiquadFilter();
      highEq.type = 'highshelf';
      highEq.frequency.value = track.eq?.highFreq || 6000;

      // Connect EQ chain: inputGain -> lowEq -> midEq -> highEq
      inputGain.connect(lowEq);
      lowEq.connect(midEq);
      midEq.connect(highEq);

      // Reverb FX Plugin Nodes
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const preDelay = ctx.createDelay(1.0);
      preDelay.delayTime.value = track.reverb?.preDelay || 0.02;

      const dampingFilter = ctx.createBiquadFilter();
      dampingFilter.type = 'lowpass';
      dampingFilter.frequency.value = track.reverb?.damping || 8000;

      const convolver = ctx.createConvolver();
      const decay = track.reverb?.decay || 1.8;
      convolver.buffer = createReverbImpulse(ctx, decay);

      const sumGain = ctx.createGain();

      // HighEq -> Dry path -> sumGain
      highEq.connect(dryGain);
      dryGain.connect(sumGain);

      // HighEq -> Wet path -> preDelay -> convolver -> dampingFilter -> wetGain -> sumGain
      highEq.connect(preDelay);
      preDelay.connect(convolver);
      convolver.connect(dampingFilter);
      dampingFilter.connect(wetGain);
      wetGain.connect(sumGain);

      // Dedicated Real-time Track Spectrum Analyzer Node
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins: high-speed, responsive visual feedback
      analyser.smoothingTimeConstant = 0.78;

      // Panner Node
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : (sumGain as unknown as StereoPannerNode);
      if (ctx.createStereoPanner) {
        sumGain.connect(pan);
        pan.connect(analyser);
      } else {
        sumGain.connect(analyser);
      }
      analyser.connect(masterOut);

      nodes = {
        inputGain,
        lowEq,
        midEq,
        highEq,
        dryGain,
        wetGain,
        preDelay,
        dampingFilter,
        convolver,
        sumGain,
        pan,
        analyser,
        lastReverbDecay: decay,
      };
      this.trackNodes.set(track.id, nodes);
    }

    // Check solo states across all tracks
    const allTracks = this.getTracksRef ? this.getTracksRef() : [];
    const hasSolo = allTracks.some((t) => t.isSolo);
    const effectiveMute = track.isMuted || (hasSolo && !track.isSolo);

    nodes.inputGain.gain.setValueAtTime(effectiveMute ? 0 : track.volume, ctx.currentTime);
    if ('pan' in nodes.pan && nodes.pan.pan) {
      nodes.pan.pan.setValueAtTime(track.pan, ctx.currentTime);
    }

    // Update 3-Band Parametric EQ
    const eq = track.eq;
    if (eq && eq.enabled !== false) {
      nodes.lowEq.gain.setValueAtTime(eq.low || 0, ctx.currentTime);
      nodes.lowEq.frequency.setValueAtTime(eq.lowFreq || 200, ctx.currentTime);

      nodes.midEq.gain.setValueAtTime(eq.mid || 0, ctx.currentTime);
      nodes.midEq.frequency.setValueAtTime(eq.midFreq || 1200, ctx.currentTime);

      nodes.highEq.gain.setValueAtTime(eq.high || 0, ctx.currentTime);
      nodes.highEq.frequency.setValueAtTime(eq.highFreq || 6000, ctx.currentTime);
    } else {
      nodes.lowEq.gain.setValueAtTime(0, ctx.currentTime);
      nodes.midEq.gain.setValueAtTime(0, ctx.currentTime);
      nodes.highEq.gain.setValueAtTime(0, ctx.currentTime);
    }

    // Update Reverb FX plugin parameters
    const rev = track.reverb;
    if (rev && rev.enabled) {
      nodes.wetGain.gain.setValueAtTime(rev.mix, ctx.currentTime);
      nodes.dryGain.gain.setValueAtTime(1 - rev.mix * 0.5, ctx.currentTime);
      nodes.preDelay.delayTime.setValueAtTime(Math.min(0.2, rev.preDelay || 0.02), ctx.currentTime);
      nodes.dampingFilter.frequency.setValueAtTime(rev.damping || 8000, ctx.currentTime);

      // Re-generate impulse if decay changed significantly
      if (Math.abs((nodes.lastReverbDecay || 0) - rev.decay) > 0.3) {
        nodes.convolver.buffer = createReverbImpulse(ctx, rev.decay);
        nodes.lastReverbDecay = rev.decay;
      }
    } else {
      nodes.wetGain.gain.setValueAtTime(0, ctx.currentTime);
      nodes.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
    }

    return nodes;
  }

  // Ensure routing and return track audio nodes (creates AnalyserNode if not initialized)
  ensureTrackNodes(track: Track): TrackAudioNodes {
    const ctx = getAudioContext();
    return this.getTrackNodes(track, ctx, getMasterGain());
  }

  // Retrieve track real-time AnalyserNode for spectrum visualization
  getTrackAnalyser(trackId: string): AnalyserNode | null {
    const existing = this.trackNodes.get(trackId);
    if (existing) return existing.analyser;

    if (this.getTracksRef) {
      const tracks = this.getTracksRef();
      const track = tracks.find((t) => t.id === trackId);
      if (track) {
        const nodes = this.ensureTrackNodes(track);
        return nodes.analyser;
      }
    }
    return null;
  }

  private tick = () => {
    if (!this.isPlaying) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const dt = now - this.lastAudioTime;
    this.lastAudioTime = now;

    // Evaluate Real-Time Automation (Tempo/BPM, Volume, Pan, Reverb)
    let automatedBpm: number | null = null;
    if (this.automationClips.length > 0) {
      for (const clip of this.automationClips) {
        if (
          this.currentBeat >= clip.startBeat &&
          this.currentBeat <= clip.startBeat + clip.durationBeats
        ) {
          const relBeat = this.currentBeat - clip.startBeat;
          const normVal = evaluateAutomationClip(clip, relBeat);

          if (clip.target === 'bpm') {
            const minB = clip.minVal ?? 60;
            const maxB = clip.maxVal ?? 180;
            automatedBpm = Math.round(minB + (maxB - minB) * normVal);
          } else if (clip.target === 'track_volume' && clip.targetTrackId) {
            const nodes = this.trackNodes.get(clip.targetTrackId);
            if (nodes) {
              nodes.inputGain.gain.setValueAtTime(normVal * 1.5, now);
            }
          } else if (clip.target === 'track_pan' && clip.targetTrackId) {
            const nodes = this.trackNodes.get(clip.targetTrackId);
            if (nodes && 'pan' in nodes.pan && nodes.pan.pan) {
              nodes.pan.pan.setValueAtTime(normVal * 2 - 1, now);
            }
          } else if (clip.target === 'reverb_mix' && clip.targetTrackId) {
            const nodes = this.trackNodes.get(clip.targetTrackId);
            if (nodes) {
              nodes.wetGain.gain.setValueAtTime(normVal, now);
              nodes.dryGain.gain.setValueAtTime(1 - normVal * 0.5, now);
            }
          }
        }
      }
    }

    if (automatedBpm !== null && automatedBpm !== this.bpm) {
      this.bpm = automatedBpm;
      this.onBpmUpdateCallback?.(automatedBpm);
    }

    const beatsPassed = (dt * this.bpm) / 60;
    this.currentBeat += beatsPassed;

    if (this.isLooping && this.currentBeat >= this.loopEndBeat) {
      const overshoot = this.currentBeat - this.loopEndBeat;
      this.currentBeat = this.loopStartBeat + overshoot;
      this.nextScheduleBeat = this.currentBeat;
    }

    this.onBeatUpdateCallback?.(this.currentBeat);

    // Schedule events in lookahead window
    const targetBeat = this.currentBeat + this.scheduleAheadBeats;
    while (this.nextScheduleBeat < targetBeat) {
      this.scheduleBeat(this.nextScheduleBeat);
      this.nextScheduleBeat += 0.25; // schedule in 16th-note quantize steps
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private scheduleBeat(beat: number) {
    const ctx = getAudioContext();
    const secPerBeat = 60 / this.bpm;
    const deltaBeats = beat - this.currentBeat;
    const scheduleTime = ctx.currentTime + Math.max(0, deltaBeats * secPerBeat);

    // Metronome tick on whole beats
    if (this.metronomeEnabled && Math.abs(beat % 1) < 0.05) {
      const isHigh = Math.floor(beat) % 4 === 0;
      setTimeout(() => {
        if (this.isPlaying) playMetronomeClick(isHigh);
      }, Math.max(0, deltaBeats * secPerBeat * 1000));
    }

    const tracks = this.getTracksRef ? this.getTracksRef() : [];

    tracks.forEach((track) => {
      const { inputGain: trackGain } = this.getTrackNodes(track, ctx, getMasterGain());

      track.clips.forEach((clip) => {
        if (clip.type === 'audio' && clip.audioBuffer) {
          if (beat >= clip.startBeat && beat < clip.startBeat + 0.25) {
            this.playAudioClipSlice(clip, trackGain, scheduleTime);
          }
        } else if (clip.type === 'midi') {
          const stepStart = beat - clip.startBeat;
          const stepEnd = stepStart + 0.25;
          clip.notes.forEach((note) => {
            if (note.startTime >= stepStart && note.startTime < stepEnd) {
              const noteDurationSec = note.duration * secPerBeat;
              globalSynthEngine.triggerNote(
                note.midi,
                note.velocity,
                track.synthParams,
                scheduleTime,
                noteDurationSec,
                trackGain
              );
            }
          });
        }
      });
    });
  }

  private playAudioClipSlice(clip: AudioClip, destination: AudioNode, startTime: number) {
    if (!clip.audioBuffer) return;
    const ctx = getAudioContext();

    const src = ctx.createBufferSource();
    const clipGain = ctx.createGain();
    clipGain.gain.setValueAtTime(clip.samplerSettings.gain, startTime);

    const semitones = clip.samplerSettings.pitchSemitones + clip.samplerSettings.pitchCents / 100;
    const pitchFactor = Math.pow(2, semitones / 12);

    if (clip.samplerSettings.mode === 'resample') {
      src.buffer = clip.audioBuffer;
      src.playbackRate.setValueAtTime(pitchFactor * (1 / clip.samplerSettings.timeRatio), startTime);
    } else {
      const processed = processSamplerBuffer(clip.audioBuffer, clip.samplerSettings, this.bpm);
      src.buffer = processed;
      src.playbackRate.setValueAtTime(1.0, startTime);
    }

    src.connect(clipGain);
    clipGain.connect(destination);

    src.start(startTime);
    this.activeSourceNodes.push(src);

    src.onended = () => {
      const idx = this.activeSourceNodes.indexOf(src);
      if (idx !== -1) this.activeSourceNodes.splice(idx, 1);
    };
  }

  /**
   * Export the entire multi-track project to an offline WAV audio file
   * with 3-Band Parametric EQ and Reverb FX accurately rendered
   */
  async exportProjectWav(totalBeats: number = 32): Promise<Blob> {
    const tracks = this.getTracksRef ? this.getTracksRef() : [];
    const secPerBeat = 60 / this.bpm;
    const totalDurationSec = Math.max(2, totalBeats * secPerBeat);
    const sampleRate = 44100;

    const offlineCtx = new OfflineAudioContext(2, Math.round(totalDurationSec * sampleRate), sampleRate);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.connect(offlineCtx.destination);

    tracks.forEach((track) => {
      if (track.isMuted) return;

      const trackGain = offlineCtx.createGain();
      trackGain.gain.value = track.volume;

      // 3-Band Parametric EQ in Offline Context
      const lowEq = offlineCtx.createBiquadFilter();
      lowEq.type = 'lowshelf';
      lowEq.frequency.value = track.eq?.lowFreq || 200;
      lowEq.gain.value = track.eq?.enabled !== false ? (track.eq?.low || 0) : 0;

      const midEq = offlineCtx.createBiquadFilter();
      midEq.type = 'peaking';
      midEq.frequency.value = track.eq?.midFreq || 1200;
      midEq.Q.value = 1.0;
      midEq.gain.value = track.eq?.enabled !== false ? (track.eq?.mid || 0) : 0;

      const highEq = offlineCtx.createBiquadFilter();
      highEq.type = 'highshelf';
      highEq.frequency.value = track.eq?.highFreq || 6000;
      highEq.gain.value = track.eq?.enabled !== false ? (track.eq?.high || 0) : 0;

      trackGain.connect(lowEq);
      lowEq.connect(midEq);
      midEq.connect(highEq);

      // Reverb in Offline Context
      const sumGain = offlineCtx.createGain();
      if (track.reverb && track.reverb.enabled) {
        const dry = offlineCtx.createGain();
        dry.gain.value = 1 - track.reverb.mix * 0.5;

        const wet = offlineCtx.createGain();
        wet.gain.value = track.reverb.mix;

        const conv = offlineCtx.createConvolver();
        conv.buffer = createReverbImpulse(offlineCtx, track.reverb.decay);

        const damp = offlineCtx.createBiquadFilter();
        damp.type = 'lowpass';
        damp.frequency.value = track.reverb.damping || 8000;

        highEq.connect(dry);
        dry.connect(sumGain);

        highEq.connect(conv);
        conv.connect(damp);
        damp.connect(wet);
        wet.connect(sumGain);
      } else {
        highEq.connect(sumGain);
      }

      const panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = track.pan;

      sumGain.connect(panNode);
      panNode.connect(offlineMaster);

      track.clips.forEach((clip) => {
        if (clip.type === 'audio' && clip.audioBuffer) {
          const clipStartSec = clip.startBeat * secPerBeat;
          if (clipStartSec >= totalDurationSec) return;

          const src = offlineCtx.createBufferSource();
          const semitones = clip.samplerSettings.pitchSemitones + clip.samplerSettings.pitchCents / 100;
          const pitchFactor = Math.pow(2, semitones / 12);

          if (clip.samplerSettings.mode === 'resample') {
            src.buffer = clip.audioBuffer;
            src.playbackRate.value = pitchFactor * (1 / clip.samplerSettings.timeRatio);
          } else {
            src.buffer = processSamplerBuffer(clip.audioBuffer, clip.samplerSettings, this.bpm);
          }

          src.connect(trackGain);
          src.start(clipStartSec);
        } else if (clip.type === 'midi') {
          clip.notes.forEach((note) => {
            const noteStartSec = (clip.startBeat + note.startTime) * secPerBeat;
            const noteDurSec = note.duration * secPerBeat;
            if (noteStartSec >= totalDurationSec) return;

            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

            osc.type = track.synthParams.osc1Type === 'noise' ? 'sawtooth' : track.synthParams.osc1Type;
            osc.frequency.setValueAtTime(freq, noteStartSec);

            gain.gain.setValueAtTime(0.001, noteStartSec);
            gain.gain.linearRampToValueAtTime(note.velocity * 0.35, noteStartSec + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteStartSec + noteDurSec + 0.1);

            osc.connect(gain);
            gain.connect(trackGain);

            osc.start(noteStartSec);
            osc.stop(noteStartSec + noteDurSec + 0.15);
          });
        }
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return encodeWavBlob(renderedBuffer);
  }
}

export const globalPlaybackEngine = new PlaybackEngine();

