import React, { useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  Volume2,
  Activity,
  Plus,
  Waves,
  Sparkles,
  Trash2,
  Power,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Track, TrackEq, ReverbFx, DEFAULT_TRACK_EQ, DEFAULT_REVERB_FX, TrackType } from '../types';
import { getMasterAnalyser, setMasterVolume } from '../audio/audioContext';
import { DEFAULT_SYNTH_PARAMS } from '../audio/synthEngine';
import { ReverbPluginModal } from './ReverbPluginModal';
import { TrackSpectrumVisualizer } from './TrackSpectrumVisualizer';

interface MixerViewProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
}

// Master Channel Mini Real-time Spectrum Visualizer
const MasterChannelVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numBars = 16;
    const render = () => {
      try {
        const analyser = getMasterAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#0a0c12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // dB grid lines
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1a2030';
        [0.3, 0.6, 0.9].forEach((ratio) => {
          const y = Math.round(canvas.height * (1 - ratio));
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        });

        const barWidth = canvas.width / numBars - 1.5;
        for (let i = 0; i < numBars; i++) {
          const binIndex = Math.min(bufferLength - 1, Math.floor(Math.pow(i / numBars, 1.35) * bufferLength));
          const val = dataArray[binIndex] || 0;
          const h = (val / 255) * (canvas.height - 3);
          const x = i * (barWidth + 1.5) + 1;
          const y = canvas.height - h;

          if (h > 1) {
            const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
            grad.addColorStop(0, '#f97316aa');
            grad.addColorStop(0.75, '#f97316');
            grad.addColorStop(1, '#ef4444');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, h, [1, 1, 0, 0]);
            ctx.fill();
          }
        }
      } catch {
        // ignore
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-full bg-[#0d0f17] rounded-xl border border-orange-500/30 p-1.5 flex flex-col gap-1 shadow-inner">
      <div className="flex items-center justify-between text-[8px] font-mono px-0.5 text-orange-400 font-bold">
        <span>MASTER BUS</span>
        <span>PEAK OUT</span>
      </div>
      <div className="w-full h-10 rounded-lg overflow-hidden border border-[#1b202e] bg-[#07090e]">
        <canvas ref={canvasRef} width={116} height={40} className="w-full h-full block" />
      </div>
    </div>
  );
};

