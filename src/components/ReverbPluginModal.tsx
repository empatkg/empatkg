import React, { useEffect, useRef } from 'react';
import { Waves, X, Power, Sparkles, Volume2, Maximize2 } from 'lucide-react';
import { ReverbFx, Track } from '../types';

interface ReverbPluginModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onUpdateReverb: (trackId: string, reverb: ReverbFx) => void;
}

const REVERB_PRESETS: { name: string; params: ReverbFx }[] = [
  {
    name: 'Vocal Plate',
    params: { enabled: true, decay: 2.2, damping: 9000, preDelay: 0.025, mix: 0.35, width: 0.85 },
  },
  {
    name: 'Studio Drum Room',
    params: { enabled: true, decay: 0.8, damping: 6500, preDelay: 0.005, mix: 0.22, width: 0.7 },
  },
  {
    name: 'Cathedral Hall',
    params: { enabled: true, decay: 4.2, damping: 4500, preDelay: 0.045, mix: 0.48, width: 0.95 },
  },
  {
    name: 'Ambient Shimmer Space',
    params: { enabled: true, decay: 5.6, damping: 13000, preDelay: 0.07, mix: 0.65, width: 1.0 },
  },
  {
    name: 'Tight Gated Ambience',
    params: { enabled: true, decay: 0.45, damping: 7500, preDelay: 0.002, mix: 0.3, width: 0.6 },
  },
];

