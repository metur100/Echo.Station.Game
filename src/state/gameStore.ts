/**
 * App-side game state. The GameEngine owns the authoritative simulation; this store holds the
 * latest immutable snapshot plus transient UI state (selection, build ghost, overlay, toasts).
 * Per-frame time goes to the engine, not to React: the store only publishes a new snapshot when
 * ticks actually ran.
 */
import { create } from 'zustand';

import { track } from '../analytics/analytics';
import { audio } from '../audio/audio';
import { haptic } from '../audio/haptics';
import { footprint } from '../game/content/modules';
import { checkPlacement, moduleAt } from '../game/engine/grid';
import { GameEngine } from '../game/engine/GameEngine';
import { clampElapsed, type OfflineSummary } from '../game/engine/offline';
import type { Command, CommandResult, GameState, ModuleType, Rotation } from '../game/engine/types';
import { currentObjective } from '../game/systems/progression';
import { t } from '../i18n';
import { SaveManager, type LoadResult, type Slot } from '../persistence/saveManager';
import { FileStorage } from '../persistence/storage';
import type { StatusTone } from '../theme/tokens';
import { processLog, type Toast } from './feedback';
import { useSettings } from './settingsStore';

export type Overlay = 'none' | 'power' | 'heat' | 'echo' | 'condition';
export type Speed = 1 | 2 | 4;

export interface BuildGhost {
  type: ModuleType;
  x: number;
  y: number;
  rotation: Rotation;
}

interface GameStore {
  engine: GameEngine | null;
  snapshot: GameState | null;
  slot: Slot;
  speed: Speed;
  paused: boolean;
  menuOpen: boolean;
  selectedId: string | null;
  build: BuildGhost | null;
  overlay: Overlay;
  toasts: Toast[];
  away: OfflineSummary | null;
  restoredBackup: boolean;
  lastSavedAt: number;
  lastLogId: number;

  startNew: (slot: Slot, seed?: number) => void;
  load: (slot: Slot) => Promise<LoadResult>;
  save: () => Promise<boolean>;
  unload: () => void;
  dispatch: (cmd: Command, opts?: { silent?: boolean }) => CommandResult | null;
  advance: (realSeconds: number) => void;
  applyAway: (seconds: number, capped?: number) => void;
  dismissAway: () => void;
  setSpeed: (s: Speed) => void;
  togglePause: () => void;
  setMenuOpen: (open: boolean) => void;
  select: (id: string | null) => void;
  startBuild: (type: ModuleType) => void;
  moveGhost: (x: number, y: number) => void;
  rotateGhost: () => void;
  confirmBuild: () => boolean;
  cancelBuild: () => void;
  setOverlay: (o: Overlay) => void;
  toast: (text: string, tone?: StatusTone) => void;
  dismissToast: (id: number) => void;
}

export const saveManager = new SaveManager(new FileStorage(), '1.0.0');
let toastId = 1;

/** The simulation is frozen while a menu is open, an incident waits for a decision, or the ship is lost. */
export function isFrozen(s: Pick<GameStore, 'paused' | 'menuOpen' | 'snapshot'>): boolean {
  if (s.paused || s.menuOpen || !s.snapshot) return true;
  if (s.snapshot.gameOver) return true;
  if (s.snapshot.events.active && useSettings.getState().pauseOnIncident) return true;
  return false;
}

/** Place the build ghost somewhere sensible: next to the selected module or the ship centre. */
function initialGhost(s: GameState, type: ModuleType): BuildGhost {
  const { w, h } = footprint(type, 0);
  let best: BuildGhost = { type, x: Math.floor(s.grid.width / 2), y: 1, rotation: 0 };
  let bestScore = -Infinity;
  const cx = s.grid.width / 2;
  const cy = s.grid.height / 2;
  for (let y = 0; y < s.grid.height; y++) {
    for (let x = 0; x < s.grid.width; x++) {
      for (const rotation of [0, 1] as Rotation[]) {
        const c = checkPlacement(s, type, x, y, rotation, true);
        if (!c.valid) continue;
        const score = -Math.hypot(x + w / 2 - cx, y + h / 2 - cy) - rotation * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = { type, x, y, rotation };
        }
      }
    }
  }
  return best;
}

