import { create } from 'zustand';

import { FileStorage, type SaveStorage } from '../persistence/storage';

export interface Settings {
  music: number;
  sfx: number;
  haptics: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  pauseOnIncident: boolean;
  offlineProgress: boolean;
  autosave: boolean;
  /** Last played slot, for Continue */
  lastSlot: 1 | 2 | 3 | null;
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.5,
  sfx: 0.8,
  haptics: true,
  reducedMotion: false,
  largeText: false,
  pauseOnIncident: true,
  offlineProgress: true,
  autosave: true,
  lastSlot: null,
};

const FILE = 'settings.json';

/** Merge stored values over the defaults, ignoring anything of the wrong type. */
export function sanitizeSettings(input: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = src[key];
    const d = DEFAULT_SETTINGS[key];
    if (key === 'lastSlot') {
      if (v === 1 || v === 2 || v === 3 || v === null) out.lastSlot = v;
    } else if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      (out as unknown as Record<string, number>)[key] = Math.min(1, Math.max(0, v));
    } else if (typeof d === 'boolean' && typeof v === 'boolean') {
      (out as unknown as Record<string, boolean>)[key] = v;
    }
  }
  return out;
}

interface SettingsStore extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
}

let storage: SaveStorage = new FileStorage();
export function setSettingsStorage(s: SaveStorage) {
  storage = s;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const text = await storage.read(FILE);
      set({ ...sanitizeSettings(text ? JSON.parse(text) : null), loaded: true });
    } catch {
      set({ ...DEFAULT_SETTINGS, loaded: true });
    }
  },
  update: (patch) => {
    set(patch);
    const { loaded: _l, load: _a, update: _u, ...current } = get();
    storage.write(FILE, JSON.stringify(sanitizeSettings(current))).catch(() => undefined);
  },
}));
