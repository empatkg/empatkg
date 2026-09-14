import React, { useState } from 'react';
import { Piano, Drum, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Track } from '../types';
import { globalSynthEngine } from '../audio/synthEngine';
import {
  create808Kick,
  createSnare,
  createHiHat,
  createVocalChop,
  createPluckLead,
} from '../audio/defaultSamples';
import { getAudioContext, getMasterGain } from '../audio/audioContext';

interface VirtualKeyboardProps {
  track: Track | null;
  onClose: () => void;
}

const PIANO_KEYS = [
  { note: 0, name: 'C', isBlack: false },
  { note: 1, name: 'C#', isBlack: true },
  { note: 2, name: 'D', isBlack: false },
  { note: 3, name: 'D#', isBlack: true },
  { note: 4, name: 'E', isBlack: false },
  { note: 5, name: 'F', isBlack: false },
  { note: 6, name: 'F#', isBlack: true },
  { note: 7, name: 'G', isBlack: false },
  { note: 8, name: 'G#', isBlack: true },
  { note: 9, name: 'A', isBlack: false },
  { note: 10, name: 'A#', isBlack: true },
  { note: 11, name: 'B', isBlack: false },
  { note: 12, name: 'C', isBlack: false },
  { note: 13, name: 'C#', isBlack: true },
  { note: 14, name: 'D', isBlack: false },
  { note: 15, name: 'D#', isBlack: true },
  { note: 16, name: 'E', isBlack: false },
  { note: 17, name: 'F', isBlack: false },
  { note: 18, name: 'F#', isBlack: true },
  { note: 19, name: 'G', isBlack: false },
  { note: 20, name: 'G#', isBlack: true },
  { note: 21, name: 'A', isBlack: false },
  { note: 22, name: 'A#', isBlack: true },
  { note: 23, name: 'B', isBlack: false },
  { note: 24, name: 'C', isBlack: false },
];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  track,
  onClose,
}) => {
  const [mode, setMode] = useState<'keys' | 'pads'>('keys');
  const [octave, setOctave] = useState<number>(4); // Base C4 (MIDI 60)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());

  // Trigger drum sample
  const triggerDrumSound = (type: 'kick' | 'snare' | 'hat' | 'vocal' | 'pluck') => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      let buffer: AudioBuffer;
      switch (type) {
        case 'kick':
          buffer = create808Kick();
          break;
        case 'snare':
          buffer = createSnare();
          break;
        case 'hat':
          buffer = createHiHat();
          break;
        case 'vocal':
          buffer = createVocalChop();
          break;
        case 'pluck':
          buffer = createPluckLead();
          break;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(getMasterGain());
      src.start();
    } catch (e) {
      console.error('Error playing drum pad sound:', e);
    }
  };

  const handleKeyDown = (keyOffset: number) => {
    const midi = (octave + 1) * 12 + keyOffset;
    setActiveNotes((prev) => new Set(prev).add(midi));
    if (track) {
      globalSynthEngine.triggerNote(midi, 0.85, track.synthParams);
    }
  };

  const handleKeyUp = (keyOffset: number) => {
    const midi = (octave + 1) * 12 + keyOffset;
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    globalSynthEngine.stopNote(midi);
  };

  const drumPads = [
    { label: '808 KICK', type: 'kick', color: 'border-orange-500 bg-orange-950/40 text-orange-400' },
    { label: 'TRAP SNARE', type: 'snare', color: 'border-cyan-500 bg-cyan-950/40 text-cyan-400' },
    { label: 'HI-HAT', type: 'hat', color: 'border-amber-500 bg-amber-950/40 text-amber-400' },
    { label: 'VOCAL CHOP', type: 'vocal', color: 'border-purple-500 bg-purple-950/40 text-purple-400' },
    { label: 'PLUCK BELL', type: 'pluck', color: 'border-emerald-500 bg-emerald-950/40 text-emerald-400' },
    { label: 'SUB 808', type: 'kick', color: 'border-rose-500 bg-rose-950/40 text-rose-400' },
    { label: 'CRISP HAT', type: 'hat', color: 'border-sky-500 bg-sky-950/40 text-sky-400' },
    { label: 'VOX HOOK', type: 'vocal', color: 'border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-400' },
  ] as const;

  return (
    <div className="h-44 bg-[#161822] border-t-2 border-[#2b3040] shadow-2xl flex flex-col shrink-0 z-40 select-none">
      {/* Top Controls Bar */}
      <div className="h-8 bg-[#1a1d28] border-b border-[#252a3a] px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#101117] p-0.5 rounded border border-[#272c3d]">
            <button
              onClick={() => setMode('keys')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                mode === 'keys' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Piano className="w-3 h-3" />
              <span>Keys</span>
            </button>
            <button
              onClick={() => setMode('pads')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                mode === 'pads' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Drum className="w-3 h-3" />
              <span>Drum Pads</span>
            </button>
          </div>

          {/* Octave Controls (for Keys mode) */}
          {mode === 'keys' && (
            <div className="flex items-center gap-1 bg-[#101117] px-2 py-0.5 rounded border border-[#272c3d] text-xs">
              <span className="text-[10px] text-slate-400 font-mono">OCT:</span>
              <button
                onClick={() => setOctave((o) => Math.max(1, o - 1))}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <span className="font-mono font-bold text-orange-400 text-xs px-1">C{octave}</span>
              <button
                onClick={() => setOctave((o) => Math.min(7, o + 1))}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#252a3a]"
          title="Close Keyboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Playing Surface */}
      <div className="flex-1 flex overflow-x-auto p-1.5 bg-[#12131b]">
        {mode === 'keys' ? (
          /* Piano Keyboard View */
          <div className="flex-1 flex h-full relative justify-center">
            {PIANO_KEYS.map((k) => {
              const midi = (octave + 1) * 12 + k.note;
              const isPressed = activeNotes.has(midi);

              if (k.isBlack) {
                return (
                  <button
                    key={k.note}
                    onMouseDown={() => handleKeyDown(k.note)}
                    onMouseUp={() => handleKeyUp(k.note)}
                    onMouseLeave={() => activeNotes.has(midi) && handleKeyUp(k.note)}
                    onTouchStart={() => handleKeyDown(k.note)}
                    onTouchEnd={() => handleKeyUp(k.note)}
                    style={{
                      width: '32px',
                      height: '62%',
                      marginLeft: '-16px',
                      marginRight: '-16px',
                      zIndex: 10,
                    }}
                    className={`rounded-b-md border border-[#1b1f2b] transition-all cursor-pointer select-none ${
                      isPressed
                        ? 'bg-orange-500 shadow-lg shadow-orange-500/50'
                        : 'bg-[#181a24] hover:bg-[#262a3a]'
                    }`}
                  >
                    <span className="text-[8px] font-mono text-slate-400 block pt-1">{k.name}</span>
                  </button>
                );
              }

              return (
                <button
                  key={k.note}
                  onMouseDown={() => handleKeyDown(k.note)}
                  onMouseUp={() => handleKeyUp(k.note)}
                  onMouseLeave={() => activeNotes.has(midi) && handleKeyUp(k.note)}
                  onTouchStart={() => handleKeyDown(k.note)}
                  onTouchEnd={() => handleKeyUp(k.note)}
                  style={{ width: '48px', height: '100%' }}
                  className={`border border-[#282d3e] rounded-b-lg flex flex-col justify-end pb-1.5 items-center transition-all cursor-pointer select-none ${
                    isPressed
                      ? 'bg-orange-400 text-black shadow-inner'
                      : 'bg-[#f1f3f7] text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="text-[10px] font-bold font-mono">{k.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          /* 8 Drum Pads Grid */
          <div className="flex-1 grid grid-cols-4 sm:grid-cols-8 gap-2 p-1">
            {drumPads.map((pad, idx) => (
              <button
                key={idx}
                onClick={() => triggerDrumSound(pad.type)}
                className={`rounded-xl border-2 flex flex-col items-center justify-center p-2 font-bold font-mono text-xs transition-all active:scale-95 shadow-md ${pad.color} hover:brightness-125`}
              >
                <span>{pad.label}</span>
                <span className="text-[9px] opacity-60 mt-1">PAD {idx + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
