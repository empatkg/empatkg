import React, { useState, useRef } from 'react';
import {
  Plus,
  Mic,
  Volume2,
  VolumeX,
  Headphones,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Layers,
  Music,
  Waves,
  TrendingUp,
  Zap,
  Sliders,
  Settings,
} from 'lucide-react';
import {
  Track,
  TrackClip,
  AudioClip,
  MidiClip,
  TrackType,
  AutomationClip,
  AutomationPoint,
  AutomationTarget,
  DEFAULT_TRACK_EQ,
  DEFAULT_REVERB_FX,
} from '../types';
import { DEFAULT_SYNTH_PARAMS } from '../audio/synthEngine';
import { createVocalChop, create808Kick } from '../audio/defaultSamples';
import { AutomationEditorModal } from './AutomationEditorModal';

interface PlaylistViewProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  automationClips: AutomationClip[];
  setAutomationClips: React.Dispatch<React.SetStateAction<AutomationClip[]>>;
  currentBeat: number;
  onSeek: (beat: number) => void;
  selectedTrackId: string;
  setSelectedTrackId: (id: string) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  onEditClipInSampler: (clip: AudioClip) => void;
  onEditClipInPianoRoll: (clip: MidiClip) => void;
  isRecording: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  onSetLoop: (start: number, end: number) => void;
}

