import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Waves,
  Play,
  Pause,
  Square,
  Volume2,
  Scissors,
  RotateCcw,
  Sparkles,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  VolumeX,
  Crop,
  Radio,
  Download,
  Upload,
  Mic,
  Music2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { AudioClip, SamplerMode, SamplerSettings } from '../types';
import { getAudioContext, MicRecorder } from '../audio/audioContext';
import {
  normalizeAudioBuffer,
  reverseAudioBuffer,
  fadeInAudioBuffer,
  fadeOutAudioBuffer,
  silenceAudioBuffer,
  trimAudioBuffer,
  removeDcOffset,
  invertPhase,
  detectTransients,
  encodeWavBlob,
  cloneAudioBuffer,
} from '../audio/waveformUtils';
import {
  processSamplerBuffer,
  getPlaybackParameters,
} from '../audio/timeStretchEngine';
import {
  create808Kick,
  createSnare,
  createHiHat,
  createVocalChop,
  createPluckLead,
  createDrumLoop,
} from '../audio/defaultSamples';

interface SamplerWaveformViewProps {
  clip: AudioClip | null;
  onUpdateClipSettings: (settings: SamplerSettings) => void;
  onUpdateClipBuffer: (newBuffer: AudioBuffer) => void;
  bpm: number;
}

