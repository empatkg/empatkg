export type TrackType = 'audio' | 'synth' | 'drums';

export type SamplerMode = 'resample' | 'stretch' | 'auto';

export interface Note {
  id: string;
  midi: number; // 0 - 127
  startTime: number; // in beats
  duration: number; // in beats
  velocity: number; // 0 - 1
}

export interface SamplerSettings {
  mode: SamplerMode; // 'resample' | 'stretch' | 'auto'
  pitchSemitones: number; // -24 to +24
  pitchCents: number; // -100 to +100
  timeRatio: number; // 0.25 to 4.0 (1.0 = normal)
  autoBeats: number; // 1, 2, 4, 8, 16 beats to lock to, or 0 for manual
  reverse: boolean;
  normalize: boolean;
  gain: number; // 0 to 2
  pan: number; // -1 to +1
  startOffset: number; // 0 to 1
  endOffset: number; // 0 to 1
  loop: boolean;
}

export interface AudioClip {
  id: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  audioBuffer: AudioBuffer | null;
  bufferVersion: number; // increments on edit to trigger redraw
  samplerSettings: SamplerSettings;
  color: string;
}

export interface MidiClip {
  id: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  notes: Note[];
  color: string;
}

export type TrackClip = 
  | ({ type: 'audio' } & AudioClip)
  | ({ type: 'midi' } & MidiClip);

export interface SynthParams {
  osc1Type: OscillatorType | 'noise';
  osc1Octave: number; // -2, -1, 0, 1, 2
  osc1Detune: number; // -100 to 100 cents
  osc1Mix: number; // 0 to 1
  
  osc2Type: OscillatorType | 'noise';
  osc2Octave: number; // -2, -1, 0, 1, 2
  osc2Detune: number; // -100 to 100 cents
  osc2Mix: number; // 0 to 1

  filterType: BiquadFilterType;
  filterCutoff: number; // 20 to 20000 Hz
  filterResonance: number; // 0.1 to 20
  filterEnvAmount: number; // -1 to 1

  ampAttack: number; // 0.001 to 5s
  ampDecay: number; // 0.001 to 5s
  ampSustain: number; // 0 to 1
  ampRelease: number; // 0.001 to 5s

  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  filterRelease: number;

  lfoRate: number; // 0.1 to 20 Hz
  lfoDepth: number; // 0 to 1
  lfoTarget: 'pitch' | 'cutoff' | 'pan' | 'none';
  lfoType: OscillatorType;

  glide: number; // 0 to 0.5s

  // Effects
  distortion: number; // 0 to 1
  delayTime: number; // 0 to 1s (or sync beat)
  delayFeedback: number; // 0 to 0.9
  delayMix: number; // 0 to 1
  reverbDecay: number; // 0.1 to 5s
  reverbMix: number; // 0 to 1
}

export interface DrumVoiceSettings {
  pitch: number; // semitones
  decay: number; // 0.05 to 2.0s
  volume: number; // 0 to 1
  pan: number; // -1 to 1
}

export interface TrackEq {
  enabled: boolean;
  low: number; // dB gain (-15 to +15)
  mid: number; // dB gain (-15 to +15)
  high: number; // dB gain (-15 to +15)
  lowFreq: number; // Hz (default 200)
  midFreq: number; // Hz (default 1200)
  highFreq: number; // Hz (default 6000)
}

export const DEFAULT_TRACK_EQ: TrackEq = {
  enabled: true,
  low: 0,
  mid: 0,
  high: 0,
  lowFreq: 200,
  midFreq: 1200,
  highFreq: 6000,
};

export interface ReverbFx {
  enabled: boolean;
  decay: number; // seconds, 0.2 to 6.0
  damping: number; // high-cut frequency (Hz), 1000 to 18000
  preDelay: number; // seconds, 0.0 to 0.1
  mix: number; // 0 to 1 (0% to 100%)
  width: number; // 0 to 1
}

export const DEFAULT_REVERB_FX: ReverbFx = {
  enabled: false,
  decay: 1.8,
  damping: 8000,
  preDelay: 0.02,
  mix: 0.35,
  width: 0.8,
};

export interface Pattern {
  id: string;
  name: string;
  durationBeats: number;
  notes: Note[];
  color: string;
  trackId?: string; // Optional track binding
}

export interface AutomationPoint {
  id: string;
  beat: number; // relative beat inside the clip (0 to durationBeats)
  value: number; // normalized 0 to 1
  tension: number; // -1 to 1 (-1 = concave, 0 = linear, +1 = convex)
}

export type AutomationTarget =
  | 'bpm'
  | 'track_volume'
  | 'track_pan'
  | 'synth_cutoff'
  | 'reverb_mix';

export interface AutomationClip {
  id: string;
  name: string;
  target: AutomationTarget;
  targetTrackId?: string; // which track to automate if track-specific
  startBeat: number;
  durationBeats: number;
  points: AutomationPoint[];
  color: string;
  minVal?: number; // e.g. for BPM min = 60, max = 200
  maxVal?: number;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number; // 0 to 1.5
  pan: number; // -1 to +1
  isMuted: boolean;
  isSolo: boolean;
  isArmed: boolean; // Armed for mic recording
  synthParams: SynthParams;
  eq: TrackEq;
  reverb: ReverbFx;
  clips: TrackClip[];
}

