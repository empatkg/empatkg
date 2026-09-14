import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Music,
  Play,
  Square,
  Trash2,
  Sparkles,
  Scissors,
  Check,
  RotateCcw,
  Sliders,
  Plus,
  Copy,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Send,
  Grid,
} from 'lucide-react';
import { MidiClip, Note, Track, Pattern } from '../types';
import { globalSynthEngine } from '../audio/synthEngine';

interface PianoRollViewProps {
  clip: MidiClip | null;
  onUpdateNotes: (notes: Note[]) => void;
  track: Track | null;
  bpm: number;
  patterns: Pattern[];
  activePatternId: string;
  onSelectPattern: (patternId: string) => void;
  onAddPattern: (name: string, durationBeats: number) => void;
  onUpdatePattern: (pattern: Pattern) => void;
  onDeletePattern: (patternId: string) => void;
  onInsertPatternToPlaylist: (pattern: Pattern) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Octaves from C2 (MIDI 36) to B5 (MIDI 83)
const LOW_MIDI = 36;
const HIGH_MIDI = 76; // 40 notes

const SCALES: Record<string, number[]> = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const PianoRollView: React.FC<PianoRollViewProps> = ({
  clip,
  onUpdateNotes,
  track,
  bpm,
  patterns,
  activePatternId,
  onSelectPattern,
  onAddPattern,
  onUpdatePattern,
  onDeletePattern,
  onInsertPatternToPlaylist,
}) => {
  const [activeScale, setActiveScale] = useState<string>('Natural Minor');
  const [scaleRoot, setScaleRoot] = useState<number>(0);
  const [snapStep, setSnapStep] = useState<number>(0.25); // 16th note snap
  const [selectedTool, setSelectedTool] = useState<'draw' | 'erase'>('draw');
  const [isAuditionPlaying, setIsAuditionPlaying] = useState(false);
  const [auditionBeat, setAuditionBeat] = useState(0);

  // Pattern edit modal
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternNameInput, setPatternNameInput] = useState('');
  const [patternBeatsInput, setPatternBeatsInput] = useState(8);

  const activePattern = patterns.find((p) => p.id === activePatternId) || patterns[0];
  const notes = clip ? clip.notes : activePattern?.notes || [];
  const totalBeats = clip ? clip.durationBeats : activePattern?.durationBeats || 8;
  const pixelsPerBeat = 64;
  const noteHeight = 20;

  // Key sound preview
  const handleKeyAudition = (midiNote: number) => {
    if (track) {
      globalSynthEngine.triggerNote(midiNote, 0.8, track.synthParams, undefined, 0.4);
    }
  };