export const ReverbPluginModal: React.FC<ReverbPluginModalProps> = ({
  track,
  isOpen,
  onClose,
  onUpdateReverb,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reverb = track.reverb || {
    enabled: true,
    decay: 1.8,
    damping: 8000,
    preDelay: 0.02,
    mix: 0.35,
    width: 0.8,
  };

  const update = (patch: Partial<ReverbFx>) => {
    onUpdateReverb(track.id, { ...reverb, ...patch });
  };

  // Acoustic Space Simulation Canvas
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.03;
      ctx.fillStyle = '#0f1118';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw virtual room bounds based on decay
      const roomScale = Math.min(1.0, 0.3 + (reverb.decay / 6.0) * 0.65);
      const rw = (canvas.width - 40) * roomScale;
      const rh = (canvas.height - 30) * roomScale;

      ctx.strokeStyle = reverb.enabled ? '#22d3ee44' : '#47556933';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);

      // Draw reverberation reflection waves
      if (reverb.enabled) {
        const rings = Math.floor(reverb.decay * 3) + 2;
        for (let i = 0; i < rings; i++) {
          const progress = (time * (0.8 + i * 0.1) + i / rings) % 1;
          const r = progress * (rw / 2);
          const alpha = Math.max(0, (1 - progress) * reverb.mix * 0.8);

          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          // High damping shifts color from bright cyan to warm amber
          const isWarm = reverb.damping < 6000;
          ctx.strokeStyle = isWarm
            ? `rgba(249, 115, 22, ${alpha})`
            : `rgba(6, 182, 212, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Center sound source emitter
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, reverb]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="bg-[#141722] border border-[#2d3448] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col text-slate-200">
        {/* Plugin Title Bar */}
        <div className="bg-[#1c2130] px-4 py-3 border-b border-[#2b3346] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Waves className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide">
                  FL REVERB 2 PLUGIN
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#272f44] text-slate-300 font-mono">
                  {track.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Algorithmic stereo convolution &amp; room acoustic modeling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Bypass Toggle */}
            <button
              onClick={() => update({ enabled: !reverb.enabled })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                reverb.enabled
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                  : 'bg-[#252c3f] text-slate-400 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{reverb.enabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#283147] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Acoustic Room Visualizer */}
        <div className="px-5 pt-4">
          <div className="relative rounded-xl overflow-hidden border border-[#283044] shadow-inner bg-[#0f1118]">
            <canvas ref={canvasRef} width={450} height={100} className="w-full h-24 block" />
            <div className="absolute top-2 left-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span>ROOM: {reverb.decay < 1.0 ? 'SMALL' : reverb.decay < 3.0 ? 'MEDIUM' : 'LARGE'}</span>
              <span>•</span>
              <span>DAMP: {Math.round(reverb.damping)} Hz</span>
            </div>
            <div className="absolute bottom-2 right-2 text-[10px] font-mono text-cyan-400 font-bold">
              WET: {Math.round(reverb.mix * 100)}%
            </div>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] text-slate-400 font-mono shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-400" /> Presets:
            </span>
            {REVERB_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onUpdateReverb(track.id, { ...p.params })}
                className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2c354d] text-[11px] font-medium text-slate-300 hover:text-white whitespace-nowrap border border-[#2b3348] transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Parametric Controls Grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Decay / Room Size */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Decay Time</span>
              <span className="font-mono text-cyan-400 font-bold">{reverb.decay.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={6.0}
              step={0.05}
              value={reverb.decay}
              onChange={(e) => update({ decay: parseFloat(e.target.value) })}
              className="accent-cyan-400 cursor-pointer h-1.5 bg-[#2a3248] rounded"
            />
            <span className="text-[9px] text-slate-500 font-mono">0.2s tight to 6.0s cavern</span>
          </div>

          {/* Damping / High Cut */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">High Damping</span>
              <span className="font-mono text-orange-400 font-bold">{Math.round(reverb.damping)}Hz</span>
            </div>
            <input
              type="range"
              min={1000}
              max={18000}
              step={200}
              value={reverb.damping}
              onChange={(e) => update({ damping: parseFloat(e.target.value) })}
              className="accent-orange-400 cursor-pointer h-1.5 bg-[#2a3248] rounded"
            />
            <span className="text-[9px] text-slate-500 font-mono">Warm dark to bright</span>
          </div>

          {/* Pre-Delay */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Pre-Delay</span>
              <span className="font-mono text-emerald-400 font-bold">{Math.round(reverb.preDelay * 1000)}ms</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.002}
              value={reverb.preDelay}
              onChange={(e) => update({ preDelay: parseFloat(e.target.value) })}
              className="accent-emerald-400 cursor-pointer h-1.5 bg-[#2a3248] rounded"
            />
            <span className="text-[9px] text-slate-500 font-mono">Separates direct sound</span>
          </div>

          {/* Wet / Dry Mix */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Wet Mix</span>
              <span className="font-mono text-purple-400 font-bold">{Math.round(reverb.mix * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={reverb.mix}
              onChange={(e) => update({ mix: parseFloat(e.target.value) })}
              className="accent-purple-400 cursor-pointer h-1.5 bg-[#2a3248] rounded"
            />
            <span className="text-[9px] text-slate-500 font-mono">Reverberation wet level</span>
          </div>

          {/* Stereo Width */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Stereo Width</span>
              <span className="font-mono text-sky-400 font-bold">{Math.round(reverb.width * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={reverb.width}
              onChange={(e) => update({ width: parseFloat(e.target.value) })}
              className="accent-sky-400 cursor-pointer h-1.5 bg-[#2a3248] rounded"
            />
            <span className="text-[9px] text-slate-500 font-mono">Stereo spread across field</span>
          </div>

          {/* Reset button */}
          <div className="bg-[#191d2a] p-3 rounded-xl border border-[#283044] flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-300">Quick Action</span>
            <button
              onClick={() =>
                update({
                  decay: 1.8,
                  damping: 8000,
                  preDelay: 0.02,
                  mix: 0.35,
                  width: 0.8,
                  enabled: true,
                })
              }
              className="w-full py-1.5 bg-[#242b3d] hover:bg-[#303a52] text-xs font-bold rounded-lg text-slate-200 transition-colors"
            >
              Reset Default
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#181b26] px-5 py-3 border-t border-[#262c3d] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95"
          >
            Apply &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