export type ActiveScreen = 'playlist' | 'pianoroll' | 'synth' | 'sampler' | 'mixer';

export interface ProjectState {
  bpm: number;
  timeSignature: [number, number];
  isPlaying: boolean;
  isRecording: boolean;
  currentBeat: number;
  loopStartBeat: number;
  loopEndBeat: number;
  isLooping: boolean;
  metronome: boolean;
  masterVolume: number;
}

export interface AppTheme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  surfaceHeader: string;
  border: string;
  primary: string;
  primaryLight: string;
  text: string;
  textMuted: string;
  trackAccent: string;
}

export interface AppConfig {
  version: string;
  themeId: string;
  customAccentColor: string;
  uiScale: 'compact' | 'standard' | 'comfortable';
  keySize: 'small' | 'medium' | 'large';
  audioBufferSize: 'low_latency' | 'standard' | 'safe';
  sampleRate: number;
  metronomeSound: 'clave' | 'hihat' | 'woodblock';
  metronomeVolume: number;
  quantizeSnap: '1/4' | '1/8' | '1/16' | '1/32' | 'none';
  autoSaveIntervalMinutes: number;
  storagePath: string;
  showCpuRamMeter: boolean;
  highContrastGrid: boolean;
  lastOpenedSongId?: string;
}

export type SongFormat = 'flm' | 'flp' | 'zip' | 'midi' | 'wav' | 'flac' | 'ogg' | 'mp3';

export type FolderCategory = 'My Songs' | 'My Samples' | 'My Recordings' | 'My Presets' | 'Templates';

export interface SongFile {
  id: string;
  name: string;
  format: SongFormat;
  folder: FolderCategory;
  sizeBytes: number;
  lastModified: number;
  bpm: number;
  durationFormatted: string;
  tracksCount: number;
  artist?: string;
  genre?: string;
  projectData?: {
    tracks: any[];
    patterns: any[];
    automationClips: any[];
    bpm: number;
    masterVolume?: number;
  };
}

export const THEME_PRESETS: AppTheme[] = [
  {
    id: 'fl-dark',
    name: 'FL Studio Charcoal (Classic)',
    bg: '#121316',
    surface: '#181b22',
    surfaceHeader: '#20242e',
    border: '#2a2f3d',
    primary: '#f97316',
    primaryLight: '#fb923c',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    trackAccent: '#f97316',
  },
  {
    id: 'oled-midnight',
    name: 'OLED Midnight & Neon Mint',
    bg: '#08080a',
    surface: '#0f1014',
    surfaceHeader: '#16181f',
    border: '#20232c',
    primary: '#10b981',
    primaryLight: '#34d399',
    text: '#ffffff',
    textMuted: '#a1a1aa',
    trackAccent: '#10b981',
  },
  {
    id: 'neon-cyber',
    name: 'Cyberpunk Synthwave',
    bg: '#0d0b14',
    surface: '#151221',
    surfaceHeader: '#1e1a30',
    border: '#2d2547',
    primary: '#06b6d4',
    primaryLight: '#22d3ee',
    text: '#f8fafc',
    textMuted: '#a78bfa',
    trackAccent: '#ec4899',
  },
  {
    id: 'fruity-purple',
    name: 'Fruity Deep Violet',
    bg: '#110e18',
    surface: '#191524',
    surfaceHeader: '#231d33',
    border: '#322a48',
    primary: '#a855f7',
    primaryLight: '#c084fc',
    text: '#faf5ff',
    textMuted: '#c4b5fd',
    trackAccent: '#a855f7',
  },
  {
    id: 'emerald-studio',
    name: 'Emerald Electro',
    bg: '#0c1313',
    surface: '#121c1c',
    surfaceHeader: '#182727',
    border: '#203737',
    primary: '#14b8a6',
    primaryLight: '#2dd4bf',
    text: '#f0fdfa',
    textMuted: '#5eead4',
    trackAccent: '#14b8a6',
  },
  {
    id: 'nord-frost',
    name: 'Nord Studio Frost',
    bg: '#0f141c',
    surface: '#161d29',
    surfaceHeader: '#1e2736',
    border: '#283447',
    primary: '#38bdf8',
    primaryLight: '#7dd3fc',
    text: '#f0f9ff',
    textMuted: '#93c5fd',
    trackAccent: '#38bdf8',
  },
];

export const DEFAULT_APP_CONFIG: AppConfig = {
  version: '4.10.19 G',
  themeId: 'fl-dark',
  customAccentColor: '#f97316',
  uiScale: 'standard',
  keySize: 'medium',
  audioBufferSize: 'standard',
  sampleRate: 48000,
  metronomeSound: 'clave',
  metronomeVolume: 0.75,
  quantizeSnap: '1/16',
  autoSaveIntervalMinutes: 5,
  storagePath: '/storage/emulated/0/FLM',
  showCpuRamMeter: true,
  highContrastGrid: false,
};