  // Pattern Audition Loop Engine
  useEffect(() => {
    if (!isAuditionPlaying) {
      setAuditionBeat(0);
      return;
    }

    const secPerBeat = 60 / bpm;
    const intervalMs = 25; // 25ms timer resolution
    let currentB = 0;
    const startTime = performance.now();

    // Map of scheduled note indices for current loop
    const scheduledNotes = new Set<string>();

    const interval = setInterval(() => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      currentB = (elapsedSec / secPerBeat) % totalBeats;
      setAuditionBeat(currentB);

      // Check which notes fall within current slice
      notes.forEach((note) => {
        const loopKey = `${Math.floor(elapsedSec / (secPerBeat * totalBeats))}_${note.id}`;
        if (
          !scheduledNotes.has(loopKey) &&
          currentB >= note.startTime &&
          currentB < note.startTime + 0.25
        ) {
          scheduledNotes.add(loopKey);
          if (track) {
            globalSynthEngine.triggerNote(
              note.midi,
              note.velocity,
              track.synthParams,
              undefined,
              note.duration * secPerBeat
            );
          }
        }
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isAuditionPlaying, bpm, totalBeats, notes, track]);

  // Update notes helper (updates clip or active pattern)
  const setNotes = (newNotes: Note[]) => {
    if (clip) {
      onUpdateNotes(newNotes);
    } else if (activePattern) {
      onUpdatePattern({ ...activePattern, notes: newNotes });
    }
  };

  // Grid click to add or remove note
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, midiNote: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawBeat = clickX / pixelsPerBeat;
    const snappedBeat = Math.floor(rawBeat / snapStep) * snapStep;

    if (snappedBeat >= totalBeats) return;

    // Check if note exists at this pitch and beat
    const existingNoteIndex = notes.findIndex(
      (n) => n.midi === midiNote && Math.abs(n.startTime - snappedBeat) < 0.2
    );

    if (existingNoteIndex !== -1) {
      const updated = [...notes];
      updated.splice(existingNoteIndex, 1);
      setNotes(updated);
    } else if (selectedTool === 'draw') {
      const newNote: Note = {
        id: `note_${Date.now()}_${Math.random()}`,
        midi: midiNote,
        startTime: snappedBeat,
        duration: Math.max(snapStep, 0.5),
        velocity: 0.85,
      };
      setNotes([...notes, newNote]);
      handleKeyAudition(midiNote);
    }
  };

  const handleClearAll = () => {
    setNotes([]);
  };

  const handleQuantize = () => {
    const quantized = notes.map((n) => ({
      ...n,
      startTime: Math.round(n.startTime / snapStep) * snapStep,
      duration: Math.max(snapStep, Math.round(n.duration / snapStep) * snapStep),
    }));
    setNotes(quantized);
  };

  // Transpose notes
  const handleTranspose = (semitones: number) => {
    const transposed = notes.map((n) => ({
      ...n,
      midi: Math.max(LOW_MIDI, Math.min(HIGH_MIDI, n.midi + semitones)),
    }));
    setNotes(transposed);
  };

  // Check if midiNote is in active scale
  const isPitchInScale = (midi: number) => {
    const semitone = (midi - scaleRoot) % 12;
    const normalized = (semitone + 12) % 12;
    return SCALES[activeScale]?.includes(normalized) ?? true;
  };

  const handleCreatePattern = () => {
    const name = patternNameInput.trim() || `Pattern ${patterns.length + 1}`;
    onAddPattern(name, patternBeatsInput);
    setShowPatternModal(false);
    setPatternNameInput('');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#14161d] overflow-hidden select-none text-slate-200">
      {/* Pattern Bar (FL Studio Mobile Style) */}
      <div className="bg-[#12141c] border-b border-[#252a3a] px-3 py-2 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Grid className="w-3.5 h-3.5" /> PATTERN:
          </span>

          {/* Pattern Pills Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-md pb-0.5">
            {patterns.map((pat) => {
              const isSelected = pat.id === activePattern?.id;
              return (
                <button
                  key={pat.id}
                  onClick={() => onSelectPattern(pat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 shrink-0 border ${
                    isSelected
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950/50'
                      : 'bg-[#1a1d28] text-slate-300 hover:text-white border-[#2b3246]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: pat.color || '#06b6d4' }}
                  />
                  <span>{pat.name}</span>
                  <span className="text-[10px] opacity-70">({pat.durationBeats / 4}b)</span>
                </button>
              );
            })}
          </div>

          {/* New Pattern Button */}
          <button
            onClick={() => setShowPatternModal(true)}
            className="p-1 rounded-lg bg-[#202534] hover:bg-[#2c344a] text-cyan-400 border border-[#30384e] transition-colors shrink-0"
            title="Create New Pattern"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Pattern Actions (Audition Loop, Transpose, Insert into Playlist) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Loop Audition Button */}
          <button
            onClick={() => setIsAuditionPlaying(!isAuditionPlaying)}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all border ${
              isAuditionPlaying
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_#10b981]'
                : 'bg-[#1e2332] text-emerald-400 hover:text-white border-[#2b3348]'
            }`}
            title="Play / Loop Pattern"
          >
            {isAuditionPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isAuditionPlaying ? 'STOP LOOP' : 'PLAY LOOP'}</span>
          </button>

          {/* Transpose +/- 1 / 12 */}
          <div className="flex items-center bg-[#171a24] p-0.5 rounded-lg border border-[#2b3348]">
            <button
              onClick={() => handleTranspose(-1)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:text-white"
              title="Transpose -1 Semitone"
            >
              -1
            </button>
            <button
              onClick={() => handleTranspose(1)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:text-white"
              title="Transpose +1 Semitone"
            >
              +1
            </button>
            <button
              onClick={() => handleTranspose(-12)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-cyan-400"
              title="Octave Down (-12)"
            >
              -12
            </button>
            <button
              onClick={() => handleTranspose(12)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-cyan-400"
              title="Octave Up (+12)"
            >
              +12
            </button>
          </div>

          {/* Send/Insert Pattern to Playlist */}
          {activePattern && (
            <button
              onClick={() => onInsertPatternToPlaylist(activePattern)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow transition-colors"
              title="Place this pattern as a MIDI clip onto the track in Playlist"
            >
              <Send className="w-3 h-3" />
              <span className="hidden sm:inline">To Playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Toolbar: Draw/Erase, Scale, Snap, Quantize, Clear */}
      <div className="h-10 bg-[#1a1d26] border-b border-[#282d3b] px-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Tool Selector */}
          <div className="flex items-center bg-[#12141c] p-0.5 rounded-lg border border-[#282d3c]">
            <button
              onClick={() => setSelectedTool('draw')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                selectedTool === 'draw'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Draw
            </button>
            <button
              onClick={() => setSelectedTool('erase')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                selectedTool === 'erase'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Erase
            </button>
          </div>

          {/* Snap */}
          <div className="flex items-center gap-1 bg-[#12141c] px-2 py-0.5 rounded-lg border border-[#282d3c] text-xs">
            <span className="text-[10px] text-slate-400 font-mono">SNAP:</span>
            <select
              value={snapStep}
              onChange={(e) => setSnapStep(parseFloat(e.target.value))}
              className="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value={0.125} className="bg-[#1a1d26]">1/32</option>
              <option value={0.25} className="bg-[#1a1d26]">1/16</option>
              <option value={0.5} className="bg-[#1a1d26]">1/8</option>
              <option value={1} className="bg-[#1a1d26]">1/4</option>
            </select>
          </div>

          {/* Scale Highlight */}
          <div className="hidden md:flex items-center gap-1 bg-[#12141c] px-2 py-0.5 rounded-lg border border-[#282d3c] text-xs">
            <span className="text-[10px] text-slate-400 font-mono">SCALE:</span>
            <select
              value={activeScale}
              onChange={(e) => setActiveScale(e.target.value)}
              className="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              {Object.keys(SCALES).map((s) => (
                <option key={s} value={s} className="bg-[#1a1d26] text-white">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantize & Clear */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuantize}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#242836] hover:bg-[#2e3346] text-xs font-semibold text-amber-400 border border-[#373e54] active:scale-95"
            title="Quantize notes to grid"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Quantize</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#242836] hover:bg-[#2e3346] text-xs font-semibold text-slate-300 hover:text-rose-400 border border-[#373e54] active:scale-95"
            title="Clear all notes"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Piano Roll Main Area: Left Keys + Right Note Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Piano Keyboard Keys Column */}
        <div className="w-16 sm:w-20 bg-[#161822] border-r border-[#262b3a] flex flex-col shrink-0 overflow-y-hidden">
          {Array.from({ length: HIGH_MIDI - LOW_MIDI + 1 }).map((_, idx) => {
            const midi = HIGH_MIDI - idx;
            const noteIndex = midi % 12;
            const octave = Math.floor(midi / 12) - 1;
            const noteName = NOTE_NAMES[noteIndex];
            const isBlack = noteName.includes('#');
            const inScale = isPitchInScale(midi);

            return (
              <button
                key={midi}
                onClick={() => handleKeyAudition(midi)}
                style={{ height: `${noteHeight}px` }}
                className={`w-full flex items-center justify-between px-1.5 text-[10px] font-mono border-b border-[#202534] transition-colors ${
                  isBlack
                    ? 'bg-[#1b1e2a] text-slate-400 hover:bg-[#272c3d]'
                    : 'bg-[#282e40] text-slate-200 hover:bg-[#343c53]'
                } ${inScale ? 'border-r-2 border-r-cyan-400' : ''}`}
              >
                <span className="font-bold">
                  {noteName}
                  {octave}
                </span>
                <span className="text-[8px] text-slate-500">{midi}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scrollable Sequencer Grid */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#0f1118]">
          {/* Audition Playhead Bar Indicator */}
          {isAuditionPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-30 shadow-[0_0_8px_#34d399] pointer-events-none"
              style={{ left: `${auditionBeat * pixelsPerBeat}px` }}
            />
          )}

          {/* Measure Beat Numbers Ruler */}
          <div
            className="h-6 bg-[#161822] border-b border-[#252a3a] flex items-center sticky top-0 z-20"
            style={{ width: `${totalBeats * pixelsPerBeat}px` }}
          >
            {Array.from({ length: totalBeats }).map((_, beatIdx) => (
              <div
                key={beatIdx}
                style={{ width: `${pixelsPerBeat}px` }}
                className={`h-full border-r border-[#262b3a] flex items-center px-1 text-[9px] font-mono ${
                  beatIdx % 4 === 0 ? 'text-cyan-400 font-bold bg-[#1e2230]/40' : 'text-slate-500'
                }`}
              >
                {beatIdx % 4 === 0 ? `Bar ${Math.floor(beatIdx / 4) + 1}` : beatIdx + 1}
              </div>
            ))}
          </div>

          {/* Grid Rows for Each Midi Pitch */}
          <div style={{ width: `${totalBeats * pixelsPerBeat}px` }}>
            {Array.from({ length: HIGH_MIDI - LOW_MIDI + 1 }).map((_, idx) => {
              const midi = HIGH_MIDI - idx;
              const noteIndex = midi % 12;
              const noteName = NOTE_NAMES[noteIndex];
              const isBlack = noteName.includes('#');
              const inScale = isPitchInScale(midi);

              return (
                <div
                  key={midi}
                  onClick={(e) => handleGridClick(e, midi)}
                  style={{ height: `${noteHeight}px` }}
                  className={`w-full border-b border-[#1b1f2c] relative flex cursor-crosshair ${
                    isBlack ? 'bg-[#12141e]' : 'bg-[#161924]'
                  } ${inScale ? 'bg-opacity-95' : 'opacity-70'}`}
                >
                  {/* Vertical grid lines (beats) */}
                  {Array.from({ length: totalBeats }).map((_, beatIdx) => (
                    <div
                      key={beatIdx}
                      style={{ width: `${pixelsPerBeat}px` }}
                      className={`h-full border-r ${
                        beatIdx % 4 === 0 ? 'border-[#2d3448]' : 'border-[#1e2332]'
                      }`}
                    />
                  ))}

                  {/* Render Notes Placed on this Pitch */}
                  {notes
                    .filter((n) => n.midi === midi)
                    .map((note) => {
                      const left = note.startTime * pixelsPerBeat;
                      const width = Math.max(12, note.duration * pixelsPerBeat - 2);

                      return (
                        <div
                          key={note.id}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            height: `${noteHeight - 2}px`,
                          }}
                          className="absolute top-0.5 rounded-sm bg-gradient-to-r from-cyan-500 to-teal-400 border border-cyan-300 shadow-sm z-10 flex items-center px-1 text-[8px] font-bold text-slate-900 pointer-events-none"
                        >
                          {noteName}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add New Pattern Modal */}
      {showPatternModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
          <div className="bg-[#161824] rounded-2xl border border-[#2b3348] shadow-2xl max-w-sm w-full p-5 flex flex-col gap-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-[#293044] pb-2">
              <span className="font-bold text-sm text-white">Create New Pattern</span>
              <button
                onClick={() => setShowPatternModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-semibold">Pattern Name</label>
              <input
                type="text"
                placeholder={`Pattern ${patterns.length + 1}`}
                value={patternNameInput}
                onChange={(e) => setPatternNameInput(e.target.value)}
                className="w-full bg-[#10121a] px-3 py-2 rounded-xl border border-[#283044] text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-semibold">Length in Bars</label>
              <div className="grid grid-cols-4 gap-2">
                {[4, 8, 16, 32].map((beats) => (
                  <button
                    key={beats}
                    onClick={() => setPatternBeatsInput(beats)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      patternBeatsInput === beats
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-[#1e2334] text-slate-300 border-[#2b3348]'
                    }`}
                  >
                    {beats / 4} Bar{beats > 4 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#293044]">
              <button
                onClick={() => setShowPatternModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePattern}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors"
              >
                Create Pattern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