// Render mini tension curve inside automation clip lane
const MiniAutomationCurve: React.FC<{ clip: AutomationClip; width: number; height: number }> = ({
  clip,
  width,
  height,
}) => {
  if (!clip.points || clip.points.length === 0) return null;
  const sorted = [...clip.points].sort((a, b) => a.beat - b.beat);
  const dur = Math.max(1, clip.durationBeats);

  const bToX = (b: number) => (Math.max(0, Math.min(dur, b)) / dur) * width;
  const vToY = (v: number) => (1 - Math.max(0, Math.min(1, v))) * (height - 8) + 4;

  let pathD = `M ${bToX(sorted[0].beat)},${vToY(sorted[0].value)}`;
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const x1 = bToX(p1.beat);
    const y1 = vToY(p1.value);
    const x2 = bToX(p2.beat);
    const y2 = vToY(p2.value);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + (p1.tension || 0) * (y2 - y1) * 0.6;
    pathD += ` Q ${cx},${cy} ${x2},${y2}`;
  }

  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} className="w-full h-full pointer-events-none">
      <path d={fillD} fill={`${clip.color}22`} />
      <path d={pathD} fill="none" stroke={clip.color} strokeWidth="1.5" strokeLinecap="round" />
      {sorted.map((p) => (
        <circle
          key={p.id}
          cx={bToX(p.beat)}
          cy={vToY(p.value)}
          r="2.5"
          fill="#ffffff"
          stroke={clip.color}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
};

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  tracks,
  setTracks,
  automationClips,
  setAutomationClips,
  currentBeat,
  onSeek,
  selectedTrackId,
  setSelectedTrackId,
  selectedClipId,
  setSelectedClipId,
  onEditClipInSampler,
  onEditClipInPianoRoll,
  isRecording,
  loopStartBeat,
  loopEndBeat,
  onSetLoop,
}) => {
  const [zoomLevel, setZoomLevel] = useState(48); // pixels per beat
  const [snapBeats, setSnapBeats] = useState(1); // 1 beat snap
  const [activeEditingAutoClipId, setActiveEditingAutoClipId] = useState<string | null>(null);
  const [showAutoTargetDropdown, setShowAutoTargetDropdown] = useState(false);
  const [isAddTrackMenuOpen, setIsAddTrackMenuOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const totalBeats = 32;

  // Selected clip finder
  const selectedClip = (() => {
    if (!selectedClipId) return null;
    for (const t of tracks) {
      const c = t.clips.find((clip) => clip.id === selectedClipId);
      if (c) return { clip: c, track: t };
    }
    return null;
  })();

  // Handle Copy / Duplicate selected clip
  const handleCopySelectedClip = () => {
    if (!selectedClip) return;
    const { clip, track } = selectedClip;
    const newId = `clip_${Date.now()}`;
    const newClip: TrackClip = {
      ...clip,
      id: newId,
      startBeat: clip.startBeat + clip.durationBeats,
      name: `${clip.name} (Copy)`,
    } as TrackClip;

    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t))
    );
    setSelectedClipId(newId);
  };

  // Handle Delete selected clip
  const handleDeleteSelectedClip = () => {
    if (!selectedClip) return;
    const { clip, track } = selectedClip;
    setTracks((prev) =>
      prev.map((t) =>
        t.id === track.id ? { ...t, clips: t.clips.filter((c) => c.id !== clip.id) } : t
      )
    );
    setSelectedClipId(null);
  };

  // Handle Edit selected clip in Sampler or Piano Roll
  const handleEditSelectedClip = () => {
    if (!selectedClip) return;
    const { clip } = selectedClip;
    if (clip.type === 'audio') {
      onEditClipInSampler(clip);
    } else if (clip.type === 'midi') {
      onEditClipInPianoRoll(clip);
    }
  };

  // Add a new Audio or Synth track
  const handleAddTrack = (type: TrackType) => {
    const newTrackId = `track_${Date.now()}`;
    const trackColors = ['#f97316', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#eab308'];
    const color = trackColors[tracks.length % trackColors.length];

    const newTrack: Track = {
      id: newTrackId,
      name: type === 'audio' ? `Audio Track ${tracks.length + 1}` : `Synth Track ${tracks.length + 1}`,
      type,
      color,
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: type === 'audio',
      synthParams: { ...DEFAULT_SYNTH_PARAMS },
      eq: { ...DEFAULT_TRACK_EQ },
      reverb: { ...DEFAULT_REVERB_FX },
      clips: [],
    };

    if (type === 'audio') {
      const defaultClip: AudioClip = {
        id: `clip_${Date.now()}`,
        name: 'Vocal Hook',
        startBeat: 0,
        durationBeats: 4,
        audioBuffer: createVocalChop(),
        bufferVersion: 1,
        samplerSettings: {
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
        },
        color,
      };
      newTrack.clips.push({ type: 'audio', ...defaultClip });
    }

    setTracks([...tracks, newTrack]);
    setSelectedTrackId(newTrackId);
  };

  // Add a new Automation Clip (FL Studio style)
  const handleAddAutomationClip = (target: AutomationTarget) => {
    setShowAutoTargetDropdown(false);
    const targetColors: Record<AutomationTarget, string> = {
      bpm: '#f59e0b',
      track_volume: '#10b981',
      track_pan: '#06b6d4',
      synth_cutoff: '#8b5cf6',
      reverb_mix: '#ec4899',
    };

    const targetNames: Record<AutomationTarget, string> = {
      bpm: 'Tempo BPM Automation',
      track_volume: 'Volume Envelope',
      track_pan: 'Stereo Pan Curve',
      synth_cutoff: 'Cutoff Sweep',
      reverb_mix: 'Reverb Wet Mix',
    };

    const newAutoClip: AutomationClip = {
      id: `auto_${Date.now()}`,
      name: targetNames[target],
      target,
      targetTrackId: target !== 'bpm' && tracks.length > 0 ? tracks[0].id : undefined,
      startBeat: 0,
      durationBeats: 16,
      minVal: target === 'bpm' ? 80 : 0,
      maxVal: target === 'bpm' ? 160 : 1,
      color: targetColors[target],
      points: [
        { id: 'p1', beat: 0, value: target === 'bpm' ? 0.35 : 0.8, tension: 0.4 },
        { id: 'p2', beat: 8, value: target === 'bpm' ? 0.75 : 0.2, tension: -0.5 },
        { id: 'p3', beat: 16, value: target === 'bpm' ? 0.6 : 0.9, tension: 0 },
      ],
    };

    setAutomationClips((prev) => [...prev, newAutoClip]);
    setActiveEditingAutoClipId(newAutoClip.id);
  };

  const handleDeleteAutoClip = (clipId: string) => {
    setAutomationClips((prev) => prev.filter((c) => c.id !== clipId));
  };

  const handleUpdateAutoClip = (updated: AutomationClip) => {
    setAutomationClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Track property helpers
  const toggleMute = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const toggleSolo = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)));
  };

  const toggleArm = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isArmed: !t.isArmed } : { ...t, isArmed: false }))
    );
  };

  const updateTrackVolume = (trackId: string, vol: number) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, volume: vol } : t)));
  };

  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  // Timeline click for playhead positioning
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const clickedBeat = Math.max(0, clickX / zoomLevel);
    const snapped = Math.round(clickedBeat / snapBeats) * snapBeats;
    onSeek(snapped);
  };

  // Duplicate Clip
  const handleDuplicateClip = (trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const target = t.clips.find((c) => c.id === clipId);
        if (!target) return t;

        const newClip: TrackClip = {
          ...target,
          id: `clip_${Date.now()}`,
          startBeat: target.startBeat + target.durationBeats,
        };
        return {
          ...t,
          clips: [...t.clips, newClip],
        };
      })
    );
  };

  // Delete Clip
  const handleDeleteClip = (trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        };
      })
    );
  };

  const activeEditingAutoClip = automationClips.find((c) => c.id === activeEditingAutoClipId);

  return (
    <div className="flex-1 flex flex-col bg-[#12141c] overflow-hidden select-none text-slate-200">
      {/* Top Playlist Toolbar */}
      <div className="h-11 bg-[#181a24] border-b border-[#252a3a] px-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Add Audio Track */}
          <button
            onClick={() => handleAddTrack('audio')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-600/90 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Audio Track</span>
          </button>

          {/* Add Synth Track */}
          <button
            onClick={() => handleAddTrack('synth')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Synth Track</span>
          </button>

          {/* Add Automation Clip Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAutoTargetDropdown(!showAutoTargetDropdown)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+ Auto Clip</span>
            </button>

            {showAutoTargetDropdown && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1a1e2b] border border-[#2c344a] rounded-xl shadow-2xl py-1.5 z-50 flex flex-col text-xs font-medium">
                <button
                  onClick={() => handleAddAutomationClip('bpm')}
                  className="px-3 py-1.5 text-left hover:bg-[#252c3f] flex items-center gap-2 text-amber-400 font-bold"
                >
                  <Zap className="w-3.5 h-3.5" /> Tempo / BPM Automation
                </button>
                <button
                  onClick={() => handleAddAutomationClip('track_volume')}
                  className="px-3 py-1.5 text-left hover:bg-[#252c3f] flex items-center gap-2 text-emerald-400"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Track Volume Envelope
                </button>
                <button
                  onClick={() => handleAddAutomationClip('track_pan')}
                  className="px-3 py-1.5 text-left hover:bg-[#252c3f] flex items-center gap-2 text-cyan-400"
                >
                  <Sliders className="w-3.5 h-3.5" /> Track Stereo Pan
                </button>
                <button
                  onClick={() => handleAddAutomationClip('synth_cutoff')}
                  className="px-3 py-1.5 text-left hover:bg-[#252c3f] flex items-center gap-2 text-purple-400"
                >
                  <Sliders className="w-3.5 h-3.5" /> Synth Filter Cutoff
                </button>
                <button
                  onClick={() => handleAddAutomationClip('reverb_mix')}
                  className="px-3 py-1.5 text-left hover:bg-[#252c3f] flex items-center gap-2 text-pink-400"
                >
                  <Waves className="w-3.5 h-3.5" /> Reverb FX Mix
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Snap & Zoom Controls */}
        <div className="flex items-center gap-3">
          {/* Snap Selector */}
          <div className="flex items-center gap-1 bg-[#12141c] px-2 py-1 rounded-lg border border-[#272c3d] text-xs">
            <span className="text-[10px] text-slate-400 font-mono">SNAP:</span>
            <select
              value={snapBeats}
              onChange={(e) => setSnapBeats(parseFloat(e.target.value))}
              className="bg-transparent text-orange-400 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value={0.25} className="bg-[#1a1d26]">1/4 Beat</option>
              <option value={0.5} className="bg-[#1a1d26]">1/2 Beat</option>
              <option value={1} className="bg-[#1a1d26]">1 Beat</option>
              <option value={4} className="bg-[#1a1d26]">1 Bar</option>
            </select>
          </div>

          {/* Zoom In / Out */}
          <div className="flex items-center gap-1 bg-[#12141c] p-0.5 rounded-lg border border-[#272c3d]">
            <button
              onClick={() => setZoomLevel((z) => Math.max(28, z - 8))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-1">{zoomLevel}px</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(96, z + 8))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Playlist Grid Layout: Left Track Headers, Right Timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers Column */}
        <div className="w-52 sm:w-60 bg-[#161822] border-r border-[#272b3a] flex flex-col shrink-0 overflow-y-auto">
          {/* Top ruler spacer */}
          <div className="h-7 bg-[#1c1f2c] border-b border-[#292e3e] px-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>TRACKS ({tracks.length})</span>
            <span>M / S / REC</span>
          </div>

          {/* Audio & Synth Track Headers */}
          {tracks.map((track) => {
            const isSelected = selectedTrackId === track.id;
            return (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`h-24 px-2.5 py-2 border-b border-[#252938] flex flex-col justify-between cursor-pointer transition-colors relative ${
                  isSelected ? 'bg-[#222634]' : 'hover:bg-[#1c1f2b]'
                }`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: track.color }}
                />

                <div className="flex items-center justify-between pl-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {track.type === 'audio' ? (
                      <Waves className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    ) : (
                      <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {track.name}
                    </span>
                  </div>

                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrack(track.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5 rounded opacity-60 hover:opacity-100"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-1 pl-1">
                  <span className="text-[10px] text-slate-400 font-mono w-5">VOL</span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={track.volume}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateTrackVolume(track.id, parseFloat(e.target.value))}
                    className="flex-1 accent-orange-500 h-1 bg-[#2b3040] rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>

                {/* Mute, Solo & Record Arm Buttons */}
                <div className="flex items-center justify-between pl-1 gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute(track.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                        track.isMuted
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-[#282d3d] text-slate-400 hover:text-white'
                      }`}
                    >
                      M
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSolo(track.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                        track.isSolo
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-[#282d3d] text-slate-400 hover:text-white'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  {track.type === 'audio' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArm(track.id);
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                        track.isArmed
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-[#282d3d] text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>REC</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Automation Clips Headers Section */}
          {automationClips.length > 0 && (
            <>
              <div className="h-6 bg-[#181b28] border-b border-[#282f42] px-2 flex items-center justify-between text-[9px] font-bold font-mono text-amber-400 uppercase tracking-wider">
                <span>AUTOMATION LANES ({automationClips.length})</span>
                <span>CURVE</span>
              </div>

              {automationClips.map((autoClip) => (
                <div
                  key={autoClip.id}
                  onClick={() => setActiveEditingAutoClipId(autoClip.id)}
                  className="h-16 px-2.5 py-1.5 border-b border-[#22283a] flex flex-col justify-between cursor-pointer hover:bg-[#1f2434] transition-colors relative"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: autoClip.color }}
                  />

                  <div className="flex items-center justify-between pl-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <TrendingUp
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: autoClip.color }}
                      />
                      <span className="text-xs font-bold text-slate-100 truncate">
                        {autoClip.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAutoClip(autoClip.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                      title="Delete Automation Clip"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pl-1 text-[10px] font-mono text-slate-400">
                    <span className="text-amber-400">{autoClip.target.toUpperCase()}</span>
                    <span>{autoClip.points.length} pts</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Right Scrollable Timeline Grid */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#0f1118]"
        >
          {/* Top Measure Numbers Ruler */}
          <div
            className="h-7 bg-[#1c1f2c] border-b border-[#292e3e] flex items-center sticky top-0 z-20"
            style={{ width: `${totalBeats * zoomLevel}px` }}
          >
            {Array.from({ length: totalBeats }).map((_, beatIdx) => (
              <div
                key={beatIdx}
                style={{ width: `${zoomLevel}px` }}
                className={`h-full border-r border-[#272b3a] flex items-center px-1 text-[10px] font-mono font-bold ${
                  beatIdx % 4 === 0 ? 'text-orange-400 bg-[#242838]/50' : 'text-slate-500'
                }`}
              >
                {beatIdx % 4 === 0 ? `Bar ${Math.floor(beatIdx / 4) + 1}` : beatIdx + 1}
              </div>
            ))}
          </div>

          {/* Timeline Tracks Rows */}
          <div style={{ width: `${totalBeats * zoomLevel}px` }} className="relative">
            {/* Audio & Synth Tracks Lanes */}
            {tracks.map((track) => {
              const isSelected = selectedTrackId === track.id;
              return (
                <div
                  key={track.id}
                  style={{ height: '96px' }}
                  className={`w-full border-b border-[#222636] relative flex ${
                    isSelected ? 'bg-[#151824]' : 'bg-[#10121a]'
                  }`}
                >
                  {/* Vertical grid lines (beats) */}
                  {Array.from({ length: totalBeats }).map((_, beatIdx) => (
                    <div
                      key={beatIdx}
                      style={{ width: `${zoomLevel}px` }}
                      className={`h-full border-r ${
                        beatIdx % 4 === 0 ? 'border-[#282d3e]' : 'border-[#1b1e2a]'
                      }`}
                    />
                  ))}

                  {/* Render Audio & MIDI Clips */}
                  {track.clips.map((clip) => {
                    const clipLeft = clip.startBeat * zoomLevel;
                    const clipWidth = clip.durationBeats * zoomLevel;
                    const isClipSelected = selectedClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          setSelectedTrackId(track.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (clip.type === 'audio') onEditClipInSampler(clip as AudioClip);
                          else onEditClipInPianoRoll(clip as MidiClip);
                        }}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`,
                          backgroundColor: `${clip.color}22`,
                          borderColor: clip.color,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 flex flex-col justify-between p-1.5 cursor-pointer shadow-md transition-all overflow-hidden ${
                          isClipSelected
                            ? 'ring-2 ring-white ring-offset-1 ring-offset-[#101117] shadow-lg'
                            : 'hover:border-white/80'
                        }`}
                      >
                        {/* Clip Header */}
                        <div className="flex items-center justify-between text-[10px] font-bold text-white drop-shadow">
                          <span className="truncate flex items-center gap-1">
                            {clip.type === 'audio' ? (
                              <Waves className="w-3 h-3 text-orange-400" />
                            ) : (
                              <Music className="w-3 h-3 text-cyan-400" />
                            )}
                            {clip.name}
                          </span>

                          {clip.type === 'audio' && (
                            <span className="text-[9px] font-mono font-bold bg-black/60 px-1 py-0.5 rounded text-orange-300 border border-orange-500/40 uppercase">
                              {(clip as AudioClip).samplerSettings.mode}
                            </span>
                          )}

                          <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateClip(track.id, clip.id);
                              }}
                              className="p-0.5 text-slate-300 hover:text-white rounded bg-black/40"
                              title="Duplicate"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClip(track.id, clip.id);
                              }}
                              className="p-0.5 text-rose-300 hover:text-rose-100 rounded bg-black/40"
                              title="Delete"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Clip Content Visual Preview */}
                        <div className="flex-1 flex items-center justify-center my-0.5">
                          {clip.type === 'audio' ? (
                            <div className="w-full h-8 flex items-center justify-center gap-0.5 opacity-70">
                              {Array.from({ length: Math.min(24, Math.floor(clipWidth / 4)) }).map(
                                (_, idx) => {
                                  const h = 20 + 70 * Math.abs(Math.sin(idx * 0.7));
                                  return (
                                    <div
                                      key={idx}
                                      className="flex-1 bg-sky-400 rounded-xs"
                                      style={{ height: `${h}%` }}
                                    />
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-8 flex flex-col justify-around opacity-60">
                              <div className="h-1 w-3/4 bg-cyan-400 rounded-full" />
                              <div className="h-1 w-1/2 bg-cyan-400 rounded-full ml-4" />
                              <div className="h-1 w-2/3 bg-cyan-400 rounded-full ml-2" />
                            </div>
                          )}
                        </div>

                        {/* Clip Footer */}
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-300 drop-shadow">
                          <span>{clip.durationBeats}b</span>
                          {clip.type === 'audio' &&
                            (clip as AudioClip).samplerSettings.pitchSemitones !== 0 && (
                              <span className="text-orange-300">
                                {(clip as AudioClip).samplerSettings.pitchSemitones > 0 ? '+' : ''}
                                {(clip as AudioClip).samplerSettings.pitchSemitones}st
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Automation Lanes */}
            {automationClips.map((autoClip) => {
              const clipLeft = autoClip.startBeat * zoomLevel;
              const clipWidth = autoClip.durationBeats * zoomLevel;

              return (
                <div
                  key={autoClip.id}
                  style={{ height: '64px' }}
                  className="w-full border-b border-[#24293a] bg-[#0e1017] relative flex"
                >
                  {/* Vertical grid lines */}
                  {Array.from({ length: totalBeats }).map((_, beatIdx) => (
                    <div
                      key={beatIdx}
                      style={{ width: `${zoomLevel}px` }}
                      className={`h-full border-r ${
                        beatIdx % 4 === 0 ? 'border-[#24293a]' : 'border-[#171a25]'
                      }`}
                    />
                  ))}

                  {/* Render Automation Clip Block */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveEditingAutoClipId(autoClip.id);
                    }}
                    style={{
                      left: `${clipLeft}px`,
                      width: `${clipWidth}px`,
                      borderColor: autoClip.color,
                    }}
                    className="absolute top-1 bottom-1 rounded-lg border-2 bg-[#141724]/90 p-1 flex flex-col justify-between cursor-pointer shadow-md hover:border-white transition-all overflow-hidden"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-white px-1 z-10">
                      <span className="flex items-center gap-1 font-mono">
                        <TrendingUp className="w-3 h-3" style={{ color: autoClip.color }} />
                        {autoClip.name}
                      </span>
                      <span
                        className="text-[9px] px-1 py-0.2 rounded font-mono"
                        style={{ backgroundColor: `${autoClip.color}33`, color: autoClip.color }}
                      >
                        {autoClip.target.toUpperCase()}
                      </span>
                    </div>

                    {/* Mini Curve Graph Visualizer */}
                    <div className="absolute inset-0 pt-4 pb-1 px-1">
                      <MiniAutomationCurve
                        clip={autoClip}
                        width={clipWidth - 8}
                        height={50}
                      />
                    </div>

                    <div className="text-[9px] font-mono text-slate-400 px-1 z-10">
                      Double-click to edit breakpoints &amp; tension
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Playhead Marker */}
            <div
              style={{ left: `${currentBeat * zoomLevel}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-orange-400 pointer-events-none z-30 shadow-[0_0_8px_rgba(249,115,22,0.8)]"
            >
              <div className="w-3 h-3 bg-orange-500 rounded-full -ml-1.5 -mt-1.5 shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Selected Clip Action Bar (matches video Frame 00:15) */}
      {selectedClip && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#161820]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2e3346] shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="text-xs font-bold text-white font-mono max-w-[120px] truncate mr-1">
            {selectedClip.clip.name}
          </span>
          <button
            onClick={handleCopySelectedClip}
            className="px-3 py-1 rounded-full bg-white hover:bg-slate-200 text-black text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
            title="Duplicate Clip"
          >
            <Copy className="w-3 h-3" />
            <span>Copy</span>
          </button>
          <button
            onClick={handleDeleteSelectedClip}
            className="px-3 py-1 rounded-full bg-[#2a2e3e] hover:bg-red-600 hover:text-white text-slate-300 text-xs font-bold transition-all flex items-center gap-1 border border-[#3b4157] active:scale-95"
            title="Delete Clip"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete</span>
          </button>
          <button
            onClick={() => {
              const nextSnap = snapBeats === 1 ? 0.5 : snapBeats === 0.5 ? 0.25 : 1;
              setSnapBeats(nextSnap);
            }}
            className="px-3 py-1 rounded-full bg-[#2a2e3e] hover:bg-[#353a4e] text-slate-300 text-xs font-bold font-mono transition-all border border-[#3b4157]"
            title="Toggle Snap Grid"
          >
            Snap {snapBeats}x
          </button>
          <button
            onClick={handleEditSelectedClip}
            className="px-3.5 py-1 rounded-full bg-orange-500 hover:bg-orange-400 text-black text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1"
            title="Open Editor"
          >
            <Sliders className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      )}

      {/* Floating Center-Bottom Circular + Add Button (matches video frames 00:00-00:35) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
        {/* Add Track Popover Menu */}
        {isAddTrackMenuOpen && (
          <div className="mb-3 bg-[#181a24] rounded-2xl border border-[#2e3346] shadow-2xl p-2 w-56 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider border-b border-[#242838]">
              Add Track Channel
            </div>
            <button
              onClick={() => {
                handleAddTrack('audio');
                setIsAddTrackMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#25293a] text-xs font-bold text-white transition-colors flex items-center gap-2"
            >
              <Waves className="w-4 h-4 text-emerald-400" />
              <span>Audio Track</span>
            </button>
            <button
              onClick={() => {
                handleAddTrack('synth');
                setIsAddTrackMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#25293a] text-xs font-bold text-white transition-colors flex items-center gap-2"
            >
              <Music className="w-4 h-4 text-orange-400" />
              <span>Synth / Instrument</span>
            </button>
            <button
              onClick={() => {
                handleAddTrack('synth');
                setIsAddTrackMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#25293a] text-xs font-bold text-white transition-colors flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Drum Sequencer</span>
            </button>
            <button
              onClick={() => {
                setShowAutoTargetDropdown(true);
                setIsAddTrackMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#25293a] text-xs font-bold text-white transition-colors flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Automation Track</span>
            </button>
          </div>
        )}

        {/* The Circular Floating Add Button */}
        <button
          onClick={() => setIsAddTrackMenuOpen(!isAddTrackMenuOpen)}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90 border border-[#40465c] ${
            isAddTrackMenuOpen
              ? 'bg-orange-500 text-black rotate-45 shadow-orange-500/40'
              : 'bg-[#202330] hover:bg-[#2b3042] text-white hover:text-orange-400'
          }`}
          title="Add Track or Automation"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Right Edge Collapsible Panel Toggle Button (matches video right edge) */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30 hidden sm:flex">
        <button
          onClick={() => {
            const nextSnap = snapBeats === 1 ? 0.5 : 1;
            setSnapBeats(nextSnap);
          }}
          className="w-6 h-12 bg-[#1b1e2a]/80 hover:bg-[#262a3c] rounded-l-lg border-l border-y border-[#31364b] flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-md"
          title="Toggle Grid / Side Panel"
        >
          <span className="text-[10px] font-mono font-bold">&lt;</span>
        </button>
      </div>

      {/* Automation Clip Breakpoint & Tension Editor Modal */}
      {activeEditingAutoClip && (
        <AutomationEditorModal
          clip={activeEditingAutoClip}
          isOpen={!!activeEditingAutoClip}
          onClose={() => setActiveEditingAutoClipId(null)}
          onUpdateClip={handleUpdateAutoClip}
          tracks={tracks}
        />
      )}
    </div>
  );
};