export const useGame = create<GameStore>((set, get) => ({
  engine: null,
  snapshot: null,
  slot: 1,
  speed: 1,
  paused: false,
  menuOpen: false,
  selectedId: null,
  build: null,
  overlay: 'none',
  toasts: [],
  away: null,
  restoredBackup: false,
  lastSavedAt: 0,
  lastLogId: 0,

  startNew: (slot, seed) => {
    const engine = new GameEngine();
    engine.initializeNewGame({ seed: seed ?? (Date.now() >>> 0) });
    const snapshot = engine.getSnapshot();
    set({ engine, snapshot, slot, speed: 1, paused: false, menuOpen: false, selectedId: null, build: null, overlay: 'none', away: null, toasts: [], restoredBackup: false, lastLogId: snapshot.nextLogId });
    useSettings.getState().update({ lastSlot: slot });
    track('session_started', { mode: 'new' });
    track('tutorial_started');
    get().save().catch(() => undefined);
  },

  load: async (slot) => {
    const result = await saveManager.load(slot);
    if (!result.ok) return result;
    const engine = new GameEngine(result.state);
    set({ engine, snapshot: engine.getSnapshot(), slot, speed: 1, paused: false, menuOpen: false, selectedId: null, build: null, overlay: 'none', away: null, toasts: [], restoredBackup: result.fromBackup, lastSavedAt: result.savedAt, lastLogId: result.state.nextLogId });
    useSettings.getState().update({ lastSlot: slot });
    track('save_loaded', { migrated: result.migratedFrom ?? 0, backup: result.fromBackup });
    track('session_started', { mode: 'continue' });
    if (useSettings.getState().offlineProgress) {
      const { seconds, capped } = clampElapsed(result.savedAt, Date.now());
      get().applyAway(seconds, capped);
    }
    return result;
  },

  save: async () => {
    const { engine, slot } = get();
    if (!engine) return false;
    const now = Date.now();
    const r = await saveManager.save(slot, engine.getSnapshot(), now);
    if (r.ok) set({ lastSavedAt: now });
    else track('critical_error', { where: 'save', reason: r.reason });
    return r.ok;
  },

  unload: () => set({ engine: null, snapshot: null, selectedId: null, build: null, away: null, toasts: [] }),

  dispatch: (cmd, opts) => {
    const { engine } = get();
    if (!engine) return null;
    const r = engine.executeCommand(cmd);
    if (r.ok) {
      const snapshot = engine.getSnapshot();
      const fresh = snapshot.log.filter((l) => l.id >= get().lastLogId);
      set({ snapshot, lastLogId: snapshot.nextLogId });
      processLog(fresh, (x) => get().toast(x.text, x.tone));
    } else if (!opts?.silent) {
      audio.play('error');
      haptic('error');
      get().toast(t(r.error, r.params), 'warn');
    }
    return r;
  },

  advance: (realSeconds) => {
    const state = get();
    if (!state.engine || isFrozen(state)) return;
    const ticks = state.engine.updateSimulation(realSeconds, state.speed);
    if (ticks <= 0) return;
    const snapshot = state.engine.getSnapshot();
    const fresh = snapshot.log.filter((l) => l.id >= state.lastLogId);
    set({ snapshot, lastLogId: snapshot.nextLogId });
    if (fresh.length) processLog(fresh, (x) => get().toast(x.text, x.tone));
  },

  applyAway: (seconds, capped = 0) => {
    const { engine } = get();
    if (!engine) return;
    const summary = engine.applyOffline(seconds, capped);
    if (!summary) return;
    const snapshot = engine.getSnapshot();
    set({ snapshot, away: summary, lastLogId: snapshot.nextLogId });
  },

  dismissAway: () => set({ away: null }),

  setSpeed: (speed) => {
    audio.play('tap');
    set({ speed, paused: false });
  },
  togglePause: () => {
    audio.play('tap');
    set({ paused: !get().paused });
  },
  setMenuOpen: (menuOpen) => set({ menuOpen }),

  select: (id) => {
    const { snapshot } = get();
    if (id && snapshot) {
      audio.play('select');
      haptic('select');
      const m = snapshot.modules[id];
      const obj = currentObjective(snapshot);
      if (m?.type === 'reactor' && obj?.id === 'inspect_reactor') get().dispatch({ type: 'AcknowledgeObjective', objectiveId: 'inspect_reactor' }, { silent: true });
    }
    set({ selectedId: id });
  },

  startBuild: (type) => {
    const { snapshot } = get();
    if (!snapshot) return;
    audio.play('tap');
    set({ build: initialGhost(snapshot, type), selectedId: null });
  },

  moveGhost: (gx, gy) => {
    const b = get().build;
    const s = get().snapshot;
    if (!b || !s) return;
    const f = footprint(b.type, b.rotation);
    const x = Math.max(0, Math.min(s.grid.width - f.w, gx));
    const y = Math.max(0, Math.min(s.grid.height - f.h, gy));
    if (b.x === x && b.y === y) return;
    haptic('select');
    set({ build: { ...b, x, y } });
  },

  rotateGhost: () => {
    const b = get().build;
    if (!b) return;
    audio.play('tap');
    set({ build: { ...b, rotation: b.rotation === 0 ? 1 : 0 } });
  },

  confirmBuild: () => {
    const b = get().build;
    if (!b) return false;
    const r = get().dispatch({ type: 'PlaceModule', moduleType: b.type, x: b.x, y: b.y, rotation: b.rotation });
    if (r?.ok) {
      audio.play('place');
      haptic('medium');
      get().toast(t('build.placed', { module: b.type }), 'ok');
      const placed = moduleAt(r.state, b.x, b.y);
      set({ build: null, selectedId: placed?.id ?? null });
      return true;
    }
    return false;
  },

  cancelBuild: () => set({ build: null }),
  setOverlay: (overlay) => {
    audio.play('tap');
    set({ overlay });
  },

  toast: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
