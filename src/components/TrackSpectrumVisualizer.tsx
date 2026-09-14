import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart2 } from 'lucide-react';
import { globalPlaybackEngine } from '../audio/playbackEngine';
import { Track } from '../types';

interface TrackSpectrumVisualizerProps {
  track: Track;
  width?: number;
  height?: number;
}

export const TrackSpectrumVisualizer: React.FC<TrackSpectrumVisualizerProps> = ({
  track,
  width = 132,
  height = 42,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[]>(new Array(16).fill(0));
  const [activePeakDb, setActivePeakDb] = useState<number>(-60);
  const [displayMode, setDisplayMode] = useState<'bars' | 'curve'>('bars');

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure track routing nodes exist in Web Audio API
    globalPlaybackEngine.ensureTrackNodes(track);

    const numBars = 16;
    if (peaksRef.current.length !== numBars) {
      peaksRef.current = new Array(numBars).fill(0);
    }

    const render = () => {
      const analyser = globalPlaybackEngine.getTrackAnalyser(track.id);

      // Clear Canvas
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle horizontal dB reference grid lines (-24dB, -12dB, -3dB)
      ctx.lineWidth = 1;
      const dbLines = [0.25, 0.5, 0.85];
      dbLines.forEach((ratio) => {
        const y = Math.round(canvas.height * (1 - ratio));
        ctx.strokeStyle = ratio === 0.85 ? '#2c354a' : '#141824';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      });

      if (!analyser || track.isMuted) {
        // Muted or silent idle state
        if (track.isMuted) {
          ctx.fillStyle = '#f43f5e33';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MUTED', canvas.width / 2, canvas.height / 2 + 3);
        } else {
          // Draw subtle flat baseline dots
          ctx.fillStyle = '#1e2434';
          for (let i = 0; i < numBars; i++) {
            const x = i * (canvas.width / numBars) + 2;
            ctx.fillRect(x, canvas.height - 3, (canvas.width / numBars) - 2, 2);
          }
        }
        animId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount; // 32 bins with fftSize=64
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Calculate overall peak value for dB readout
      let maxVal = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) maxVal = dataArray[i];
      }
      const currentPeakDb = maxVal > 0 ? Math.round(20 * Math.log10(maxVal / 255)) : -60;
      setActivePeakDb((prev) => (maxVal > 0 ? currentPeakDb : Math.max(-60, prev - 1.5)));

      // Map frequency bins into 16 visual display bands (sub-bass to brilliance)
      const barWidth = (canvas.width / numBars) - 1.5;
      const barHeights: number[] = [];

      for (let i = 0; i < numBars; i++) {
        // Distribute exponentially to reflect human hearing (more resolution in bass and mids)
        const startBin = Math.floor(Math.pow(i / numBars, 1.35) * (bufferLength - 1));
        const endBin = Math.max(startBin + 1, Math.floor(Math.pow((i + 1) / numBars, 1.35) * bufferLength));
        let sum = 0;
        let count = 0;
        for (let b = startBin; b < endBin && b < bufferLength; b++) {
          sum += dataArray[b];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;
        // Non-linear visual scale for dynamic responsiveness
        const normalized = Math.pow(avg / 255, 1.15);
        const h = normalized * (canvas.height - 4);
        barHeights.push(h);

        // Peak hold decay calculation
        if (h >= peaksRef.current[i]) {
          peaksRef.current[i] = h;
        } else {
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 0.7); // Gravity decay
        }
      }

      if (displayMode === 'bars') {
        // Render 16 responsive LED frequency bars
        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + 1.5) + 1;
          const h = barHeights[i];
          const y = canvas.height - h;

          if (h > 1) {
            // Gradient fill from track color up to orange/red warning peak
            const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
            grad.addColorStop(0, `${track.color}aa`);
            grad.addColorStop(0.7, track.color);
            grad.addColorStop(0.92, '#f59e0b');
            grad.addColorStop(1.0, '#ef4444');

            ctx.fillStyle = grad;
            ctx.beginPath();
            // Rounded top bar
            ctx.roundRect(x, y, barWidth, h, [1.5, 1.5, 0, 0]);
            ctx.fill();
          }

          // Floating Peak Cap Line
          const peakY = canvas.height - peaksRef.current[i];
          if (peakY < canvas.height - 2) {
            ctx.fillStyle = peakY < 8 ? '#f43f5e' : '#f8fafc';
            ctx.fillRect(x, peakY, barWidth, 1.5);
          }
        }
      } else {
        // Curve Mode (Continuous frequency contour)
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + 1.5) + barWidth / 2;
          const y = canvas.height - barHeights[i];
          if (i === 0) ctx.lineTo(x, y);
          else {
            const prevX = (i - 1) * (barWidth + 1.5) + barWidth / 2;
            const prevY = canvas.height - barHeights[i - 1];
            const cx = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cx, (prevY + y) / 2);
          }
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, `${track.color}cc`);
        grad.addColorStop(1, `${track.color}11`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = track.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [track.id, track.color, track.isMuted, track.volume, displayMode]);

  return (
    <div className="w-full bg-[#0d0f17] rounded-xl border border-[#23293a] p-1.5 flex flex-col gap-1 shadow-inner relative group">
      {/* Top Header Label & dB Peak Readout */}
      <div className="flex items-center justify-between text-[8px] font-mono px-0.5">
        <button
          onClick={() => setDisplayMode((m) => (m === 'bars' ? 'curve' : 'bars'))}
          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Click to toggle Spectrum Bars / Curve"
        >
          <BarChart2 className="w-2.5 h-2.5 text-cyan-400" />
          <span className="font-bold tracking-wider">SPECTRUM</span>
        </button>

        <span
          className={`font-mono transition-colors ${
            activePeakDb > -3
              ? 'text-rose-400 font-bold'
              : activePeakDb > -12
              ? 'text-amber-400'
              : 'text-slate-400'
          }`}
        >
          {activePeakDb <= -60 ? '-∞ dB' : `${activePeakDb > 0 ? '+' : ''}${activePeakDb} dB`}
        </span>
      </div>

      {/* Real-time Spectrum Canvas */}
      <div className="w-full h-10 rounded-lg overflow-hidden border border-[#1b202e] bg-[#07090e] relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full block cursor-pointer"
          onClick={() => setDisplayMode((m) => (m === 'bars' ? 'curve' : 'bars'))}
          title="Real-time Web Audio API AnalyserNode frequency spectrum"
        />

        {/* Frequency Band Markers (Sub, Mid, High) overlay */}
        <div className="absolute bottom-0.5 left-1 right-1 flex justify-between text-[7px] font-mono text-slate-400/80 pointer-events-none select-none">
          <span>SUB</span>
          <span>MID</span>
          <span>AIR</span>
        </div>
      </div>
    </div>
  );
};
