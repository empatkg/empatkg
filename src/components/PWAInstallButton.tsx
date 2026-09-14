import React, { useState } from 'react';
import { Smartphone, Download, Check, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as installed APK / standalone PWA
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/60">
        <Check className="w-3 h-3" />
        <span>INSTALLED</span>
      </div>
    );
  }

  // Android / Chromium direct install
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
        title="Install FL Mobile to your Android device"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  // Fallback for Android Chrome menu / iOS guide
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#202534] hover:bg-[#2c3347] text-slate-300 text-xs font-semibold border border-[#323a50] transition-colors"
        title="Android APK / PWA install instructions"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Install APK</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
          <div className="bg-[#181a24] rounded-2xl border border-[#2b3040] shadow-2xl max-w-sm w-full p-5 flex flex-col gap-3 text-slate-200">
            <div className="flex items-center justify-between border-b border-[#2d3345] pb-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Install on Android Device</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#282d3d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This app is a progressive Android application (WebAPK). You can install it straight from your phone's browser without downloading from an app store:
            </p>

            <div className="bg-[#12141c] p-3 rounded-xl border border-[#262b3a] space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-400 font-mono">1.</span>
                <span>Open this application's URL in <strong>Google Chrome</strong> on Android.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-400 font-mono">2.</span>
                <span>Tap the <strong>three dots (⋮)</strong> browser menu in the top-right.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-400 font-mono">3.</span>
                <span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-400 font-mono">4.</span>
                <span>Android will automatically generate and install the native <strong>WebAPK</strong> onto your launcher.</span>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-2 w-full py-2 bg-[#272c3d] hover:bg-[#343b52] rounded-xl text-xs font-bold text-white transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
