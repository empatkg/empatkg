import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileMusic,
  Folder,
  Plus,
  Save,
  Upload,
  Search,
  ArrowUpDown,
  CheckSquare,
  Square,
  Play,
  Pause,
  Trash2,
  Download,
  Share2,
  Music,
  Sliders,
  Settings,
  ShoppingBag,
  RefreshCw,
  Clock,
  Sparkles,
  HelpCircle,
  FileCode,
  Check,
  AlertCircle,
  FolderOpen,
  ChevronRight,
  Disc,
  ArrowLeft,
  Volume2,
  HardDrive,
  Eye,
  Edit3,
} from 'lucide-react';
import {
  AppConfig,
  AppTheme,
  SongFile,
  SongFormat,
  FolderCategory,
  THEME_PRESETS,
  Track,
  Pattern,
  AutomationClip,
} from '../types';
import {
  SCOPED_STORAGE_BASE_PATH,
  SCOPED_CONFIG_FILE_PATH,
  loadScopedFiles,
  saveScopedFiles,
  saveSongToScopedStorage,
  deleteSongFromScopedStorage,
  loadScopedConfig,
  saveScopedConfig,
  getScopedConfigJsonString,
  saveScopedConfigJsonString,
  exportConfigFile,
} from '../utils/scopedStorage';
import { globalPlaybackEngine } from '../audio/playbackEngine';

interface FLStudioMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  patterns: Pattern[];
  setPatterns: React.Dispatch<React.SetStateAction<Pattern[]>>;
  automationClips: AutomationClip[];
  setAutomationClips: React.Dispatch<React.SetStateAction<AutomationClip[]>>;
  bpm: number;
  setBpm: (bpm: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  appConfig: AppConfig;
  setAppConfig: (config: AppConfig) => void;
  activeTheme: AppTheme;
  setActiveTheme: (theme: AppTheme) => void;
  currentSongTitle: string;
  setCurrentSongTitle: (title: string) => void;
}

type MenuTab = 'SONGS' | 'PROJECT' | 'SETTINGS' | 'SHOP' | 'SYNC';