// Helper to draw the 3-Band Parametric EQ response curve
const EqResponseCurve: React.FC<{ eq: TrackEq; color: string }> = ({ eq, color }) => {
  const width = 120;
  const height = 44;
  const midY = height / 2;

  // Compute curve points: Low (x=20), Mid (x=60), High (x=100)
  // Gain -15 to +15 maps to +16px to -16px
  const lowOffset = -(eq.low / 15) * (height / 2 - 4);
  const midOffset = -(eq.mid / 15) * (height / 2 - 4);
  const highOffset = -(eq.high / 15) * (height / 2 - 4);

  const p0 = `0,${midY}`;
  const pLow = `30,${midY + lowOffset}`;
  const pMid = `60,${midY + midOffset}`;
  const pHigh = `90,${midY + highOffset}`;
  const pEnd = `${width},${midY + highOffset * 0.8}`;

  const pathD = `M ${p0} Q 15,${midY + lowOffset} ${pLow} T ${pMid} T ${pHigh} T ${pEnd}`;

  return (
    <div className="w-full h-11 bg-[#10121a] rounded-lg border border-[#242938] relative overflow-hidden flex items-center justify-center">
      {/* 0dB Reference Line */}
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#2a3144] -translate-y-1/2" />
      <svg width={width} height={height} className="w-full h-full">
        {/* Fill under curve */}
        <path
          d={`${pathD} L ${width},${height} L 0,${height} Z`}
          fill={eq.enabled !== false ? `${color}18` : '#47556918'}
        />
        {/* EQ response stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={eq.enabled !== false ? color : '#64748b'}
          strokeWidth="2"
        />
      </svg>
      <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-slate-500">
        {eq.low > 0 ? `+${eq.low}` : eq.low} / {eq.mid > 0 ? `+${eq.mid}` : eq.mid} /{' '}
        {eq.high > 0 ? `+${eq.high}` : eq.high} dB
      </div>
    </div>
  );
};

export const MixerView: React.FC<MixerViewProps> = ({
  tracks,
  setTracks,
  masterVolume,
  setMasterVolume: updateMasterVolume,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeReverbTrackId, setActiveReverbTrackId] = useState<string | null>(null);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackType, setNewTrackType] = useState<TrackType>('synth');

  // Animate master spectrum visualizer
  useEffect(() => {
    let animId: number;
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderSpectrum = () => {
      try {
        const analyser = getMasterAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#101117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw frequency grid lines
        ctx.strokeStyle = '#1d212d';
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
          const y = (i / 6) * canvas.height;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;

          // Gradient color from cyan to orange to red
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(0.6, '#f97316');
          gradient.addColorStop(1, '#ef4444');

          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

          x += barWidth;
        }
      } catch {
        // ignore
      }
      animId = requestAnimationFrame(renderSpectrum);
    };

    animId = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(animId);
  }, []);

  const updateTrackVolume = (trackId: string, vol: number) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, volume: vol } : t)));
  };

  const updateTrackPan = (trackId: string, pan: number) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, pan } : t)));
  };

  const toggleMute = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const toggleSolo = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)));
  };

  // 3-Band Parametric Equalizer Update
  const updateTrackEq = (trackId: string, patch: Partial<TrackEq>) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const currentEq = t.eq || { ...DEFAULT_TRACK_EQ };
        return {
          ...t,
          eq: { ...currentEq, ...patch },
        };
      })
    );
  };

  // Reverb FX Plugin Update
  const updateTrackReverb = (trackId: string, reverb: ReverbFx) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, reverb } : t)));
  };

  // Add a new mixer track
  const handleCreateMixerTrack = () => {
    const trackColors = ['#f97316', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#eab308', '#38bdf8'];
    const color = trackColors[tracks.length % trackColors.length];
    const newTrackId = `track_mix_${Date.now()}`;
    const name = newTrackName.trim() || `${newTrackType === 'audio' ? 'Audio' : 'Synth'} Ch ${tracks.length + 1}`;

    const newTrack: Track = {
      id: newTrackId,
      name,
      type: newTrackType,
      color,
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: newTrackType === 'audio',
      synthParams: { ...DEFAULT_SYNTH_PARAMS },
      eq: { ...DEFAULT_TRACK_EQ },
      reverb: { ...DEFAULT_REVERB_FX },
      clips: [],
    };

    setTracks([...tracks, newTrack]);
    setShowAddTrackModal(false);
    setNewTrackName('');
  };

  // Delete mixer track
  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const activeReverbTrack = tracks.find((t) => t.id === activeReverbTrackId);

  return (
    <div className="flex-1 flex flex-col bg-[#12141c] overflow-y-auto select-none text-slate-200 pb-8">
      {/* Header & Spectrum */}
      <div className="bg-[#181b26] border-b border-[#262c3d] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                FL STUDIO MOBILE MIXER DESK
              </span>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-mono font-bold">
                {tracks.length} CHANNELS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              3-Band Parametric EQ • Fruity Reverb 2 FX • Stereo Panning &amp; Summing Bus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Add Mixer Track Button */}
          <button
            onClick={() => setShowAddTrackModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Mixer Track</span>
          </button>

          {/* Real-time Spectrum Analyzer */}
          <div className="w-48 sm:w-64 h-12 bg-[#0d0e14] rounded-lg overflow-hidden border border-[#262c3d] shadow-inner">
            <canvas ref={spectrumCanvasRef} width={260} height={48} className="w-full h-full block" />
          </div>
        </div>
      </div>

      {/* Mixer Channel Strips Layout */}
      <div className="p-4 sm:p-6 flex items-start gap-3.5 overflow-x-auto min-h-[580px]">
        {/* MASTER CHANNEL */}
        <div className="w-36 bg-[#181b26] rounded-2xl p-3.5 border-2 border-orange-500/70 shadow-2xl flex flex-col items-center justify-between min-h-[550px] shrink-0">
          <div className="w-full text-center border-b border-[#2d3448] pb-2">
            <span className="text-[11px] font-bold font-mono text-orange-400 uppercase tracking-widest">
              MASTER BUS
            </span>
          </div>

          {/* Master Spectrum Visualizer */}
          <div className="w-full my-1">
            <MasterChannelVisualizer />
          </div>

          {/* Master Fader */}
          <div className="flex-1 flex items-center justify-center my-6 relative">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.02}
              value={masterVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateMasterVolume(val);
                setMasterVolume(val);
              }}
              className="accent-orange-500 w-52 -rotate-90 origin-center cursor-pointer"
            />
          </div>

          <div className="w-full flex flex-col items-center gap-1.5 border-t border-[#2d3448] pt-2">
            <span className="text-sm font-mono font-bold text-orange-400">
              {Math.round(masterVolume * 100)}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">MASTER OUT</span>
          </div>
        </div>

        {/* TRACK CHANNELS */}
        {tracks.map((track, idx) => {
          const eq = track.eq || { ...DEFAULT_TRACK_EQ };
          const reverb = track.reverb || { ...DEFAULT_REVERB_FX };

          return (
            <div
              key={track.id}
              className="w-44 bg-[#161822] rounded-2xl p-3 border border-[#262c3e] shadow-lg flex flex-col items-center justify-between min-h-[600px] shrink-0 relative hover:border-[#3a445e] transition-colors"
            >
              {/* Top Color Accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
                style={{ backgroundColor: track.color }}
              />

              {/* Channel Header */}
              <div className="w-full border-b border-[#232838] pb-2 mt-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span className="font-bold">CH {idx + 1}</span>
                  {tracks.length > 1 && (
                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      title="Delete mixer channel"
                      className="p-0.5 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-white truncate" title={track.name}>
                  {track.name}
                </div>
              </div>

              {/* 3-BAND PARAMETRIC EQUALIZER STRIP */}
              <div className="w-full bg-[#11131c] p-2 rounded-xl border border-[#23283a] flex flex-col gap-1.5 my-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    3-BAND EQ
                  </span>
                  <button
                    onClick={() => updateTrackEq(track.id, { enabled: !eq.enabled })}
                    title={eq.enabled ? 'EQ Active' : 'EQ Bypassed'}
                    className={`p-0.5 rounded text-[8px] font-bold font-mono transition-colors ${
                      eq.enabled ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {eq.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Response Visual Curve */}
                <EqResponseCurve eq={eq} color={track.color} />

                {/* 3 Parametric Frequency Knobs / Sliders: Low, Mid, High */}
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {/* LOW (200Hz Shelf) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-mono text-cyan-400 font-bold">LOW</span>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={eq.low}
                      onChange={(e) => updateTrackEq(track.id, { low: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400 h-1 bg-[#252b3d] rounded cursor-pointer my-1"
                      title={`Low Shelf (200Hz): ${eq.low > 0 ? `+${eq.low}` : eq.low} dB`}
                    />
                    <span className="text-[8px] font-mono text-slate-400">
                      {eq.low > 0 ? `+${eq.low}` : eq.low}
                    </span>
                  </div>

                  {/* MID (1.2kHz Peak) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-mono text-orange-400 font-bold">MID</span>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={eq.mid}
                      onChange={(e) => updateTrackEq(track.id, { mid: parseFloat(e.target.value) })}
                      className="w-full accent-orange-400 h-1 bg-[#252b3d] rounded cursor-pointer my-1"
                      title={`Mid Peak (1.2kHz): ${eq.mid > 0 ? `+${eq.mid}` : eq.mid} dB`}
                    />
                    <span className="text-[8px] font-mono text-slate-400">
                      {eq.mid > 0 ? `+${eq.mid}` : eq.mid}
                    </span>
                  </div>

                  {/* HIGH (6kHz Shelf) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-mono text-pink-400 font-bold">HIGH</span>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={eq.high}
                      onChange={(e) => updateTrackEq(track.id, { high: parseFloat(e.target.value) })}
                      className="w-full accent-pink-400 h-1 bg-[#252b3d] rounded cursor-pointer my-1"
                      title={`High Shelf (6kHz): ${eq.high > 0 ? `+${eq.high}` : eq.high} dB`}
                    />
                    <span className="text-[8px] font-mono text-slate-400">
                      {eq.high > 0 ? `+${eq.high}` : eq.high}
                    </span>
                  </div>
                </div>

                {/* Reset EQ to Flat */}
                {(eq.low !== 0 || eq.mid !== 0 || eq.high !== 0) && (
                  <button
                    onClick={() => updateTrackEq(track.id, { low: 0, mid: 0, high: 0 })}
                    className="w-full py-0.5 text-[8px] font-mono text-slate-400 hover:text-white bg-[#191d2c] hover:bg-[#252a3f] rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Flat (0dB)
                  </button>
                )}
              </div>

              {/* REVERB FX PLUGIN SLOT */}
              <div className="w-full my-1">
                <button
                  onClick={() => setActiveReverbTrackId(track.id)}
                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-between border transition-all ${
                    reverb.enabled
                      ? 'bg-purple-950/40 text-purple-300 border-purple-700/60 shadow-sm'
                      : 'bg-[#181b26] text-slate-400 hover:text-slate-200 border-[#262c3e]'
                  }`}
                  title="Open Fruity Reeverb 2 Plugin Rack"
                >
                  <div className="flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px]">REVERB FX</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      reverb.enabled ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'
                    }`}
                  />
                </button>
              </div>

              {/* REAL-TIME SPECTRUM FREQUENCY ANALYZER */}
              <div className="w-full my-1">
                <TrackSpectrumVisualizer track={track} />
              </div>

              {/* Stereo Pan Control */}
              <div className="flex flex-col items-center w-full my-1">
                <span className="text-[9px] font-mono text-slate-400">
                  PAN: {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.round(-track.pan * 100)}` : `R${Math.round(track.pan * 100)}`}
                </span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={track.pan}
                  onChange={(e) => updateTrackPan(track.id, parseFloat(e.target.value))}
                  className="w-20 accent-cyan-400 h-1 bg-[#282d3d] rounded cursor-pointer"
                />
              </div>

              {/* Vertical Volume Fader */}
              <div className="flex-1 flex items-center justify-center relative my-3">
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={track.volume}
                  onChange={(e) => updateTrackVolume(track.id, parseFloat(e.target.value))}
                  className="accent-cyan-400 w-44 -rotate-90 origin-center cursor-pointer"
                />
              </div>

              {/* Volume & Mute / Solo */}
              <div className="w-full flex flex-col items-center gap-1.5 border-t border-[#232838] pt-2">
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {Math.round(track.volume * 100)}%
                </span>

                <div className="flex items-center gap-1 w-full">
                  <button
                    onClick={() => toggleMute(track.id)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                      track.isMuted
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-[#202434] text-slate-400 hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => toggleSolo(track.id)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                      track.isSolo
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-[#202434] text-slate-400 hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Quick Add Channel Card at end of desk */}
        <button
          onClick={() => setShowAddTrackModal(true)}
          className="w-28 h-48 rounded-2xl border-2 border-dashed border-[#2d3448] hover:border-orange-500/60 bg-[#161822]/40 hover:bg-[#1c202d] text-slate-400 hover:text-white flex flex-col items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
        >
          <div className="p-2 rounded-full bg-[#222838] text-orange-400">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Add Track</span>
        </button>
      </div>

      {/* Reverb FX Plugin Modal */}
      {activeReverbTrack && (
        <ReverbPluginModal
          track={activeReverbTrack}
          isOpen={!!activeReverbTrack}
          onClose={() => setActiveReverbTrackId(null)}
          onUpdateReverb={updateTrackReverb}
        />
      )}

      {/* Add Mixer Track Modal */}
      {showAddTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
          <div className="bg-[#161824] rounded-2xl border border-[#2b3348] shadow-2xl max-w-sm w-full p-5 flex flex-col gap-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-[#293044] pb-2">
              <span className="font-bold text-sm text-white">Add New Mixer Track</span>
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-semibold">Track Name</label>
              <input
                type="text"
                placeholder={`Channel ${tracks.length + 1}`}
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                className="w-full bg-[#10121a] px-3 py-2 rounded-xl border border-[#283044] text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-semibold">Channel Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewTrackType('synth')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    newTrackType === 'synth'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-[#1e2334] text-slate-300 border-[#2b3348]'
                  }`}
                >
                  Synthesizer
                </button>
                <button
                  onClick={() => setNewTrackType('audio')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    newTrackType === 'audio'
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-[#1e2334] text-slate-300 border-[#2b3348]'
                  }`}
                >
                  Audio / Sampler
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#293044]">
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMixerTrack}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow transition-colors"
              >
                Create Track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
