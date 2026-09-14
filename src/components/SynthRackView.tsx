import React from 'react';
import {
  Sliders,
  Radio,
  Volume2,
  Sparkles,
  Activity,
  Waves,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { SynthParams, Track } from '../types';
import { SYNTH_PRESETS, globalSynthEngine } from '../audio/synthEngine';

interface SynthRackViewProps {
  track: Track | null;
  onUpdateSynthParams: (params: SynthParams) => void;
}

export const SynthRackView: React.FC<SynthRackViewProps> = ({
  track,
  onUpdateSynthParams,
}) => {
  const params = track?.synthParams || SYNTH_PRESETS['Cyber Saw Lead'];

  const handleTestNote = (midiNote: number) => {
    globalSynthEngine.triggerNote(midiNote, 0.85, params, undefined, 0.6);
  };

  const handleLoadPreset = (presetName: string) => {
    const p = SYNTH_PRESETS[presetName];
    if (p) onUpdateSynthParams({ ...p });
  };

  const waveforms: Array<OscillatorType | 'noise'> = ['sawtooth', 'square', 'sine', 'triangle'];

  return (
    <div className="flex-1 flex flex-col bg-[#14161d] overflow-y-auto select-none text-slate-200 pb-8">
      {/* Header & Preset Selector */}
      <div className="bg-[#1a1d26] border-b border-[#282d3b] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                FL MINISYNTH PLUGIN
              </span>
              <span className="text-[11px] font-mono font-bold bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/60">
                {track?.name || 'Synthesizer'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Dual-oscillator virtual analog synth with multimode filter, envelopes &amp; FX
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">PRESETS:</span>
          {Object.keys(SYNTH_PRESETS).map((pName) => (
            <button
              key={pName}
              onClick={() => handleLoadPreset(pName)}
              className="px-2.5 py-1 rounded bg-[#242836] hover:bg-[#2f3547] text-xs font-semibold text-cyan-300 border border-[#373e54] transition-colors whitespace-nowrap active:scale-95"
            >
              {pName}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full">
        {/* ROW 1: DUAL OSCILLATORS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OSCILLATOR 1 */}
          <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262b3a] pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
                <Waves className="w-4 h-4" />
                <span>Oscillator 1</span>
              </div>
              <div className="flex items-center gap-1">
                {waveforms.map((w) => (
                  <button
                    key={w}
                    onClick={() => onUpdateSynthParams({ ...params, osc1Type: w })}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                      params.osc1Type === w
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-[#12141c] text-slate-400 hover:text-white'
                    }`}
                  >
                    {w.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Octave</span>
                  <span className="font-mono text-orange-400">{params.osc1Octave}</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  value={params.osc1Octave}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc1Octave: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-orange-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Detune</span>
                  <span className="font-mono text-orange-400">{params.osc1Detune}c</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={params.osc1Detune}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc1Detune: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-orange-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Mix</span>
                  <span className="font-mono text-orange-400">{Math.round(params.osc1Mix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={params.osc1Mix}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc1Mix: parseFloat(e.target.value) })
                  }
                  className="w-full accent-orange-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* OSCILLATOR 2 */}
          <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262b3a] pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                <Waves className="w-4 h-4" />
                <span>Oscillator 2</span>
              </div>
              <div className="flex items-center gap-1">
                {waveforms.map((w) => (
                  <button
                    key={w}
                    onClick={() => onUpdateSynthParams({ ...params, osc2Type: w })}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                      params.osc2Type === w
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-[#12141c] text-slate-400 hover:text-white'
                    }`}
                  >
                    {w.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Octave</span>
                  <span className="font-mono text-cyan-400">{params.osc2Octave}</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  value={params.osc2Octave}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc2Octave: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-cyan-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Detune</span>
                  <span className="font-mono text-cyan-400">{params.osc2Detune}c</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={params.osc2Detune}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc2Detune: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-cyan-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Mix</span>
                  <span className="font-mono text-cyan-400">{Math.round(params.osc2Mix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={params.osc2Mix}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, osc2Mix: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: FILTER & ADSR ENVELOPES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* FILTER */}
          <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262b3a] pb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Multimode Filter
              </span>
              <div className="flex items-center gap-1">
                {(['lowpass', 'highpass', 'bandpass'] as BiquadFilterType[]).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => onUpdateSynthParams({ ...params, filterType: ft })}
                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded uppercase ${
                      params.filterType === ft
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#12141c] text-slate-400'
                    }`}
                  >
                    {ft.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Cutoff Freq</span>
                  <span className="font-mono text-emerald-400">{Math.round(params.filterCutoff)} Hz</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={12000}
                  step={20}
                  value={params.filterCutoff}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, filterCutoff: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Resonance (Q)</span>
                  <span className="font-mono text-emerald-400">{params.filterResonance.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={15}
                  step={0.2}
                  value={params.filterResonance}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, filterResonance: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Env Modulation</span>
                  <span className="font-mono text-emerald-400">
                    {Math.round(params.filterEnvAmount * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={params.filterEnvAmount}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, filterEnvAmount: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* AMP ADSR ENVELOPE */}
          <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-[#262b3a] pb-2">
              Amp Envelope (ADSR)
            </span>

            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-mono mb-1">ATTACK</span>
                <input
                  type="range"
                  min={0.001}
                  max={2.0}
                  step={0.01}
                  value={params.ampAttack}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, ampAttack: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
                <span className="text-[9px] font-mono text-amber-400 mt-1">{params.ampAttack.toFixed(2)}s</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-mono mb-1">DECAY</span>
                <input
                  type="range"
                  min={0.01}
                  max={3.0}
                  step={0.02}
                  value={params.ampDecay}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, ampDecay: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
                <span className="text-[9px] font-mono text-amber-400 mt-1">{params.ampDecay.toFixed(2)}s</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-mono mb-1">SUSTAIN</span>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={params.ampSustain}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, ampSustain: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
                <span className="text-[9px] font-mono text-amber-400 mt-1">{Math.round(params.ampSustain * 100)}%</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-mono mb-1">RELEASE</span>
                <input
                  type="range"
                  min={0.02}
                  max={4.0}
                  step={0.05}
                  value={params.ampRelease}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, ampRelease: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
                <span className="text-[9px] font-mono text-amber-400 mt-1">{params.ampRelease.toFixed(2)}s</span>
              </div>
            </div>

            {/* Visual ADSR Shape Representation */}
            <div className="h-12 bg-[#101218] rounded border border-[#232733] p-1 flex items-end justify-between gap-1 mt-auto">
              <div
                className="bg-amber-500/30 border-t-2 border-amber-400 flex-1 transition-all"
                style={{ height: '90%' }}
              />
              <div
                className="bg-amber-500/20 border-t-2 border-amber-400/80 flex-1 transition-all"
                style={{ height: `${Math.max(15, params.ampSustain * 90)}%` }}
              />
              <div
                className="bg-amber-500/20 border-t-2 border-amber-400/80 flex-1 transition-all"
                style={{ height: `${Math.max(15, params.ampSustain * 90)}%` }}
              />
              <div
                className="bg-amber-500/10 border-t-2 border-amber-400/50 flex-1 transition-all"
                style={{ height: '10%' }}
              />
            </div>
          </div>

          {/* LFO MODULATION */}
          <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262b3a] pb-2">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                LFO Modulation
              </span>
              <div className="flex items-center gap-1">
                {(['none', 'pitch', 'cutoff'] as Array<'none' | 'pitch' | 'cutoff'>).map((target) => (
                  <button
                    key={target}
                    onClick={() => onUpdateSynthParams({ ...params, lfoTarget: target })}
                    className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase ${
                      params.lfoTarget === target
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#12141c] text-slate-400'
                    }`}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>LFO Rate</span>
                  <span className="font-mono text-purple-400">{params.lfoRate.toFixed(1)} Hz</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={params.lfoRate}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, lfoRate: parseFloat(e.target.value) })
                  }
                  className="w-full accent-purple-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>LFO Depth</span>
                  <span className="font-mono text-purple-400">{Math.round(params.lfoDepth * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={params.lfoDepth}
                  onChange={(e) =>
                    onUpdateSynthParams({ ...params, lfoDepth: parseFloat(e.target.value) })
                  }
                  className="w-full accent-purple-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: BUILT-IN FX RACK (Distortion, Delay, Reverb) */}
        <div className="bg-[#181a24] rounded-xl p-4 border border-[#2b3040] shadow-md flex flex-col gap-3">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider border-b border-[#262b3a] pb-2">
            Built-in FX Rack (Distortion · Stereo Delay · Lush Reverb)
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tube Distortion */}
            <div className="bg-[#12141c] p-3 rounded-lg border border-[#262b3a] flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold text-rose-400">
                <span>Tube Drive</span>
                <span className="font-mono">{Math.round(params.distortion * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={params.distortion}
                onChange={(e) =>
                  onUpdateSynthParams({ ...params, distortion: parseFloat(e.target.value) })
                }
                className="w-full accent-rose-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
              />
            </div>

            {/* Stereo Delay */}
            <div className="bg-[#12141c] p-3 rounded-lg border border-[#262b3a] flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold text-cyan-400">
                <span>Delay Wet Mix</span>
                <span className="font-mono">{Math.round(params.delayMix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={params.delayMix}
                onChange={(e) =>
                  onUpdateSynthParams({ ...params, delayMix: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Feedback: {Math.round(params.delayFeedback * 100)}%</span>
                <span>Time: {params.delayTime.toFixed(2)}s</span>
              </div>
            </div>

            {/* Reverb */}
            <div className="bg-[#12141c] p-3 rounded-lg border border-[#262b3a] flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold text-emerald-400">
                <span>Reverb Space</span>
                <span className="font-mono">{Math.round(params.reverbMix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={params.reverbMix}
                onChange={(e) =>
                  onUpdateSynthParams({ ...params, reverbMix: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 h-1.5 bg-[#252a38] rounded cursor-pointer"
              />
              <div className="text-[10px] text-slate-400">Decay: {params.reverbDecay.toFixed(1)}s</div>
            </div>
          </div>
        </div>

        {/* Quick Test Audition Bar */}
        <div className="flex items-center justify-between bg-[#12141c] p-3 rounded-xl border border-[#242836]">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Quick Audition Keys:</span>
          <div className="flex items-center gap-1.5">
            {[
              { note: 48, label: 'C3' },
              { note: 52, label: 'E3' },
              { note: 55, label: 'G3' },
              { note: 60, label: 'C4' },
              { note: 64, label: 'E4' },
              { note: 67, label: 'G4' },
              { note: 72, label: 'C5' },
            ].map((k) => (
              <button
                key={k.note}
                onClick={() => handleTestNote(k.note)}
                className="px-3 py-1.5 rounded-lg bg-[#222736] hover:bg-orange-600 text-xs font-bold font-mono text-white transition-colors active:scale-95 shadow"
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
