/**
 * FL Mobile DAW & Sampler Studio
 * Multi-track recording, MIDI sequencing, Synthesizer plugins,
 * FL Sampler with Stretch, Resample, and Auto modes, Pitch shifting, Time-stretching, and Advanced Waveform editing tools.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Track,
  AudioClip,
  MidiClip,
  ActiveScreen,
  SamplerSettings,
  SynthParams,
  Note,
  Pattern,
  AutomationClip,
  DEFAULT_TRACK_EQ,
  DEFAULT_REVERB_FX,
} from './types';
import { TransportBar } from './components/TransportBar';
import { PlaylistView } from './components/PlaylistView';
import { PianoRollView } from './components/PianoRollView';
import { SynthRackView } from './components/SynthRackView';
import { SamplerWaveformView } from './components/SamplerWaveformView';
import { MixerView } from './components/MixerView';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { ProjectModal } from './components/ProjectModal';
import { globalPlaybackEngine } from './audio/playbackEngine';
import { MicRecorder } from './audio/audioContext';
import { DEFAULT_SYNTH_PARAMS, SYNTH_PRESETS } from './audio/synthEngine';
import {
  createVocalChop,
  createDrumLoop,
  create808Kick,
} from './audio/defaultSamples';

export default function App() {
  // Screens: 'playlist' | 'pianoroll' | 'synth' | 'sampler' | 'mixer'
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('playlist');

  // Transport & Project state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [metronome, setMetronome] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Arrangement loop boundaries
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(16);

  // Selection states
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_audio_1');
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip_vocal_1');

  // Virtual keyboard / drum pad toggle
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Microphone recording instance
  const micRecorderRef = useRef<MicRecorder>(new MicRecorder());
  const recordStartBeatRef = useRef<number>(0);

  // FL Studio Mobile Patterns
  const defaultNotes: Note[] = [
    { id: 'n1', midi: 60, startTime: 0, duration: 0.5, velocity: 0.8 },
    { id: 'n2', midi: 63, startTime: 0.5, duration: 0.5, velocity: 0.8 },
    { id: 'n3', midi: 67, startTime: 1.0, duration: 0.5, velocity: 0.8 },
    { id: 'n4', midi: 70, startTime: 1.5, duration: 0.5, velocity: 0.8 },
    { id: 'n5', midi: 60, startTime: 2.0, duration: 0.5, velocity: 0.8 },
    { id: 'n6', midi: 65, startTime: 2.5, duration: 0.5, velocity: 0.8 },
    { id: 'n7', midi: 67, startTime: 3.0, duration: 0.5, velocity: 0.8 },
    { id: 'n8', midi: 72, startTime: 3.5, duration: 0.5, velocity: 0.8 },
  ];

  const [patterns, setPatterns] = useState<Pattern[]>(() => [
    {
      id: 'pat_1',
      name: 'Cyber Saw Melody',
      durationBeats: 8,
      notes: defaultNotes,
      color: '#10b981',
    },
    {
      id: 'pat_2',
      name: 'Bassline Groove',
      durationBeats: 8,
      notes: [
        { id: 'b1', midi: 36, startTime: 0, duration: 0.75, velocity: 0.9 },
        { id: 'b2', midi: 36, startTime: 1.0, duration: 0.5, velocity: 0.8 },
        { id: 'b3', midi: 39, startTime: 2.0, duration: 0.75, velocity: 0.9 },
        { id: 'b4', midi: 41, startTime: 3.0, duration: 0.5, velocity: 0.85 },
        { id: 'b5', midi: 43, startTime: 4.0, duration: 1.0, velocity: 0.9 },
        { id: 'b6', midi: 41, startTime: 5.5, duration: 0.5, velocity: 0.8 },
        { id: 'b7', midi: 39, startTime: 6.0, duration: 0.75, velocity: 0.85 },
        { id: 'b8', midi: 38, startTime: 7.0, duration: 0.5, velocity: 0.8 },
      ],
      color: '#06b6d4',
    },
    {
      id: 'pat_3',
      name: 'Synth Chords Arp',
      durationBeats: 4,
      notes: [
        { id: 'c1', midi: 60, startTime: 0, duration: 0.25, velocity: 0.85 },
        { id: 'c2', midi: 63, startTime: 0.25, duration: 0.25, velocity: 0.8 },
        { id: 'c3', midi: 67, startTime: 0.5, duration: 0.25, velocity: 0.8 },
        { id: 'c4', midi: 72, startTime: 0.75, duration: 0.25, velocity: 0.9 },
        { id: 'c5', midi: 65, startTime: 1.0, duration: 0.25, velocity: 0.85 },
        { id: 'c6', midi: 68, startTime: 1.25, duration: 0.25, velocity: 0.8 },
        { id: 'c7', midi: 72, startTime: 1.5, duration: 0.25, velocity: 0.8 },
        { id: 'c8', midi: 77, startTime: 1.75, duration: 0.25, velocity: 0.9 },
      ],
      color: '#a855f7',
    },
  ]);

  const [activePatternId, setActivePatternId] = useState<string>('pat_1');

  // FL Studio Desktop Style Automation Clips
  const [automationClips, setAutomationClips] = useState<AutomationClip[]>(() => [
    {
      id: 'auto_bpm_1',
      name: 'Tempo Accelerando',
      target: 'bpm',
      startBeat: 0,
      durationBeats: 16,
      minVal: 90,
      maxVal: 145,
      color: '#f59e0b',
      points: [
        { id: 'ap_1', beat: 0, value: 0.35, tension: 0.4 },
        { id: 'ap_2', beat: 8, value: 0.7, tension: -0.4 },
        { id: 'ap_3', beat: 16, value: 0.85, tension: 0 },
      ],
    },
    {
      id: 'auto_rev_1',
      name: 'Vocal Reverb Buildup',
      target: 'reverb_mix',
      targetTrackId: 'track_audio_1',
      startBeat: 4,
      durationBeats: 12,
      color: '#ec4899',
      points: [
        { id: 'rp_1', beat: 0, value: 0.15, tension: 0.3 },
        { id: 'rp_2', beat: 8, value: 0.65, tension: 0.6 },
        { id: 'rp_3', beat: 12, value: 0.9, tension: 0 },
      ],
    },
  ]);

  // Initialize Default Tracks (Audio vocal chop with FL sampler, Drum break, Synth Arp)
  const [tracks, setTracks] = useState<Track[]>(() => {
    const vocalBuffer = createVocalChop();
    const drumBuffer = createDrumLoop(120);

    const vocalClip: AudioClip = {
      id: 'clip_vocal_1',
      name: 'Vocal Hook "Yeah"',
      startBeat: 0,
      durationBeats: 4,
      audioBuffer: vocalBuffer,
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
      color: '#f97316',
    };

    const drumClip: AudioClip = {
      id: 'clip_drums_1',
      name: '2-Bar Break Loop',
      startBeat: 4,
      durationBeats: 8,
      audioBuffer: drumBuffer,
      bufferVersion: 1,
      samplerSettings: {
        mode: 'auto',
        pitchSemitones: 0,
        pitchCents: 0,
        timeRatio: 1.0,
        autoBeats: 8,
        reverse: false,
        normalize: false,
        gain: 0.95,
        pan: 0,
        startOffset: 0,
        endOffset: 1,
        loop: false,
      },
      color: '#06b6d4',
    };

    const synthClip: MidiClip = {
      id: 'clip_synth_1',
      name: 'Cyber Saw Melody',
      startBeat: 0,
      durationBeats: 8,
      notes: defaultNotes,
      color: '#10b981',
    };

    const track1: Track = {
      id: 'track_audio_1',
      name: 'Vocal Sampler',
      type: 'audio',
      color: '#f97316',
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: true,
      synthParams: { ...DEFAULT_SYNTH_PARAMS },
      eq: { ...DEFAULT_TRACK_EQ, low: 2, mid: -1, high: 3 },
      reverb: { ...DEFAULT_REVERB_FX, enabled: true, decay: 2.2, mix: 0.35 },
      clips: [{ type: 'audio', ...vocalClip }],
    };

    const track2: Track = {
      id: 'track_audio_2',
      name: 'Drum Break',
      type: 'audio',
      color: '#06b6d4',
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      synthParams: { ...DEFAULT_SYNTH_PARAMS },
      eq: { ...DEFAULT_TRACK_EQ, low: 4, mid: 0, high: 1.5 },
      reverb: { ...DEFAULT_REVERB_FX, enabled: true, decay: 0.8, mix: 0.18 },
      clips: [{ type: 'audio', ...drumClip }],
    };

    const track3: Track = {
      id: 'track_synth_1',
      name: 'Cyber Synth',
      type: 'synth',
      color: '#10b981',
      volume: 0.85,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      synthParams: { ...SYNTH_PRESETS['Cyber Saw Lead'] },
      eq: { ...DEFAULT_TRACK_EQ, low: -2, mid: 3, high: 4 },
      reverb: { ...DEFAULT_REVERB_FX, enabled: true, decay: 2.8, mix: 0.4 },
      clips: [{ type: 'midi', ...synthClip }],
    };

    return [track1, track2, track3];
  });

  // Reference to tracks for playback engine
  const tracksRef = useRef<Track[]>(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Synchronize automation clips to playback engine
  useEffect(() => {
    globalPlaybackEngine.setAutomationClips(automationClips);
  }, [automationClips]);

  // Setup playback engine
  useEffect(() => {
    globalPlaybackEngine.init(() => tracksRef.current);
    globalPlaybackEngine.setCallbacks(
      (beat) => setCurrentBeat(beat),
      (playing) => setIsPlaying(playing),
      (automatedBpm) => setBpm(automatedBpm)
    );
    globalPlaybackEngine.setBpm(bpm);
    globalPlaybackEngine.setLoop(loopStartBeat, loopEndBeat, true);
    globalPlaybackEngine.setMetronome(metronome);
    globalPlaybackEngine.setAutomationClips(automationClips);
  }, []);

  // Update BPM in engine
  useEffect(() => {
    globalPlaybackEngine.setBpm(bpm);
  }, [bpm]);

  // Update Loop in engine
  useEffect(() => {
    globalPlaybackEngine.setLoop(loopStartBeat, loopEndBeat, true);
  }, [loopStartBeat, loopEndBeat]);


  // Handle Play / Pause Toggle
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      globalPlaybackEngine.pause();
    } else {
      globalPlaybackEngine.play();
    }
  }, [isPlaying]);

  // Handle Stop
  const handleStop = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
    globalPlaybackEngine.stop();
  }, [isRecording]);

  // Recording handler
  const startRecording = async () => {
    try {
      recordStartBeatRef.current = currentBeat;
      await micRecorderRef.current.startRecording();
      setIsRecording(true);
      if (!isPlaying) {
        globalPlaybackEngine.play();
      }
    } catch (e) {
      alert('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const audioBuffer = await micRecorderRef.current.stopRecording();
    if (audioBuffer) {
      // Find armed track
      const armedTrack = tracks.find((t) => t.isArmed && t.type === 'audio') || tracks.find((t) => t.type === 'audio');
      if (armedTrack) {
        const secondsPerBeat = 60 / bpm;
        const durationBeats = Math.max(1, Math.round(audioBuffer.duration / secondsPerBeat));
        const newClipId = `clip_rec_${Date.now()}`;

        const newAudioClip: AudioClip = {
          id: newClipId,
          name: `Mic Rec (${audioBuffer.duration.toFixed(1)}s)`,
          startBeat: Math.floor(recordStartBeatRef.current),
          durationBeats,
          audioBuffer,
          bufferVersion: 1,
          samplerSettings: {
            mode: 'stretch',
            pitchSemitones: 0,
            pitchCents: 0,
            timeRatio: 1.0,
            autoBeats: durationBeats,
            reverse: false,
            normalize: false,
            gain: 1.0,
            pan: 0,
            startOffset: 0,
            endOffset: 1,
            loop: false,
          },
          color: armedTrack.color,
        };

        setTracks((prev) =>
          prev.map((t) =>
            t.id === armedTrack.id
              ? { ...t, clips: [...t.clips, { type: 'audio', ...newAudioClip }] }
              : t
          )
        );

        setSelectedTrackId(armedTrack.id);
        setSelectedClipId(newClipId);
      }
    }
  };

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, currentBeat, bpm, tracks]);

  // Spacebar hotkey for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay]);

  // Get currently selected track and clip
  const currentTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0] || null;

  const currentAudioClip = (() => {
    if (!currentTrack) return null;
    const clip = currentTrack.clips.find((c) => c.id === selectedClipId && c.type === 'audio') as AudioClip | undefined;
    if (clip) return clip;
    // Fallback to first audio clip on track or first audio clip overall
    const trackAudioClip = currentTrack.clips.find((c) => c.type === 'audio') as AudioClip | undefined;
    if (trackAudioClip) return trackAudioClip;
    for (const t of tracks) {
      const anyClip = t.clips.find((c) => c.type === 'audio') as AudioClip | undefined;
      if (anyClip) return anyClip;
    }
    return null;
  })();

  const currentMidiClip = (() => {
    if (!currentTrack) return null;
    const clip = currentTrack.clips.find((c) => c.id === selectedClipId && c.type === 'midi') as MidiClip | undefined;
    if (clip) return clip;
    const trackMidiClip = currentTrack.clips.find((c) => c.type === 'midi') as MidiClip | undefined;
    if (trackMidiClip) return trackMidiClip;
    for (const t of tracks) {
      const anyClip = t.clips.find((c) => c.type === 'midi') as MidiClip | undefined;
      if (anyClip) return anyClip;
    }
    return null;
  })();

  // Update Sampler Settings on current clip
  const handleUpdateSamplerSettings = (newSettings: SamplerSettings) => {
    if (!currentAudioClip) return;
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === currentAudioClip.id && c.type === 'audio'
            ? { ...c, samplerSettings: newSettings }
            : c
        ),
      }))
    );
  };

  // Update AudioBuffer on current clip
  const handleUpdateClipBuffer = (newBuffer: AudioBuffer) => {
    if (!currentAudioClip) return;
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === currentAudioClip.id && c.type === 'audio'
            ? {
                ...c,
                audioBuffer: newBuffer,
                bufferVersion: (c.bufferVersion || 1) + 1,
              }
            : c
        ),
      }))
    );
  };

  // Update MIDI Notes on current clip and active pattern
  const handleUpdateNotes = (newNotes: Note[]) => {
    if (currentMidiClip) {
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === currentMidiClip.id && c.type === 'midi'
              ? { ...c, notes: newNotes }
              : c
          ),
        }))
      );
    }
    // Synchronize to current active pattern
    setPatterns((prev) =>
      prev.map((p) => (p.id === activePatternId ? { ...p, notes: newNotes } : p))
    );
  };

  // Pattern management handlers
  const handleSelectPattern = (patId: string) => {
    setActivePatternId(patId);
    const pat = patterns.find((p) => p.id === patId);
    if (pat && currentMidiClip) {
      handleUpdateNotes(pat.notes);
    }
  };

  const handleAddPattern = (name: string, durationBeats: number) => {
    const newPatId = `pat_${Date.now()}`;
    const newPat: Pattern = {
      id: newPatId,
      name,
      durationBeats,
      notes: [],
      color: '#06b6d4',
    };
    setPatterns((prev) => [...prev, newPat]);
    setActivePatternId(newPatId);
    if (currentMidiClip) {
      handleUpdateNotes([]);
    }
  };

  const handleUpdatePattern = (updated: Pattern) => {
    setPatterns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeletePattern = (patId: string) => {
    if (patterns.length <= 1) return;
    setPatterns((prev) => prev.filter((p) => p.id !== patId));
    if (activePatternId === patId) {
      const remaining = patterns.filter((p) => p.id !== patId);
      if (remaining.length > 0) setActivePatternId(remaining[0].id);
    }
  };

  const handleInsertPatternToPlaylist = (pattern: Pattern) => {
    const synthTrack = tracks.find((t) => t.type === 'synth') || tracks[0];
    if (!synthTrack) return;

    const newClipId = `clip_pat_${Date.now()}`;
    const newClip: MidiClip = {
      id: newClipId,
      name: pattern.name,
      startBeat: Math.floor(currentBeat),
      durationBeats: pattern.durationBeats,
      notes: [...pattern.notes],
      color: pattern.color,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === synthTrack.id
          ? { ...t, clips: [...t.clips, { type: 'midi', ...newClip }] }
          : t
      )
    );
    setSelectedTrackId(synthTrack.id);
    setSelectedClipId(newClipId);
    setActiveScreen('playlist');
  };

  // Update Synth Params on current track
  const handleUpdateSynthParams = (newParams: SynthParams) => {
    if (!currentTrack) return;
    setTracks((prev) =>
      prev.map((t) => (t.id === currentTrack.id ? { ...t, synthParams: newParams } : t))
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#101117] text-slate-100 font-sans overflow-hidden">
      {/* Top Transport & Header Bar */}
      <TransportBar
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        bpm={bpm}
        setBpm={setBpm}
        isPlaying={isPlaying}
        isRecording={isRecording}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onToggleRecord={handleToggleRecord}
        currentBeat={currentBeat}
        metronome={metronome}
        setMetronome={setMetronome}
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
        showKeyboard={showKeyboard}
        setShowKeyboard={setShowKeyboard}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeScreen === 'playlist' && (
          <PlaylistView
            tracks={tracks}
            setTracks={setTracks}
            automationClips={automationClips}
            setAutomationClips={setAutomationClips}
            currentBeat={currentBeat}
            onSeek={(beat) => globalPlaybackEngine.seek(beat)}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            selectedClipId={selectedClipId}
            setSelectedClipId={setSelectedClipId}
            onEditClipInSampler={(clip) => {
              setSelectedClipId(clip.id);
              setActiveScreen('sampler');
            }}
            onEditClipInPianoRoll={(clip) => {
              setSelectedClipId(clip.id);
              setActiveScreen('pianoroll');
            }}
            isRecording={isRecording}
            loopStartBeat={loopStartBeat}
            loopEndBeat={loopEndBeat}
            onSetLoop={(start, end) => {
              setLoopStartBeat(start);
              setLoopEndBeat(end);
            }}
          />
        )}

        {activeScreen === 'pianoroll' && (
          <PianoRollView
            clip={currentMidiClip}
            onUpdateNotes={handleUpdateNotes}
            track={currentTrack}
            bpm={bpm}
            patterns={patterns}
            activePatternId={activePatternId}
            onSelectPattern={handleSelectPattern}
            onAddPattern={handleAddPattern}
            onUpdatePattern={handleUpdatePattern}
            onDeletePattern={handleDeletePattern}
            onInsertPatternToPlaylist={handleInsertPatternToPlaylist}
          />
        )}

        {activeScreen === 'synth' && (
          <SynthRackView
            track={currentTrack}
            onUpdateSynthParams={handleUpdateSynthParams}
          />
        )}

        {activeScreen === 'sampler' && (
          <SamplerWaveformView
            clip={currentAudioClip}
            onUpdateClipSettings={handleUpdateSamplerSettings}
            onUpdateClipBuffer={handleUpdateClipBuffer}
            bpm={bpm}
          />
        )}

        {activeScreen === 'mixer' && (
          <MixerView
            tracks={tracks}
            setTracks={setTracks}
            masterVolume={masterVolume}
            setMasterVolume={setMasterVolume}
          />
        )}
      </main>

      {/* Bottom Virtual Keyboard & Drum Pads */}
      {showKeyboard && (
        <VirtualKeyboard
          track={currentTrack}
          onClose={() => setShowKeyboard(false)}
        />
      )}

      {/* Project Settings & WAV Export Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        tracks={tracks}
        bpm={bpm}
        setBpm={setBpm}
      />
    </div>
  );
}
