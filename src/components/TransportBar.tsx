import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Circle,
  Volume2,
  Clock,
  Layers,
  Music,
  Sliders,
  SlidersHorizontal,
  Waves,
  Piano,
  Download,
  FolderOpen,
  Mic,
} from 'lucide-react';
import { ActiveScreen } from '../types';
import { globalPlaybackEngine } from '../audio/playbackEngine';
import { setMasterVolume, getMasterAnalyser } from '../audio/audioContext';

import { PWAInstallButton } from './PWAInstallButton';

interface TransportBarProps {
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  isRecording: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleRecord: () => void;
  currentBeat: number;
  metronome: boolean;
  setMetronome: (m: boolean) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  showKeyboard: boolean;
  setShowKeyboard: (show: boolean) => void;
  onOpenProjectModal: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  activeScreen,
  setActiveScreen,
  bpm,
  setBpm,
  isPlaying,
  isRecording,
  onTogglePlay,
  onStop,
  onToggleRecord,
  currentBeat,
  metronome,
  setMetronome,
  masterVolume,
  setMasterVolume: updateMasterVolume,
  showKeyboard,
  setShowKeyboard,
  onOpenProjectModal,
}) => {
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [vuLeft, setVuLeft] = useState(0);
  const [vuRight, setVuRight] = useState(0);

  // Animate VU peak meter
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      try {
        const analyser = getMasterAnalyser();
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);

        let maxVal = 0;
        for (let i = 0; i < data.length; i++) {
          const val = Math.abs(data[i] - 128) / 128;
          if (val > maxVal) maxVal = val;
        }

        setVuLeft((prev) => Math.max(maxVal, prev * 0.88));
        setVuRight((prev) => Math.max(maxVal * 0.95, prev * 0.88));
      } catch {
        // ignore
      }
      animId = requestAnimationFrame(updateMeter);
    };

    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Format beat to Bar:Beat:Step
  const bar = Math.floor(currentBeat / 4) + 1;
  const beat = (Math.floor(currentBeat) % 4) + 1;
  const step = Math.floor((currentBeat % 1) * 4) + 1;
  const timeFormatted = `${String(bar).padStart(3, '0')}:${beat}.${step}`;

  // Tap tempo handler
  const handleTapTempo = () => {
    const now = performance.now();
    const recent = tapTimes.filter((t) => now - t < 3000);
    const updated = [...recent, now].slice(-4);
    setTapTimes(updated);

    if (updated.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < updated.length; i++) {
        diffs.push(updated[i] - updated[i - 1]);
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const calculatedBpm = Math.round(60000 / avgDiff);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
        globalPlaybackEngine.setBpm(calculatedBpm);
      }
    }
  };

  const navTabs: Array<{ id: ActiveScreen; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'playlist', label: 'Playlist', icon: Layers },
    { id: 'pianoroll', label: 'Piano Roll', icon: Music },
    { id: 'synth', label: 'Synth & FX', icon: Sliders },
    { id: 'sampler', label: 'Sampler / Wave', icon: Waves },
    { id: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
  ];

  return (
    <header className="h-14 bg-[#181a20] border-b border-[#2a2d36] flex items-center justify-between px-2 sm:px-4 shrink-0 select-none z-30">
      {/* Left: Branding & Project */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenProjectModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#242731] hover:bg-[#2e323e] border border-[#373b49] text-xs font-semibold text-orange-400 transition-all shadow-sm active:scale-95"
          title="Project Settings & Export"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="font-bold tracking-wider text-slate-100 hidden sm:inline">FL STUDIO</span>
          <span className="text-[10px] text-orange-400 font-mono font-bold bg-orange-950/60 px-1 py-0.5 rounded border border-orange-700/50">
            MOBILE
          </span>
        </button>

        {/* Transport Buttons: Play, Pause, Stop, Record */}
        <div className="flex items-center bg-[#121316] rounded-lg p-0.5 border border-[#2c303c] shadow-inner">
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-md transition-all ${
              isPlaying
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-[#252834]'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={onStop}
            className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-[#252834] transition-colors"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={onToggleRecord}
            className={`p-2 rounded-md transition-all ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/40'
                : 'text-slate-300 hover:text-red-400 hover:bg-[#252834]'
            }`}
            title="Record Microphone / Audio Track"
          >
            <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Time / Bar Display */}
        <div className="flex items-center px-2.5 py-1 rounded-md bg-[#101114] border border-[#252833] font-mono text-emerald-400 text-xs sm:text-sm font-bold tracking-widest shadow-inner">
          <Clock className="w-3 h-3 text-emerald-500 mr-1.5 opacity-75 hidden sm:inline" />
          {timeFormatted}
        </div>

        {/* BPM & Metronome */}
        <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-lg border border-[#2c303c]">
          <div className="flex items-center">
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setBpm(val);
                  globalPlaybackEngine.setBpm(val);
                }
              }}
              className="w-12 bg-transparent text-center text-xs font-mono font-bold text-amber-300 focus:outline-none focus:bg-[#222530] rounded py-0.5"
            />
            <span className="text-[10px] text-slate-400 mr-1 font-semibold">BPM</span>
          </div>

          <button
            onClick={handleTapTempo}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#20232c] text-slate-300 hover:text-amber-300 hover:bg-[#2a2e3a] font-mono active:scale-95"
            title="Tap Tempo"
          >
            TAP
          </button>

          <button
            onClick={() => {
              const next = !metronome;
              setMetronome(next);
              globalPlaybackEngine.setMetronome(next);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
              metronome
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Metronome Click"
          >
            METRO
          </button>
        </div>
      </div>

      {/* Center / Navigation Tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveScreen(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#222530]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Master Volume, Stereo Peak Meter, Virtual Keyboard toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Stereo Peak VU Meter */}
        <div className="flex items-center gap-0.5 bg-[#101114] p-1 rounded border border-[#252833] h-7 w-8" title="Master Peak Meter">
          <div className="flex-1 h-full bg-[#181a20] rounded-xs overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                vuLeft > 0.9 ? 'bg-red-500' : vuLeft > 0.7 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, Math.round(vuLeft * 100))}%` }}
            />
          </div>
          <div className="flex-1 h-full bg-[#181a20] rounded-xs overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                vuRight > 0.9 ? 'bg-red-500' : vuRight > 0.7 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, Math.round(vuRight * 100))}%` }}
            />
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="hidden lg:flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
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
            className="w-16 accent-orange-500 h-1.5 bg-[#252833] rounded-lg cursor-pointer"
            title={`Master Vol: ${Math.round(masterVolume * 100)}%`}
          />
        </div>

        {/* Toggle On-screen Keyboard / Drum Pads */}
        <button
          onClick={() => setShowKeyboard(!showKeyboard)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            showKeyboard
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-sm'
              : 'bg-[#222530] text-slate-300 border-[#323644] hover:bg-[#2b2f3d]'
          }`}
          title="Toggle Mobile Touch Piano & Drum Pads"
        >
          <Piano className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">Touch Keys</span>
        </button>

        {/* PWA / Android APK Installation Button */}
        <PWAInstallButton />
      </div>
    </header>
  );
};
