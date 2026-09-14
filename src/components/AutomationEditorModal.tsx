import React, { useState, useRef } from 'react';
import {
  TrendingUp,
  X,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Volume2,
  Sliders,
  Waves,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { AutomationClip, AutomationPoint, AutomationTarget, Track } from '../types';

interface AutomationEditorModalProps {
  clip: AutomationClip | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClip: (clip: AutomationClip) => void;
  tracks: Track[];
}

export const AutomationEditorModal: React.FC<AutomationEditorModalProps> = ({
  clip,
  isOpen,
  onClose,
  onUpdateClip,
  tracks,
}) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingTensionIdx, setDraggingTensionIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!isOpen || !clip) return null;

  const width = 600;
  const height = 240;
  const paddingX = 30;
  const paddingY = 25;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const sortedPoints = [...clip.points].sort((a, b) => a.beat - b.beat);
  const duration = Math.max(1, clip.durationBeats);

  // Map beat [0, duration] to SVG X
  const beatToX = (b: number) => paddingX + (Math.max(0, Math.min(duration, b)) / duration) * innerW;
  // Map value [0, 1] to SVG Y (0 at bottom, 1 at top)
  const valToY = (v: number) => paddingY + (1 - Math.max(0, Math.min(1, v))) * innerH;

  const xToBeat = (x: number) => {
    const norm = Math.max(0, Math.min(1, (x - paddingX) / innerW));
    return Math.round(norm * duration * 4) / 4; // snap to 1/4 beat
  };

  const yToVal = (y: number) => {
    const norm = 1 - (y - paddingY) / innerH;
    return Math.max(0, Math.min(1, Math.round(norm * 100) / 100));
  };

  // Build SVG Path string using tension bezier approximation
  const buildCurvePath = () => {
    if (sortedPoints.length === 0) return '';
    if (sortedPoints.length === 1) {
      const y = valToY(sortedPoints[0].value);
      return `M ${paddingX},${y} L ${paddingX + innerW},${y}`;
    }

    let d = `M ${beatToX(sortedPoints[0].beat)},${valToY(sortedPoints[0].value)}`;

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      const x1 = beatToX(p1.beat);
      const y1 = valToY(p1.value);
      const x2 = beatToX(p2.beat);
      const y2 = valToY(p2.value);

      const tension = p1.tension || 0;
      // Control point offset based on tension
      const cx = (x1 + x2) / 2;
      const linearY = (y1 + y2) / 2;
      const cy = linearY + tension * (y2 - y1) * 0.65;

      d += ` Q ${cx},${cy} ${x2},${y2}`;
    }

    return d;
  };

  const curvePath = buildCurvePath();
  const areaPath = sortedPoints.length > 0
    ? `${curvePath} L ${paddingX + innerW},${paddingY + innerH} L ${paddingX},${paddingY + innerH} Z`
    : '';

  // Add a new breakpoint on SVG click
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPointId || draggingTensionIdx !== null) return;
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const beat = xToBeat(clickX);
    const value = yToVal(clickY);

    // Don't add if already exists nearby
    const existing = clip.points.find((p) => Math.abs(p.beat - beat) < 0.3);
    if (existing) {
      setSelectedPointId(existing.id);
      return;
    }

    const newPoint: AutomationPoint = {
      id: `pt_${Date.now()}`,
      beat,
      value,
      tension: 0,
    };

    onUpdateClip({
      ...clip,
      points: [...clip.points, newPoint],
    });
    setSelectedPointId(newPoint.id);
  };

  // Dragging handlers for points
  const handlePointPointerDown = (e: React.PointerEvent, ptId: string) => {
    e.stopPropagation();
    setDraggingPointId(ptId);
    setSelectedPointId(ptId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (draggingPointId) {
      const beat = xToBeat(curX);
      const value = yToVal(curY);

      onUpdateClip({
        ...clip,
        points: clip.points.map((p) => (p.id === draggingPointId ? { ...p, beat, value } : p)),
      });
    } else if (draggingTensionIdx !== null && sortedPoints[draggingTensionIdx]) {
      // Adjust tension: delta Y moves tension between -1 and 1
      const p1 = sortedPoints[draggingTensionIdx];
      const p2 = sortedPoints[draggingTensionIdx + 1];
      if (!p2) return;

      const linearY = (valToY(p1.value) + valToY(p2.value)) / 2;
      const dy = curY - linearY;
      const rawTension = Math.max(-1, Math.min(1, dy / 40));

      onUpdateClip({
        ...clip,
        points: clip.points.map((p) => (p.id === p1.id ? { ...p, tension: -rawTension } : p)),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingPointId(null);
    setDraggingTensionIdx(null);
  };

  // Delete selected point
  const handleDeletePoint = (ptId: string) => {
    if (clip.points.length <= 2) return; // keep at least 2 endpoints
    onUpdateClip({
      ...clip,
      points: clip.points.filter((p) => p.id !== ptId),
    });
    setSelectedPointId(null);
  };

  // Presets
  const applyPreset = (presetType: string) => {
    let newPoints: AutomationPoint[] = [];

    if (presetType === 'linear_rise') {
      newPoints = [
        { id: 'p1', beat: 0, value: 0.1, tension: 0 },
        { id: 'p2', beat: clip.durationBeats, value: 0.95, tension: 0 },
      ];
    } else if (presetType === 'half_time_drop') {
      newPoints = [
        { id: 'p1', beat: 0, value: 0.85, tension: 0 },
        { id: 'p2', beat: clip.durationBeats * 0.45, value: 0.85, tension: 0 },
        { id: 'p3', beat: clip.durationBeats * 0.5, value: 0.25, tension: 0 },
        { id: 'p4', beat: clip.durationBeats, value: 0.25, tension: 0 },
      ];
    } else if (presetType === 's_curve') {
      newPoints = [
        { id: 'p1', beat: 0, value: 0.1, tension: 0.7 },
        { id: 'p2', beat: clip.durationBeats / 2, value: 0.5, tension: -0.7 },
        { id: 'p3', beat: clip.durationBeats, value: 0.9, tension: 0 },
      ];
    } else if (presetType === 'dj_filter_sweep') {
      newPoints = [
        { id: 'p1', beat: 0, value: 0.95, tension: -0.5 },
        { id: 'p2', beat: clip.durationBeats * 0.75, value: 0.2, tension: 0.6 },
        { id: 'p3', beat: clip.durationBeats, value: 1.0, tension: 0 },
      ];
    } else if (presetType === 'fade_out') {
      newPoints = [
        { id: 'p1', beat: 0, value: 0.9, tension: -0.4 },
        { id: 'p2', beat: clip.durationBeats, value: 0.0, tension: 0 },
      ];
    }

    onUpdateClip({
      ...clip,
      points: newPoints,
    });
  };

  const targetTrack = tracks.find((t) => t.id === clip.targetTrackId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="bg-[#141620] border border-[#2b3346] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="bg-[#1b1f2c] px-5 py-3 border-b border-[#293144] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg text-white border"
              style={{
                backgroundColor: `${clip.color}33`,
                borderColor: `${clip.color}66`,
                color: clip.color,
              }}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide">{clip.name}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-mono font-bold"
                  style={{ backgroundColor: `${clip.color}22`, color: clip.color }}
                >
                  TARGET: {clip.target.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                FL Studio style breakpoint automation curve with interactive tension handles
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#272e42] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clip Target & Range Settings */}
        <div className="px-5 pt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#22283a] pb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Parameter:</span>
            <select
              value={clip.target}
              onChange={(e) =>
                onUpdateClip({ ...clip, target: e.target.value as AutomationTarget })
              }
              className="bg-[#1e2332] text-white px-2.5 py-1 rounded-lg border border-[#2c354a] font-mono text-xs focus:outline-none"
            >
              <option value="bpm">⚡ Project Tempo (BPM)</option>
              <option value="track_volume">🔊 Track Volume</option>
              <option value="track_pan">↔️ Track Stereo Pan</option>
              <option value="synth_cutoff">🎛️ Synth Filter Cutoff</option>
              <option value="reverb_mix">🌊 Reverb FX Wet Mix</option>
            </select>

            {clip.target !== 'bpm' && (
              <select
                value={clip.targetTrackId || ''}
                onChange={(e) => onUpdateClip({ ...clip, targetTrackId: e.target.value })}
                className="bg-[#1e2332] text-cyan-400 px-2.5 py-1 rounded-lg border border-[#2c354a] font-mono text-xs focus:outline-none"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    Track: {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Min / Max Range Controls (For BPM) */}
          {clip.target === 'bpm' && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Min:</span>
              <input
                type="number"
                min={40}
                max={200}
                value={clip.minVal ?? 60}
                onChange={(e) => onUpdateClip({ ...clip, minVal: parseInt(e.target.value) || 60 })}
                className="w-14 bg-[#1b1f2d] px-1.5 py-0.5 rounded border border-[#2d3448] text-center text-white"
              />
              <span className="text-slate-400">Max:</span>
              <input
                type="number"
                min={80}
                max={260}
                value={clip.maxVal ?? 180}
                onChange={(e) => onUpdateClip({ ...clip, maxVal: parseInt(e.target.value) || 180 })}
                className="w-14 bg-[#1b1f2d] px-1.5 py-0.5 rounded border border-[#2d3448] text-center text-white"
              />
              <span className="text-slate-500">BPM</span>
            </div>
          )}
        </div>

        {/* Quick Curve Presets */}
        <div className="px-5 pt-2.5 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-mono flex items-center gap-1 shrink-0 mr-1 text-[10px]">
            <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
          </span>
          <button
            onClick={() => applyPreset('linear_rise')}
            className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2b334a] text-slate-300 hover:text-white border border-[#2a3246]"
          >
            Linear Rise
          </button>
          <button
            onClick={() => applyPreset('half_time_drop')}
            className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2b334a] text-slate-300 hover:text-white border border-[#2a3246]"
          >
            Half-Time Drop
          </button>
          <button
            onClick={() => applyPreset('s_curve')}
            className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2b334a] text-slate-300 hover:text-white border border-[#2a3246]"
          >
            S-Curve Ease
          </button>
          <button
            onClick={() => applyPreset('dj_filter_sweep')}
            className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2b334a] text-slate-300 hover:text-white border border-[#2a3246]"
          >
            Filter Sweep
          </button>
          <button
            onClick={() => applyPreset('fade_out')}
            className="px-2.5 py-1 rounded bg-[#1e2434] hover:bg-[#2b334a] text-slate-300 hover:text-white border border-[#2a3246]"
          >
            Fade Out
          </button>
        </div>

        {/* Interactive SVG Automation Canvas */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-full rounded-xl overflow-hidden border border-[#272f42] bg-[#0e1017] shadow-inner">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-60 cursor-crosshair"
              onClick={handleSvgClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Background Grid Lines (Horizontal values 0, 25%, 50%, 75%, 100%) */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((v) => {
                const y = valToY(v);
                return (
                  <g key={v}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={paddingX + innerW}
                      y2={y}
                      stroke={v === 0.5 ? '#262d3e' : '#191e2b'}
                      strokeWidth={v === 0.5 ? 1.5 : 1}
                      strokeDasharray={v === 0.5 ? '4,4' : 'none'}
                    />
                    <text
                      x={paddingX - 6}
                      y={y + 3}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {clip.target === 'bpm'
                        ? Math.round((clip.minVal ?? 60) + ((clip.maxVal ?? 180) - (clip.minVal ?? 60)) * v)
                        : `${Math.round(v * 100)}%`}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Beat Lines */}
              {Array.from({ length: duration + 1 }).map((_, beat) => {
                const x = beatToX(beat);
                return (
                  <g key={beat}>
                    <line
                      x1={x}
                      y1={paddingY}
                      x2={x}
                      y2={paddingY + innerH}
                      stroke={beat % 4 === 0 ? '#262d3e' : '#161a25'}
                      strokeWidth={beat % 4 === 0 ? 1.5 : 1}
                    />
                    <text
                      x={x}
                      y={paddingY + innerH + 14}
                      textAnchor="middle"
                      fill={beat % 4 === 0 ? '#38bdf8' : '#64748b'}
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {beat % 4 === 0 ? `Bar ${beat / 4 + 1}` : beat}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Shaded Area under Curve */}
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={clip.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={clip.color} stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {areaPath && <path d={areaPath} fill="url(#curveGradient)" />}

              {/* Main Tension Bezier Curve Line */}
              {curvePath && (
                <path
                  d={curvePath}
                  fill="none"
                  stroke={clip.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Tension Handles (Center circle between adjacent points) */}
              {sortedPoints.map((p, idx) => {
                if (idx >= sortedPoints.length - 1) return null;
                const nextP = sortedPoints[idx + 1];
                const x1 = beatToX(p.beat);
                const y1 = valToY(p.value);
                const x2 = beatToX(nextP.beat);
                const y2 = valToY(nextP.value);

                const tension = p.tension || 0;
                const cx = (x1 + x2) / 2;
                const linearY = (y1 + y2) / 2;
                const cy = linearY + tension * (y2 - y1) * 0.65;

                return (
                  <g key={`tension_${p.id}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="5"
                      fill="#1e2434"
                      stroke={clip.color}
                      strokeWidth="1.5"
                      className="cursor-ns-resize hover:scale-125 transition-transform"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingTensionIdx(idx);
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  </g>
                );
              })}

              {/* Breakpoints (Drag Handles) */}
              {sortedPoints.map((p) => {
                const x = beatToX(p.beat);
                const y = valToY(p.value);
                const isSelected = p.id === selectedPointId;

                return (
                  <g key={p.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? '7' : '5.5'}
                      fill={isSelected ? '#ffffff' : clip.color}
                      stroke="#0f1118"
                      strokeWidth="2"
                      className="cursor-pointer hover:scale-125 transition-transform"
                      onPointerDown={(e) => handlePointPointerDown(e, p.id)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
            <span>Click line to add point • Drag dots to adjust value • Drag tension handle to curve</span>
            {selectedPointId && clip.points.length > 2 && (
              <button
                onClick={() => handleDeletePoint(selectedPointId)}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Point
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#171a26] px-5 py-3 border-t border-[#252c3e] flex items-center justify-between">
          <div className="text-xs font-mono text-slate-400">
            {clip.points.length} Breakpoints • Tension Curvature Active
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95"
          >
            Done &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
};