export const SamplerWaveformView: React.FC<SamplerWaveformViewProps> = ({
  clip,
  onUpdateClipSettings,
  onUpdateClipBuffer,
  bpm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Selection range on waveform (0.0 to 1.0)
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0.1,
    end: 0.9,
  });
  const [isSelecting, setIsSelecting] = useState(false);

  // Microphone recording
  const micRecorderRef = useRef<MicRecorder>(new MicRecorder());
  const [isRecordingMic, setIsRecordingMic] = useState(false);

  // Processing state indicator
  const [isProcessing, setIsProcessing] = useState(false);

  // Fallback initial sample if none provided
  const currentBuffer = clip?.audioBuffer || null;
  const settings: SamplerSettings = clip?.samplerSettings || {
    mode: 'stretch',
    pitchSemitones: 0,
    pitchCents: 0,
    timeRatio: 1.0,
    autoBeats: 4,
    reverse: false,
    normalize: false,
    gain: 1.0,
    pan: 0,
    startOffset: 0,
    endOffset: 1,
    loop: false,
  };

  // Pre-calculate playback parameters
  const playParams = currentBuffer
    ? getPlaybackParameters(settings, currentBuffer.duration, bpm)
    : { playbackRate: 1, pitchFactor: 1, timeStretchRatio: 1, effectiveDurationBeats: 4 };

  // Draw Waveform onto Canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, width, height);

    // Draw center zero line & grid
    ctx.strokeStyle = '#232733';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Beat grid lines
    const gridCols = 8;
    for (let i = 1; i < gridCols; i++) {
      const x = (i / gridCols) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = '#1b1e27';
      ctx.stroke();
    }

    if (!currentBuffer) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No audio loaded. Drop a file, record from mic, or select a preset.', width / 2, height / 2);
      return;
    }

    // Draw selection highlight
    const selStartX = selection.start * width;
    const selEndX = selection.end * width;
    const selWidth = Math.max(2, selEndX - selStartX);

    ctx.fillStyle = 'rgba(249, 115, 22, 0.18)'; // Orange FL highlight
    ctx.fillRect(selStartX, 0, selWidth, height);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.strokeRect(selStartX, 0, selWidth, height);

    // Draw audio waveform
    const data = currentBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2 - 8;

    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8'; // Cyan FL Mobile waveform color
    ctx.lineWidth = 1.5;

    for (let x = 0; x < width; x++) {
      let min = 1.0;
      let max = -1.0;
      const startIdx = x * step;

      for (let j = 0; j < step; j++) {
        const datum = data[startIdx + j] || 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const yMin = height / 2 + min * amp;
      const yMax = height / 2 + max * amp;

      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    ctx.stroke();

    // Draw Selection Handles
    ctx.fillStyle = '#f97316';
    ctx.fillRect(selStartX - 3, 0, 6, 16);
    ctx.fillRect(selEndX - 3, height - 16, 6, 16);
  }, [currentBuffer, selection]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform, clip?.bufferVersion]);

  // Handle canvas selection interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSelection({ start: xNorm, end: xNorm });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSelection((prev) => ({
      start: Math.min(prev.start, xNorm),
      end: Math.max(prev.start, xNorm),
    }));
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    // Ensure minimum selection
    if (Math.abs(selection.end - selection.start) < 0.02) {
      setSelection({ start: 0, end: 1 });
    }
  };

  // Preview playback of sample with current Sampler Settings applied
  const playPreview = (useSelectionOnly = false) => {
    if (!currentBuffer) return;
    stopPreview();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    // If selection only, trim temporary buffer
    let bufferToPlay = currentBuffer;
    if (useSelectionOnly && Math.abs(selection.end - selection.start) > 0.02) {
      bufferToPlay = trimAudioBuffer(currentBuffer, selection.start, selection.end);
    }

    setIsProcessing(true);
    setTimeout(() => {
      try {
        let processed = bufferToPlay;
        const semitones = settings.pitchSemitones + settings.pitchCents / 100;
        const pitchFactor = Math.pow(2, semitones / 12);

        const src = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(settings.gain, ctx.currentTime);

        if (settings.mode === 'resample') {
          src.buffer = processed;
          src.playbackRate.setValueAtTime(pitchFactor * (1 / settings.timeRatio), ctx.currentTime);
        } else {
          // Stretch or Auto: use granular DSP to shift pitch and stretch time independently
          processed = processSamplerBuffer(bufferToPlay, settings, bpm);
          src.buffer = processed;
          src.playbackRate.setValueAtTime(1.0, ctx.currentTime);
        }

        src.connect(gainNode);
        gainNode.connect(ctx.destination);

        src.start();
        activeSourceRef.current = src;
        setIsPlayingPreview(true);

        src.onended = () => {
          setIsPlayingPreview(false);
          activeSourceRef.current = null;
        };
      } catch (e) {
        console.error('Preview playback error:', e);
      } finally {
        setIsProcessing(false);
      }
    }, 10);
  };

  const stopPreview = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  // Advanced Waveform Editing Actions
  const handleNormalize = () => {
    if (!currentBuffer) return;
    const normalized = normalizeAudioBuffer(currentBuffer, 0);
    onUpdateClipBuffer(normalized);
  };

  const handleReverse = () => {
    if (!currentBuffer) return;
    const reversed = reverseAudioBuffer(currentBuffer);
    onUpdateClipBuffer(reversed);
  };

  const handleFadeIn = () => {
    if (!currentBuffer) return;
    const faded = fadeInAudioBuffer(currentBuffer, selection.start, selection.end);
    onUpdateClipBuffer(faded);
  };

  const handleFadeOut = () => {
    if (!currentBuffer) return;
    const faded = fadeOutAudioBuffer(currentBuffer, selection.start, selection.end);
    onUpdateClipBuffer(faded);
  };

  const handleSilence = () => {
    if (!currentBuffer) return;
    const silenced = silenceAudioBuffer(currentBuffer, selection.start, selection.end);
    onUpdateClipBuffer(silenced);
  };

  const handleTrimCrop = () => {
    if (!currentBuffer) return;
    const trimmed = trimAudioBuffer(currentBuffer, selection.start, selection.end);
    setSelection({ start: 0, end: 1 });
    onUpdateClipBuffer(trimmed);
  };

  const handleRemoveDc = () => {
    if (!currentBuffer) return;
    const dcFixed = removeDcOffset(currentBuffer);
    onUpdateClipBuffer(dcFixed);
  };

  const handleInvertPhase = () => {
    if (!currentBuffer) return;
    const inverted = invertPhase(currentBuffer);
    onUpdateClipBuffer(inverted);
  };

  const handleSliceTransients = () => {
    if (!currentBuffer) return;
    const points = detectTransients(currentBuffer);
    if (points.length > 1) {
      setSelection({ start: points[0], end: points[1] });
    }
  };

  // Live Microphone Recording
  const handleToggleMicRecord = async () => {
    if (isRecordingMic) {
      setIsRecordingMic(false);
      const buffer = await micRecorderRef.current.stopRecording();
      if (buffer) {
        onUpdateClipBuffer(buffer);
        setSelection({ start: 0, end: 1 });
      }
    } else {
      try {
        await micRecorderRef.current.startRecording();
        setIsRecordingMic(true);
      } catch (err) {
        alert('Microphone access denied or not supported in this frame.');
      }
    }
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      onUpdateClipBuffer(decoded);
      setSelection({ start: 0, end: 1 });
    } catch (err) {
      alert('Error decoding audio file. Please try a standard .wav or .mp3.');
    }
  };

  // Preset loading
  const loadPreset = (type: 'vocal' | 'drumloop' | 'kick' | 'snare' | 'hat' | 'pluck') => {
    let buf: AudioBuffer;
    switch (type) {
      case 'vocal':
        buf = createVocalChop();
        break;
      case 'drumloop':
        buf = createDrumLoop(bpm);
        break;
      case 'kick':
        buf = create808Kick();
        break;
      case 'snare':
        buf = createSnare();
        break;
      case 'hat':
        buf = createHiHat();
        break;
      case 'pluck':
        buf = createPluckLead();
        break;
    }
    onUpdateClipBuffer(buf);
    setSelection({ start: 0, end: 1 });
  };

  // Download Edited WAV
  const handleDownloadWav = () => {
    if (!currentBuffer) return;
    const blob = encodeWavBlob(currentBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clip?.name || 'sample'}_edited.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#14161d] overflow-y-auto text-slate-200 select-none pb-8">
      {/* Header & Preset Bar */}
      <div className="bg-[#1a1d26] border-b border-[#282d3b] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                FL SAMPLER &amp; AUDIO EDITOR
              </span>
              <span className="text-[11px] font-mono font-bold bg-orange-950 text-orange-400 px-2 py-0.5 rounded border border-orange-800/60 uppercase">
                MODE: {settings.mode}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Stretch, Resample &amp; Auto pitch/time modes with precision waveform tools
            </p>
          </div>
        </div>

        {/* Quick Studio Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">PRESETS:</span>
          <button
            onClick={() => loadPreset('vocal')}
            className="px-2 py-1 rounded bg-[#232734] hover:bg-[#2e3446] text-xs font-semibold text-sky-400 border border-[#343a4e] transition-colors whitespace-nowrap"
          >
            Vocal Hook "Yeah"
          </button>
          <button
            onClick={() => loadPreset('drumloop')}
            className="px-2 py-1 rounded bg-[#232734] hover:bg-[#2e3446] text-xs font-semibold text-amber-400 border border-[#343a4e] transition-colors whitespace-nowrap"
          >
            2-Bar Drum Loop
          </button>
          <button
            onClick={() => loadPreset('kick')}
            className="px-2 py-1 rounded bg-[#232734] hover:bg-[#2e3446] text-xs font-semibold text-emerald-400 border border-[#343a4e] transition-colors whitespace-nowrap"
          >
            808 Kick
          </button>
          <button
            onClick={() => loadPreset('pluck')}
            className="px-2 py-1 rounded bg-[#232734] hover:bg-[#2e3446] text-xs font-semibold text-purple-400 border border-[#343a4e] transition-colors whitespace-nowrap"
          >
            Pluck Synth
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5 flex flex-col gap-4 max-w-7xl mx-auto w-full">
        {/* TOP SECTION: FL SAMPLER TIME STRETCHING & PITCH SETTINGS (STRETCH / RESAMPLE / AUTO) */}
        <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262a38] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Time Stretching Engine (FL Studio Sampler)
              </span>
            </div>

            {/* MODE SWITCHER: RESAMPLE | STRETCH | AUTO */}
            <div className="flex items-center bg-[#101117] p-1 rounded-lg border border-[#2d3243]">
              {(['resample', 'stretch', 'auto'] as SamplerMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateClipSettings({ ...settings, mode })}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    settings.mode === mode
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-[#202330]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Mode explanation banner */}
          <div className="text-[11px] font-mono px-3 py-1.5 rounded bg-[#10121a] border border-[#222634] text-slate-300">
            {settings.mode === 'resample' && (
              <span className="text-emerald-400">
                • <strong>RESAMPLE MODE</strong>: Pitch and duration are tied together like vinyl/tape speed. Higher pitch = plays faster/shorter; lower pitch = plays slower/longer.
              </span>
            )}
            {settings.mode === 'stretch' && (
              <span className="text-orange-400">
                • <strong>STRETCH MODE</strong>: Pitch and time are completely independent. Pitch shift by semitones without changing clip length, and time-stretch duration without changing pitch!
              </span>
            )}
            {settings.mode === 'auto' && (
              <span className="text-cyan-400">
                • <strong>AUTO MODE</strong>: Automatically stretches audio duration to fit project BPM grid beats ({settings.autoBeats || 'Auto'} beats) while letting you shift musical pitch freely.
              </span>
            )}
          </div>

          {/* Knobs & Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. PITCH SHIFTING */}
            <div className="bg-[#12141c] p-3.5 rounded-lg border border-[#262b3a] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Pitch Shift</span>
                <span className="text-xs font-mono font-bold text-orange-400">
                  {settings.pitchSemitones >= 0 ? `+${settings.pitchSemitones}` : settings.pitchSemitones} st{' '}
                  <span className="text-[10px] text-slate-500">
                    ({settings.pitchCents >= 0 ? `+${settings.pitchCents}` : settings.pitchCents} ct)
                  </span>
                </span>
              </div>

              {/* Semitones slider */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>-24 st</span>
                  <span>0</span>
                  <span>+24 st</span>
                </div>
                <input
                  type="range"
                  min={-24}
                  max={24}
                  step={1}
                  value={settings.pitchSemitones}
                  onChange={(e) =>
                    onUpdateClipSettings({ ...settings, pitchSemitones: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-orange-500 h-2 bg-[#252a38] rounded-lg cursor-pointer"
                />
              </div>

              {/* Fine cents slider */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono w-10">CENTS:</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={settings.pitchCents}
                  onChange={(e) =>
                    onUpdateClipSettings({ ...settings, pitchCents: parseInt(e.target.value, 10) })
                  }
                  className="flex-1 accent-amber-500 h-1.5 bg-[#252a38] rounded-lg cursor-pointer"
                />
              </div>

              {/* Quick pitch buttons */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[-12, -5, 0, 5, 7, 12].map((st) => (
                  <button
                    key={st}
                    onClick={() => onUpdateClipSettings({ ...settings, pitchSemitones: st, pitchCents: 0 })}
                    className={`px-1.5 py-1 text-[10px] font-mono font-bold rounded ${
                      settings.pitchSemitones === st
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#1c1f2b] text-slate-400 hover:text-white'
                    }`}
                  >
                    {st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. TIME STRETCH MULTIPLIER & AUTO BEATS */}
            <div className="bg-[#12141c] p-3.5 rounded-lg border border-[#262b3a] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  {settings.mode === 'auto' ? 'Auto Beat Lock' : 'Time Multiplier'}
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {settings.mode === 'auto'
                    ? `${settings.autoBeats} Beats (${settings.autoBeats / 4} Bars)`
                    : `${Math.round(settings.timeRatio * 100)}% (${settings.timeRatio.toFixed(2)}x)`}
                </span>
              </div>

              {settings.mode === 'auto' ? (
                <div>
                  <div className="text-[10px] text-slate-400 mb-1.5">Fit audio loop to project grid:</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: '1 Beat', val: 1 },
                      { label: '2 Beats', val: 2 },
                      { label: '1 Bar (4)', val: 4 },
                      { label: '2 Bars (8)', val: 8 },
                      { label: '4 Bars (16)', val: 16 },
                      { label: 'Auto', val: 0 },
                    ].map((b) => (
                      <button
                        key={b.label}
                        onClick={() => onUpdateClipSettings({ ...settings, autoBeats: b.val })}
                        className={`py-1 text-[11px] font-mono font-semibold rounded ${
                          settings.autoBeats === b.val
                            ? 'bg-cyan-600 text-white'
                            : 'bg-[#1c1f2b] text-slate-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>0.25x (Fast)</span>
                    <span>1.0x (Original)</span>
                    <span>4.0x (Slow)</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3.0}
                    step={0.05}
                    value={settings.timeRatio}
                    onChange={(e) =>
                      onUpdateClipSettings({ ...settings, timeRatio: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cyan-500 h-2 bg-[#252a38] rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between gap-1 mt-2">
                    {[0.5, 0.75, 1.0, 1.33, 1.5, 2.0].map((r) => (
                      <button
                        key={r}
                        onClick={() => onUpdateClipSettings({ ...settings, timeRatio: r })}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                          Math.abs(settings.timeRatio - r) < 0.01
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-[#1c1f2b] text-slate-400 hover:text-white'
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-500 font-mono mt-auto">
                Effective duration in project: ~{playParams.effectiveDurationBeats.toFixed(1)} beats
              </div>
            </div>

            {/* 3. GAIN, PAN & PLAYBACK PREVIEW */}
            <div className="bg-[#12141c] p-3.5 rounded-lg border border-[#262b3a] flex flex-col justify-between gap-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Output &amp; Audition</span>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Gain</span>
                    <span className="font-mono text-emerald-400">{Math.round(settings.gain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.0}
                    step={0.05}
                    value={settings.gain}
                    onChange={(e) =>
                      onUpdateClipSettings({ ...settings, gain: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Pan</span>
                    <span className="font-mono text-slate-300">
                      {settings.pan === 0 ? 'C' : settings.pan < 0 ? `L${Math.round(-settings.pan * 100)}` : `R${Math.round(settings.pan * 100)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={settings.pan}
                    onChange={(e) =>
                      onUpdateClipSettings({ ...settings, pan: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Audition Play buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => (isPlayingPreview ? stopPreview() : playPreview(false))}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 ${
                    isPlayingPreview
                      ? 'bg-amber-500 text-black hover:bg-amber-400'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlayingPreview ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Play Full
                    </>
                  )}
                </button>

                <button
                  onClick={() => playPreview(true)}
                  disabled={isProcessing}
                  className="flex-1 py-2 rounded-lg font-bold text-xs bg-[#242836] hover:bg-[#2f3547] text-orange-400 border border-[#3b4257] active:scale-95 transition-all"
                  title="Play selected region on waveform"
                >
                  Play Selection
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: ADVANCED WAVEFORM EDITOR CANVAS & TOOLBAR (FL EDISON STYLE) */}
        <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
          {/* Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262a38] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Advanced Waveform Editing Tools
              </span>
              {currentBuffer && (
                <span className="text-[11px] font-mono text-slate-400 bg-[#12141c] px-2 py-0.5 rounded border border-[#242836]">
                  {currentBuffer.duration.toFixed(3)}s · {currentBuffer.sampleRate}Hz · {currentBuffer.numberOfChannels}ch
                </span>
              )}
            </div>

            {/* Mic Record & Import File Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMicRecord}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                  isRecordingMic
                    ? 'bg-red-600 text-white animate-pulse shadow-red-600/50'
                    : 'bg-[#222634] hover:bg-[#2b3142] text-red-400 border border-red-900/50'
                }`}
                title="Record directly from microphone into this waveform"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isRecordingMic ? 'Stop Recording' : 'Record Mic'}</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#222634] hover:bg-[#2b3142] text-slate-200 border border-[#373e52] cursor-pointer transition-all active:scale-95">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleDownloadWav}
                disabled={!currentBuffer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#222634] hover:bg-[#2b3142] text-emerald-400 border border-emerald-900/50 transition-all active:scale-95"
                title="Download edited waveform as WAV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export WAV</span>
              </button>
            </div>
          </div>

          {/* Interactive Waveform Canvas */}
          <div className="relative w-full h-44 bg-[#101218] rounded-lg overflow-hidden border border-[#292f3f] cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={1000}
              height={176}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="w-full h-full block"
            />
            {isSelecting && (
              <div className="absolute top-2 left-2 pointer-events-none text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded text-orange-400 border border-orange-500/40">
                Range: {Math.round(selection.start * 100)}% - {Math.round(selection.end * 100)}% (
                {currentBuffer ? `${((selection.end - selection.start) * currentBuffer.duration).toFixed(3)}s` : ''})
              </div>
            )}
          </div>

          {/* Waveform Editing Tools Button Row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={handleNormalize}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Scale peak amplitude to 0dB"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Normalize (0dB)</span>
            </button>

            <button
              onClick={handleReverse}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Reverse waveform in time"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
              <span>Reverse</span>
            </button>

            <button
              onClick={handleFadeIn}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Fade in volume across selection"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fade In</span>
            </button>

            <button
              onClick={handleFadeOut}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Fade out volume across selection"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Fade Out</span>
            </button>

            <button
              onClick={handleSilence}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Zero out selection"
            >
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              <span>Silence</span>
            </button>

            <button
              onClick={handleTrimCrop}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Crop to selection"
            >
              <Crop className="w-3.5 h-3.5 text-orange-400" />
              <span>Trim / Crop</span>
            </button>

            <button
              onClick={handleRemoveDc}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Center waveform around zero line"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>DC Offset Fix</span>
            </button>

            <button
              onClick={handleInvertPhase}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Invert audio polarity 180 degrees"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Invert Phase</span>
            </button>

            <button
              onClick={handleSliceTransients}
              disabled={!currentBuffer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#202432] hover:bg-[#2b3144] text-xs font-semibold text-slate-200 border border-[#32394e] active:scale-95 transition-all"
              title="Detect transient hit points"
            >
              <Scissors className="w-3.5 h-3.5 text-yellow-400" />
              <span>Detect Slices</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
