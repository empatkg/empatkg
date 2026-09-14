import React, { useState } from 'react';
import {
  X,
  Download,
  FolderOpen,
  Music,
  Sliders,
  Sparkles,
  Info,
  Check,
  Disc,
} from 'lucide-react';
import { Track } from '../types';
import { globalPlaybackEngine } from '../audio/playbackEngine';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  bpm: number;
  setBpm: (bpm: number) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  tracks,
  bpm,
  setBpm,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportBars, setExportBars] = useState(8); // 8 bars = 32 beats

  if (!isOpen) return null;

  const handleExportWav = async () => {
    try {
      setIsExporting(true);
      setExportComplete(false);

      const totalBeats = exportBars * 4;
      const wavBlob = await globalPlaybackEngine.exportProjectWav(totalBeats);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FL_Mobile_Project_${bpm}BPM.wav`;
      a.click();
      URL.revokeObjectURL(url);

      setExportComplete(true);
    } catch (e) {
      console.error('Export error:', e);
      alert('Error rendering offline audio mix.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalClips = tracks.reduce((sum, t) => sum + t.clips.length, 0);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#181a24] rounded-2xl border border-[#2b3040] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="bg-[#1e222e] border-b border-[#2d3345] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="font-bold text-base text-white tracking-wide">
              FL STUDIO MOBILE PROJECT
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#282d3d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Project Stats */}
          <div className="grid grid-cols-3 gap-2 bg-[#12141c] p-3 rounded-xl border border-[#242938]">
            <div className="text-center">
              <span className="text-[10px] text-slate-400 font-mono">TEMPO</span>
              <div className="text-base font-bold text-orange-400 font-mono">{bpm} BPM</div>
            </div>
            <div className="text-center border-x border-[#242938]">
              <span className="text-[10px] text-slate-400 font-mono">TRACKS</span>
              <div className="text-base font-bold text-cyan-400 font-mono">{tracks.length}</div>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-slate-400 font-mono">TOTAL CLIPS</span>
              <div className="text-base font-bold text-emerald-400 font-mono">{totalClips}</div>
            </div>
          </div>

          {/* Export Song to WAV Section */}
          <div className="bg-[#14161f] p-4 rounded-xl border border-[#272c3d] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Render Song Mixdown (.WAV)
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                44.1kHz · 16-Bit Stereo
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Bakes all audio tracks (with Stretch/Resample/Auto modes &amp; pitch shifts) and synth
              MIDI tracks into a clean master WAV file.
            </p>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Length:</span>
                <select
                  value={exportBars}
                  onChange={(e) => setExportBars(parseInt(e.target.value, 10))}
                  className="bg-[#1e2230] text-white text-xs font-bold px-2.5 py-1.5 rounded-lg border border-[#343b4f] focus:outline-none cursor-pointer"
                >
                  <option value={4}>4 Bars (16 Beats)</option>
                  <option value={8}>8 Bars (32 Beats)</option>
                  <option value={16}>16 Bars (64 Beats)</option>
                </select>
              </div>

              <button
                onClick={handleExportWav}
                disabled={isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
                  isExporting
                    ? 'bg-amber-600 text-white animate-pulse'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Rendering Audio...' : 'Export Song to WAV'}</span>
              </button>
            </div>

            {exportComplete && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/50 p-2 rounded-lg border border-emerald-800/50">
                <Check className="w-4 h-4" />
                <span>Song rendered and downloaded successfully!</span>
              </div>
            )}
          </div>

          {/* FL Mobile Sampler Features Guide */}
          <div className="bg-[#14161f] p-3.5 rounded-xl border border-[#272c3d] flex flex-col gap-2 text-xs text-slate-300">
            <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">
              FL Sampler Modes Overview:
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc pl-4">
              <li>
                <strong className="text-slate-200">Resample:</strong> Speed and pitch are linked. Shift pitch up to speed up, or down to slow down.
              </li>
              <li>
                <strong className="text-slate-200">Stretch:</strong> Pitch shift without changing duration; or stretch duration without changing pitch using granular DSP.
              </li>
              <li>
                <strong className="text-slate-200">Auto:</strong> Automatically syncs sample duration to the current BPM grid bars while preserving pitch.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1a1d28] border-t border-[#2d3345] px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#272c3d] hover:bg-[#32394f] text-xs font-bold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