export const FLStudioMenuModal: React.FC<FLStudioMenuModalProps> = ({
  isOpen,
  onClose,
  tracks,
  setTracks,
  patterns,
  setPatterns,
  automationClips,
  setAutomationClips,
  bpm,
  setBpm,
  masterVolume,
  setMasterVolume,
  appConfig,
  setAppConfig,
  activeTheme,
  setActiveTheme,
  currentSongTitle,
  setCurrentSongTitle,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('SONGS');

  // File browser state
  const [currentFolder, setCurrentFolder] = useState<FolderCategory>('My Songs');
  const [fileList, setFileList] = useState<SongFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // New Template dropdown
  const [isNewTemplateMenuOpen, setIsNewTemplateMenuOpen] = useState(false);

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveFileName, setSaveFileName] = useState(currentSongTitle);
  const [saveFormat, setSaveFormat] = useState<SongFormat>('flm');
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Config Code Editor state
  const [configJsonText, setConfigJsonText] = useState('');
  const [configEditorError, setConfigEditorError] = useState<string | null>(null);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Project Info state
  const [artistName, setArtistName] = useState('FL Producer');
  const [genreName, setGenreName] = useState('Electronic');
  const [projectComments, setProjectComments] = useState('');

  // Hidden file input for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files and config on open
  useEffect(() => {
    if (isOpen) {
      const files = loadScopedFiles();
      setFileList(files);
      const rawJson = getScopedConfigJsonString();
      setConfigJsonText(rawJson);
      setSaveFileName(currentSongTitle);
    }
  }, [isOpen, currentSongTitle]);

  if (!isOpen) return null;

  // Filter and sort files
  const filteredFiles = fileList
    .filter((file) => {
      const matchesFolder = file.folder === currentFolder;
      const matchesSearch =
        !searchQuery ||
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (file.genre && file.genre.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFolder && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortBy === 'size') {
        return sortAsc ? a.sizeBytes - b.sizeBytes : b.sizeBytes - a.sizeBytes;
      } else {
        return sortAsc ? a.lastModified - b.lastModified : b.lastModified - a.lastModified;
      }
    });

  // Handle Save Project
  const handleExecuteSave = (andSend: boolean = false) => {
    if (!saveFileName.trim()) return;

    const newSong: SongFile = {
      id: `song_${Date.now()}`,
      name: saveFileName.trim(),
      format: saveFormat,
      folder: currentFolder === 'Templates' ? 'My Songs' : currentFolder,
      sizeBytes: Math.round(1024 * 1024 * (1.5 + tracks.length * 0.4)),
      lastModified: Date.now(),
      bpm,
      durationFormatted: '3m 20s',
      tracksCount: tracks.length,
      artist: artistName,
      genre: genreName,
      projectData: {
        tracks,
        patterns,
        automationClips,
        bpm,
        masterVolume,
      },
    };

    const updated = saveSongToScopedStorage(newSong);
    setFileList(updated);
    setCurrentSongTitle(saveFileName.trim());
    setIsSaveModalOpen(false);

    if (andSend) {
      // Export file payload for download/sharing
      const payload = JSON.stringify(newSong, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${saveFileName.trim()}.${saveFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setSaveNotification(`Project "${saveFileName}.${saveFormat}" saved to Scoped Storage!`);
    setTimeout(() => setSaveNotification(null), 3500);
  };

  // Handle Loading a Project / Song
  const handleLoadSong = (song: SongFile) => {
    if (song.projectData) {
      if (song.projectData.bpm) {
        setBpm(song.projectData.bpm);
        globalPlaybackEngine.setBpm(song.projectData.bpm);
      }
      if (song.projectData.tracks && Array.isArray(song.projectData.tracks)) {
        setTracks(song.projectData.tracks);
      }
      if (song.projectData.patterns && Array.isArray(song.projectData.patterns)) {
        setPatterns(song.projectData.patterns);
      }
      if (song.projectData.automationClips && Array.isArray(song.projectData.automationClips)) {
        setAutomationClips(song.projectData.automationClips);
      }
      if (song.projectData.masterVolume !== undefined) {
        setMasterVolume(song.projectData.masterVolume);
      }
    }
    setCurrentSongTitle(song.name);
    setSaveNotification(`Loaded "${song.name}"`);
    setTimeout(() => setSaveNotification(null), 3000);
  };

  // Handle Template Selection (as in Frame 00:38)
  const handleSelectTemplate = (templateName: string) => {
    setIsNewTemplateMenuOpen(false);
    let newBpm = 120;
    let newTitle = templateName === 'Empty' ? 'Untitled Song' : `${templateName} Project`;

    if (templateName === 'Trap') newBpm = 140;
    else if (templateName === 'Boom Bap') newBpm = 90;
    else if (templateName === 'Lo-Fi') newBpm = 82;
    else if (templateName === 'Amapiano') newBpm = 112;
    else if (templateName === 'Drill') newBpm = 142;
    else if (templateName === 'Techno') newBpm = 130;
    else if (templateName === 'D&B') newBpm = 174;
    else if (templateName === 'Drift Phonk') newBpm = 155;

    setBpm(newBpm);
    globalPlaybackEngine.setBpm(newBpm);
    setCurrentSongTitle(newTitle);

    setSaveNotification(`Created new ${templateName} project at ${newBpm} BPM.`);
    setTimeout(() => setSaveNotification(null), 3000);
  };

  // Handle Importing file from device storage
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameParts = file.name.split('.');
    const ext = (fileNameParts.pop() || 'wav').toLowerCase() as SongFormat;
    const nameWithoutExt = fileNameParts.join('.');

    const newImported: SongFile = {
      id: `imported_${Date.now()}`,
      name: nameWithoutExt,
      format: ext,
      folder: ext === 'flm' || ext === 'flp' ? 'My Songs' : 'My Samples',
      sizeBytes: file.size,
      lastModified: Date.now(),
      bpm: 120,
      durationFormatted: '0m 30s',
      tracksCount: 1,
      artist: 'Imported',
    };

    const updated = saveSongToScopedStorage(newImported);
    setFileList(updated);
    setSaveNotification(`Imported "${file.name}" into ${newImported.folder}`);
    setTimeout(() => setSaveNotification(null), 3000);
  };

  // Handle Delete File
  const handleDeleteFile = (id: string) => {
    const updated = deleteSongFromScopedStorage(id);
    setFileList(updated);
    setSelectedFileIds((prev) => prev.filter((i) => i !== id));
  };

  // Save Raw Config from Code Editor
  const handleSaveConfigEditor = () => {
    setConfigEditorError(null);
    setConfigSaveSuccess(false);

    const result = saveScopedConfigJsonString(configJsonText);
    if (result.success && result.config) {
      setAppConfig(result.config);
      // If theme changed, apply it
      const matchingTheme = THEME_PRESETS.find((t) => t.id === result.config?.themeId);
      if (matchingTheme) {
        setActiveTheme(matchingTheme);
      }
      setConfigSaveSuccess(true);
      setTimeout(() => setConfigSaveSuccess(false), 2500);
    } else {
      setConfigEditorError(result.error || 'Failed to parse configuration');
    }
  };

  // Reset Config to default
  const handleResetConfigToDefault = () => {
    const raw = JSON.stringify(loadScopedConfig(), null, 2);
    setConfigJsonText(raw);
    saveScopedConfig(loadScopedConfig());
    setConfigSaveSuccess(true);
    setTimeout(() => setConfigSaveSuccess(false), 2000);
  };

  // Switch Theme Preset
  const handleSelectTheme = (theme: AppTheme) => {
    setActiveTheme(theme);
    const updatedConfig: AppConfig = {
      ...appConfig,
      themeId: theme.id,
      customAccentColor: theme.primary,
    };
    setAppConfig(updatedConfig);
    saveScopedConfig(updatedConfig);
    setConfigJsonText(JSON.stringify(updatedConfig, null, 2));
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#14151a] w-full max-w-4xl h-[92vh] max-h-[720px] rounded-2xl border border-[#272a36] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header Bar (matches video Frame 00:35) */}
        <div className="bg-[#191a21] border-b border-[#292c3a] px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_#f97316]" />
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-wider text-white">
                FL Studio Mobile
              </h1>
              <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
                Version {appConfig.version}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className="px-3 py-1 rounded-full bg-[#242732] hover:bg-[#2e3240] text-slate-300 text-xs font-medium border border-[#333748] transition-colors"
            >
              Help
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-full bg-[#242732] hover:bg-[#b91c1c] hover:text-white text-slate-300 text-xs font-medium border border-[#333748] transition-colors flex items-center gap-1"
              title="Close Menu"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar (SONGS | PROJECT | SETTINGS | SHOP | SYNC) */}
        <div className="bg-[#17181f] border-b border-[#272a38] px-3 sm:px-5 flex items-center gap-1 shrink-0 overflow-x-auto">
          {(['SONGS', 'PROJECT', 'SETTINGS', 'SHOP', 'SYNC'] as MenuTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold tracking-wider border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-white text-white font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Save Notification Banner */}
        {saveNotification && (
          <div className="bg-emerald-950/80 border-b border-emerald-700/60 px-4 py-1.5 text-xs font-mono text-emerald-300 flex items-center justify-between">
            <span>{saveNotification}</span>
            <button onClick={() => setSaveNotification(null)} className="text-emerald-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: SONGS (FL STUDIO MOBILE FILE BROWSER) */}
        {activeTab === 'SONGS' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#121318]">
            {/* Folder Header Breadcrumb */}
            <div className="bg-[#181a22] border-b border-[#242734] px-4 py-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentFolder('My Songs')}
                  className="px-2 py-1 rounded-md bg-[#222530] text-slate-300 hover:text-white text-xs flex items-center gap-1 border border-[#2f3445]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-slate-300">
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{currentFolder}</span>
                </div>
              </div>

              {/* Folder switcher pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {(['My Songs', 'My Samples', 'My Recordings', 'Templates'] as FolderCategory[]).map(
                  (folder) => (
                    <button
                      key={folder}
                      onClick={() => setCurrentFolder(folder)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all ${
                        currentFolder === folder
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          : 'bg-[#1e202a] text-slate-400 hover:text-slate-200 border border-[#2b2e3c]'
                      }`}
                    >
                      {folder}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Main File Browser Area with Left & Right Action Bars */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Left Vertical Action Strip (Back, Search, Sort, Select) */}
              <div className="w-20 sm:w-24 bg-[#161820] border-r border-[#262936] p-2 flex flex-col gap-2 shrink-0 items-center">
                <button
                  onClick={() => setCurrentFolder('My Songs')}
                  className="w-full py-2 rounded-xl bg-[#222531] hover:bg-[#2b2f3e] text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 border border-[#2f3344] transition-all"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px]">Back</span>
                </button>

                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`w-full py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                    isSearchOpen
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-[#222531] hover:bg-[#2b2f3e] text-slate-300 border-[#2f3344]'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="text-[10px]">Search</span>
                </button>

                <button
                  onClick={() => {
                    const next = sortBy === 'date' ? 'name' : sortBy === 'name' ? 'size' : 'date';
                    setSortBy(next);
                  }}
                  className="w-full py-2 rounded-xl bg-[#222531] hover:bg-[#2b2f3e] text-slate-300 text-xs font-semibold flex flex-col items-center gap-1 border border-[#2f3344] transition-all"
                  title="Cycle Sort Order (Date / Name / Size)"
                >
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] uppercase font-mono">{sortBy}</span>
                </button>

                <button
                  onClick={() => setIsSelectMode(!isSelectMode)}
                  className={`w-full py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                    isSelectMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#222531] hover:bg-[#2b2f3e] text-slate-300 border-[#2f3344]'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="text-[10px]">Select</span>
                </button>
              </div>

              {/* Center File List */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#121318] p-3 overflow-y-auto">
                {/* Search Bar Input (if open) */}
                {isSearchOpen && (
                  <div className="mb-3 p-2 bg-[#1a1c25] rounded-xl border border-[#2e3242] flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search songs, samples, genre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                      autoFocus
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* File Items */}
                {filteredFiles.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 select-none py-12">
                    <span className="text-4xl sm:text-5xl font-black tracking-widest opacity-25">
                      EMPTY
                    </span>
                    <p className="text-xs text-slate-500 mt-2 font-mono">
                      No files found in {currentFolder}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedFileIds.includes(file.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => {
                            if (isSelectMode) {
                              setSelectedFileIds((prev) =>
                                isSelected ? prev.filter((i) => i !== file.id) : [...prev, file.id]
                              );
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#202535] border-orange-500/60 shadow-sm'
                              : 'bg-[#181a23] hover:bg-[#1f222e] border-[#282c3b]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isSelectMode && (
                              <div className="text-orange-400">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                            )}

                            {/* File Format Badge */}
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                                file.format === 'flm'
                                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                  : file.format === 'wav' || file.format === 'mp3'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : file.format === 'midi'
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              }`}
                            >
                              .{file.format}
                            </div>

                            <div className="min-w-0">
                              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                                {file.name}
                              </h3>
                              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                                <span>{file.bpm} BPM</span>
                                <span>·</span>
                                <span>{file.durationFormatted}</span>
                                <span>·</span>
                                <span>{(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                                {file.genre && (
                                  <>
                                    <span>·</span>
                                    <span className="text-orange-400/80">{file.genre}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadSong(file);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold font-mono transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span className="hidden sm:inline">Load</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#282d3d] transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Vertical Action Strip (New, Save, Import) (matches Frame 00:35!) */}
              <div className="w-20 sm:w-24 bg-[#161820] border-l border-[#262936] p-2 flex flex-col gap-2 shrink-0 items-center relative">
                {/* NEW BUTTON (triggers template dropdown) */}
                <div className="w-full relative">
                  <button
                    onClick={() => setIsNewTemplateMenuOpen(!isNewTemplateMenuOpen)}
                    className="w-full py-3 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-bold flex flex-col items-center gap-1 shadow-md transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5 text-black stroke-[3]" />
                    <span className="text-[11px] font-bold">New</span>
                  </button>

                  {/* Template Dropdown Menu (matches Frame 00:38 in video!) */}
                  {isNewTemplateMenuOpen && (
                    <div className="absolute right-full top-0 mr-2 w-48 bg-[#1a1c26] rounded-xl border border-[#32374b] shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 border-b border-[#282c3c]">
                        <button
                          onClick={() => handleSelectTemplate('Empty')}
                          className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#252a3a] text-xs font-bold text-white transition-colors flex items-center justify-between"
                        >
                          <span>Empty</span>
                        </button>
                      </div>
                      <div className="p-1 max-h-56 overflow-y-auto">
                        <div className="px-3 py-1 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                          Templates
                        </div>
                        {[
                          'Amapiano',
                          'Audio Recording',
                          'Boom Bap',
                          'D&B',
                          'Drift Phonk',
                          'Drill',
                          'Lo-Fi',
                          'Techno',
                          'Trap',
                        ].map((template) => (
                          <button
                            key={template}
                            onClick={() => handleSelectTemplate(template)}
                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-orange-500/20 hover:text-orange-400 text-xs text-slate-200 transition-colors"
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SAVE BUTTON (triggers save format modal) */}
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-bold flex flex-col items-center gap-1 shadow-md transition-all active:scale-95"
                >
                  <Save className="w-5 h-5 text-black stroke-[2.5]" />
                  <span className="text-[11px] font-bold">Save</span>
                </button>

                {/* IMPORT BUTTON (triggers file picker) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-bold flex flex-col items-center gap-1 shadow-md transition-all active:scale-95"
                >
                  <Upload className="w-5 h-5 text-black stroke-[2.5]" />
                  <span className="text-[11px] font-bold">Import</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept="audio/*,.flm,.flp,.mid,.midi"
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROJECT (Project stats, metadata, tempo, render) */}
        {activeTab === 'PROJECT' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#121318] p-4 sm:p-6 overflow-y-auto">
            {/* Top Project Action Bar */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => handleExecuteSave(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setIsSaveModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#222532] hover:bg-[#2c3042] text-white text-xs font-semibold border border-[#34394d] transition-colors"
              >
                Save New
              </button>
              <button
                onClick={() => handleExecuteSave(true)}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <Disc className="w-4 h-4" />
                <span>Quick Render (.WAV)</span>
              </button>
            </div>

            {/* Project Info Section */}
            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-4 sm:p-5 mb-5 shadow-sm">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span>Project Info</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-[#232736]">
                  <span className="text-slate-400">Project length:</span>
                  <span className="text-white font-bold">3m 55s</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232736]">
                  <span className="text-slate-400">Tracks count:</span>
                  <span className="text-cyan-400 font-bold">{tracks.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232736]">
                  <span className="text-slate-400">Total patterns:</span>
                  <span className="text-purple-400 font-bold">{patterns.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232736]">
                  <span className="text-slate-400">Automation clips:</span>
                  <span className="text-amber-400 font-bold">{automationClips.length}</span>
                </div>
              </div>

              {/* Tempo & Sample Rate Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-[#252938]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Tempo:</span>
                  <div className="flex items-center gap-1 bg-[#121319] p-1 rounded-xl border border-[#272b3a]">
                    <button
                      onClick={() => {
                        const next = Math.max(40, bpm - 1);
                        setBpm(next);
                        globalPlaybackEngine.setBpm(next);
                      }}
                      className="w-7 h-7 rounded-lg bg-[#222533] text-white flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="w-16 text-center font-mono font-bold text-amber-400 text-xs">
                      {bpm}.0 BPM
                    </span>
                    <button
                      onClick={() => {
                        const next = Math.min(240, bpm + 1);
                        setBpm(next);
                        globalPlaybackEngine.setBpm(next);
                      }}
                      className="w-7 h-7 rounded-lg bg-[#222533] text-white flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Sample Rate:</span>
                  <div className="flex items-center gap-1 bg-[#121319] p-1 rounded-xl border border-[#272b3a] font-mono text-xs text-emerald-400 font-bold px-3">
                    {appConfig.sampleRate.toLocaleString()} Hz
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-4 sm:p-5 shadow-sm flex flex-col gap-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-400" />
                <span>Metadata</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={saveFileName}
                    onChange={(e) => setSaveFileName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Artist</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Genre</label>
                  <input
                    type="text"
                    value={genreName}
                    onChange={(e) => setGenreName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS (UI THEMING & SCOPED STORAGE CONFIG EDITOR) */}
        {activeTab === 'SETTINGS' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#121318] p-4 sm:p-6 overflow-y-auto gap-6">
            {/* Section 1: UI Theming like FL Studio Mobile */}
            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-bold text-white">UI Theming & Visual Presets</h2>
                </div>
                <span className="text-[10px] font-mono text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800">
                  Active: {activeTheme.name}
                </span>
              </div>

              {/* Theme Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                {THEME_PRESETS.map((theme) => {
                  const isCurrent = activeTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isCurrent
                          ? 'border-white shadow-md'
                          : 'hover:border-slate-500 border-[#2b2f3e]'
                      }`}
                      style={{ backgroundColor: theme.surface }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-4 h-4 rounded-full shadow-xs"
                          style={{ backgroundColor: theme.primary }}
                        />
                        {isCurrent && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Theme Tuning Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#252938]">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    UI Scale
                  </label>
                  <select
                    value={appConfig.uiScale}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      const updated = { ...appConfig, uiScale: val };
                      setAppConfig(updated);
                      saveScopedConfig(updated);
                      setConfigJsonText(JSON.stringify(updated, null, 2));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none"
                  >
                    <option value="compact">Compact (Mobile)</option>
                    <option value="standard">Standard (Default)</option>
                    <option value="comfortable">Comfortable (Tablet)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    Keyboard Key Size
                  </label>
                  <select
                    value={appConfig.keySize}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      const updated = { ...appConfig, keySize: val };
                      setAppConfig(updated);
                      saveScopedConfig(updated);
                      setConfigJsonText(JSON.stringify(updated, null, 2));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none"
                  >
                    <option value="small">Small (3 Octaves)</option>
                    <option value="medium">Medium (2 Octaves)</option>
                    <option value="large">Large (1.5 Octaves)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    Audio Latency Buffer
                  </label>
                  <select
                    value={appConfig.audioBufferSize}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      const updated = { ...appConfig, audioBufferSize: val };
                      setAppConfig(updated);
                      saveScopedConfig(updated);
                      setConfigJsonText(JSON.stringify(updated, null, 2));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#121319] border border-[#272b3a] text-xs text-white focus:outline-none"
                  >
                    <option value="low_latency">Low Latency (Fast)</option>
                    <option value="standard">Standard</option>
                    <option value="safe">Safe (No Glitches)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Scoped Storage Config File In-App Editor */}
            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-4 sm:p-5 shadow-sm flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Scoped Storage Configuration Editor
                    </h2>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {SCOPED_CONFIG_FILE_PATH}
                    </span>
                  </div>
                </div>

                {/* Editor Action Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={exportConfigFile}
                    className="px-2.5 py-1 rounded-lg bg-[#222533] hover:bg-[#2c3042] text-slate-300 text-xs font-mono border border-[#31364a] flex items-center gap-1"
                    title="Download config.json"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={handleResetConfigToDefault}
                    className="px-2.5 py-1 rounded-lg bg-[#222533] hover:bg-[#2c3042] text-slate-300 text-xs font-mono border border-[#31364a]"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSaveConfigEditor}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold font-mono flex items-center gap-1 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5 fill-current" />
                    <span>Save Config</span>
                  </button>
                </div>
              </div>

              {/* Status or Error Notifications */}
              {configSaveSuccess && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs font-mono text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Config saved to scoped storage and applied immediately!</span>
                </div>
              )}
              {configEditorError && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700/60 text-xs font-mono text-red-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Syntax Error: {configEditorError}</span>
                </div>
              )}

              {/* JSON Code Editor */}
              <div className="relative rounded-xl overflow-hidden border border-[#2b2f40] bg-[#0c0d12]">
                <div className="bg-[#14151e] px-3 py-1.5 border-b border-[#252938] flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>config.json (Live JSON Editor)</span>
                  <span>UTF-8 · Editable</span>
                </div>
                <textarea
                  value={configJsonText}
                  onChange={(e) => setConfigJsonText(e.target.value)}
                  rows={12}
                  className="w-full bg-[#0c0d12] text-emerald-400 font-mono text-xs p-3 leading-relaxed focus:outline-none resize-y selection:bg-emerald-900 selection:text-white"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SHOP (Sound Packs & Samples from video Frame 00:39) */}
        {activeTab === 'SHOP' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#121318] p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                <span>FL Studio Mobile Sound Shop &amp; Presets</span>
              </h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded-full bg-[#20232f] text-slate-300 text-xs border border-[#2d3244]">
                  Filter list
                </button>
                <button className="px-3 py-1 rounded-full bg-[#20232f] text-slate-300 text-xs border border-[#2d3244]">
                  Restore purchases
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  id: 'pack_strings',
                  title: 'Essential Strings',
                  desc: 'An augmented selection of 35 orchestral string instruments',
                  installed: true,
                  badge: 'INSTALLED',
                },
                {
                  id: 'pack_ferrous',
                  title: 'Ferrous Mobile',
                  desc: 'Otherworldly sounds from prepared piano to abstract synths',
                  installed: false,
                  badge: 'FREE',
                },
                {
                  id: 'pack_wa_prod',
                  title: 'WA Production Selection',
                  desc: '435 Hand picked One Shot Samples from WA Production',
                  installed: true,
                  badge: 'FREE',
                },
                {
                  id: 'pack_808_drums',
                  title: '808 Trap Drums & Sub Bass',
                  desc: 'Hard hitting punchy 808 subs, crispy snares, and rolling hi-hats',
                  installed: true,
                  badge: 'INSTALLED',
                },
              ].map((pack) => (
                <div
                  key={pack.id}
                  className="p-4 rounded-xl bg-[#181a24] border border-[#282c3c] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-900/60 to-slate-900 border border-purple-600/40 flex items-center justify-center text-purple-300">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{pack.title}</h3>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {pack.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{pack.desc}</p>
                    </div>
                  </div>

                  <button
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                      pack.installed
                        ? 'bg-[#222533] text-slate-400 border border-[#323648]'
                        : 'bg-orange-500 hover:bg-orange-400 text-black'
                    }`}
                  >
                    {pack.installed ? 'Ready' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SYNC (Wi-Fi sync & cloud export) */}
        {activeTab === 'SYNC' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#121318] p-4 sm:p-6 overflow-y-auto">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>Direct Share &amp; Cloud Sync</span>
            </h2>

            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-5 mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Direct Wi-Fi Share
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Send projects and samples directly to other Android phones, tablets, iOS devices, or
                FL Studio on PC connected to the same Wi-Fi network.
              </p>
              <button
                onClick={() => {
                  setSaveNotification('Scanning for nearby FL Studio Mobile devices on Wi-Fi...');
                  setTimeout(() => setSaveNotification(null), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold font-mono flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Search Nearby Devices</span>
              </button>
            </div>

            <div className="bg-[#181a24] rounded-2xl border border-[#272b3a] p-5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Scoped Storage Archive Backup
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Create a full backup archive of all projects in {SCOPED_STORAGE_BASE_PATH} to save to
                Google Drive, Dropbox, or SD card.
              </p>
              <button
                onClick={() => {
                  exportConfigFile();
                  setSaveNotification('Exported full configuration & songs archive!');
                  setTimeout(() => setSaveNotification(null), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-[#222533] hover:bg-[#2c3042] text-white text-xs font-semibold border border-[#33384c] flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export Storage Backup (.ZIP)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SAVE DIALOG MODAL (matches Frame 00:36 in user video!) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-[#191b24] rounded-2xl border border-[#2c3144] shadow-2xl max-w-md w-full p-5 text-center flex flex-col items-center">
            <div className="w-full flex justify-end">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <span className="text-xs text-slate-400 font-mono mb-1">File Name</span>
            <input
              type="text"
              value={saveFileName}
              onChange={(e) => setSaveFileName(e.target.value)}
              className="text-lg font-bold text-white text-center bg-transparent border-b border-slate-600 focus:border-orange-500 focus:outline-none pb-1 w-full max-w-xs mb-1"
            />
            <span className="text-[11px] text-slate-500 mb-5">FL Studio Mobile Song</span>

            {/* Format Pills: FLM, FLP, ZIP, MIDI, WAV, FLAC, OGG, MP3 */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {(['FLM', 'FLP', 'ZIP', 'MIDI', 'WAV', 'FLAC', 'OGG', 'MP3'] as string[]).map(
                (fmt) => {
                  const isSelected = saveFormat.toUpperCase() === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => setSaveFormat(fmt.toLowerCase() as SongFormat)}
                      className={`px-3.5 py-1 rounded-full text-xs font-bold font-mono transition-all ${
                        isSelected
                          ? 'bg-white text-black shadow-md scale-105'
                          : 'bg-[#252836] text-slate-400 hover:text-slate-200 border border-[#31364a]'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                }
              )}
            </div>

            {/* Bottom SAVE & SEND Buttons */}
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                onClick={() => handleExecuteSave(false)}
                className="px-8 py-2 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-black tracking-wider transition-all shadow-md active:scale-95"
              >
                SAVE
              </button>
              <button
                onClick={() => handleExecuteSave(true)}
                className="px-8 py-2 rounded-xl bg-[#282c3c] hover:bg-[#32374b] text-white text-xs font-black tracking-wider transition-all border border-[#3b4157] active:scale-95"
              >
                SEND
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
