/**
 * Scoped Storage & Configuration Manager for FL Studio Mobile
 * Emulates Android Scoped Storage (/storage/emulated/0/FLM/)
 * Manages config.json and song/sample file browser persistence.
 */

import { AppConfig, DEFAULT_APP_CONFIG, SongFile, FolderCategory } from '../types';

const CONFIG_STORAGE_KEY = 'FLM_SCOPED_STORAGE_CONFIG_V1';
const SONGS_STORAGE_KEY = 'FLM_SCOPED_STORAGE_SONGS_V1';
export const SCOPED_STORAGE_BASE_PATH = '/storage/emulated/0/FLM';
export const SCOPED_CONFIG_FILE_PATH = '/storage/emulated/0/FLM/config.json';

// Default initial bundled songs (including "Cinta Satu Malam.flm" seen in the user's video!)
const INITIAL_DEMO_SONGS: SongFile[] = [
  {
    id: 'song_cinta_satu_malam',
    name: 'CINTA SATU MALAM',
    format: 'flm',
    folder: 'My Songs',
    sizeBytes: 4280192,
    lastModified: Date.now() - 3600000 * 2,
    bpm: 130,
    durationFormatted: '3m 24s',
    tracksCount: 5,
    artist: 'FL Mobile Producer',
    genre: 'Remix / Electronic',
  },
  {
    id: 'song_trap_heat',
    name: 'Atlanta 808 Trap Heat',
    format: 'flm',
    folder: 'My Songs',
    sizeBytes: 3145728,
    lastModified: Date.now() - 3600000 * 24,
    bpm: 140,
    durationFormatted: '2m 48s',
    tracksCount: 6,
    artist: 'Beat Maker',
    genre: 'Trap',
  },
  {
    id: 'song_amapiano_log',
    name: 'Amapiano Log Drum Groove',
    format: 'flm',
    folder: 'Templates',
    sizeBytes: 2890450,
    lastModified: Date.now() - 3600000 * 48,
    bpm: 112,
    durationFormatted: '4m 10s',
    tracksCount: 4,
    artist: 'Studio South Africa',
    genre: 'Amapiano',
  },
  {
    id: 'song_lofi_midnight',
    name: 'Midnight Coffee Lo-Fi',
    format: 'flm',
    folder: 'Templates',
    sizeBytes: 2450190,
    lastModified: Date.now() - 3600000 * 72,
    bpm: 84,
    durationFormatted: '2m 15s',
    tracksCount: 4,
    artist: 'Chillhop Records',
    genre: 'Lo-Fi',
  },
  {
    id: 'song_drill_uk',
    name: 'London Drift Drill',
    format: 'flm',
    folder: 'Templates',
    sizeBytes: 3670010,
    lastModified: Date.now() - 3600000 * 96,
    bpm: 142,
    durationFormatted: '3m 05s',
    tracksCount: 5,
    artist: 'UK Drill Producer',
    genre: 'Drill',
  },
  {
    id: 'sample_vocal_chop_1',
    name: 'Vocal_Chop_Atmosphere_Fm.wav',
    format: 'wav',
    folder: 'My Samples',
    sizeBytes: 524288,
    lastModified: Date.now() - 3600000 * 120,
    bpm: 120,
    durationFormatted: '0m 08s',
    tracksCount: 1,
    artist: 'Vocal Pack Vol 1',
  },
  {
    id: 'sample_kick_808_sub',
    name: '808_Sub_Punch_C.wav',
    format: 'wav',
    folder: 'My Samples',
    sizeBytes: 262144,
    lastModified: Date.now() - 3600000 * 130,
    bpm: 140,
    durationFormatted: '0m 04s',
    tracksCount: 1,
    artist: 'WA Production',
  },
  {
    id: 'rec_mic_take_1',
    name: 'Audio_Record_Mic_Take_01.wav',
    format: 'wav',
    folder: 'My Recordings',
    sizeBytes: 1048576,
    lastModified: Date.now() - 3600000 * 14,
    bpm: 120,
    durationFormatted: '0m 16s',
    tracksCount: 1,
    artist: 'Internal Mic',
  },
];

/**
 * Load configuration from scoped storage
 */
export function loadScopedConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      saveScopedConfig(DEFAULT_APP_CONFIG);
      return DEFAULT_APP_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_CONFIG, ...parsed };
  } catch (err) {
    console.error('Failed to parse config from scoped storage:', err);
    return DEFAULT_APP_CONFIG;
  }
}

/**
 * Save configuration to scoped storage
 */
export function saveScopedConfig(config: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to write config to scoped storage:', err);
  }
}

/**
 * Get raw config JSON string for code editor
 */
export function getScopedConfigJsonString(): string {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      return JSON.stringify(JSON.parse(raw), null, 2);
    }
  } catch {
    // fallback
  }
  return JSON.stringify(DEFAULT_APP_CONFIG, null, 2);
}

/**
 * Save raw config JSON string from code editor with validation
 */
export function saveScopedConfigJsonString(jsonString: string): { success: boolean; config?: AppConfig; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Config must be a valid JSON object.' };
    }
    const mergedConfig: AppConfig = { ...DEFAULT_APP_CONFIG, ...parsed };
    saveScopedConfig(mergedConfig);
    return { success: true, config: mergedConfig };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Invalid JSON syntax' };
  }
}

/**
 * Load songs and sample files from scoped storage
 */
export function loadScopedFiles(): SongFile[] {
  try {
    const raw = localStorage.getItem(SONGS_STORAGE_KEY);
    if (!raw) {
      saveScopedFiles(INITIAL_DEMO_SONGS);
      return INITIAL_DEMO_SONGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load songs from scoped storage:', err);
  }
  return INITIAL_DEMO_SONGS;
}

/**
 * Save songs and sample files to scoped storage
 */
export function saveScopedFiles(files: SongFile[]): void {
  try {
    localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(files));
  } catch (err) {
    console.error('Failed to save songs to scoped storage:', err);
  }
}

/**
 * Add or update a song file in scoped storage
 */
export function saveSongToScopedStorage(song: SongFile): SongFile[] {
  const current = loadScopedFiles();
  const existingIdx = current.findIndex((f) => f.id === song.id || (f.name === song.name && f.folder === song.folder));
  let updated: SongFile[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...song, lastModified: Date.now() };
  } else {
    updated = [song, ...current];
  }
  saveScopedFiles(updated);
  return updated;
}

/**
 * Delete a song file from scoped storage
 */
export function deleteSongFromScopedStorage(id: string): SongFile[] {
  const current = loadScopedFiles();
  const updated = current.filter((f) => f.id !== id);
  saveScopedFiles(updated);
  return updated;
}

/**
 * Export current config as downloadable JSON file
 */
export function exportConfigFile(): void {
  const json = getScopedConfigJsonString();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.json';
  a.click();
  URL.revokeObjectURL(url);
}
