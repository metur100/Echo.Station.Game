/**
 * Save slots. A save is an envelope { format, savedAt, summary, state } written safely:
 *
 *   1. serialise and validate in memory (never write a state that fails validation)
 *   2. write slotN.tmp, read it back and validate the copy
 *   3. keep the previous good save as slotN.bak
 *   4. atomically replace slotN.json with the tmp file
 *
 * Loading tries the main file, then the backup. Older schemas are migrated; newer ones are
 * refused (the player updates the app instead of losing data).
 */
import { currentChapter } from '../game/systems/progression';
import { validateGameState } from '../game/engine/validate';
import type { GameState } from '../game/engine/types';
import { migrate } from './migrations';
import type { SaveStorage } from './storage';

export const SAVE_FORMAT = 'echo-station-save';
export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

export interface SaveSummary {
  chapter: number;
  time: number;
  captainLevel: number;
  hull: number;
  crew: number;
  modules: number;
  ending: string | null;
  gameOver: boolean;
}

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  savedAt: number;
  appVersion: string;
  summary: SaveSummary;
  state: GameState;
}

export type LoadResult =
  | { ok: true; state: GameState; savedAt: number; fromBackup: boolean; migratedFrom: number | null; repairs: string[] }
  | { ok: false; reason: 'missing' | 'corrupt' | 'newer' };

const main = (slot: Slot) => `slot${slot}.json`;
const tmp = (slot: Slot) => `slot${slot}.tmp`;
const bak = (slot: Slot) => `slot${slot}.bak`;

export function summarize(s: GameState): SaveSummary {
  return {
    chapter: currentChapter(s),
    time: Math.floor(s.time),
    captainLevel: s.captain.level,
    hull: Math.round(s.hull),
    crew: s.crew.length,
    modules: Object.keys(s.modules).length,
    ending: s.ending?.id ?? null,
    gameOver: !!s.gameOver,
  };
}

function parseEnvelope(text: string | null): { ok: true; env: SaveEnvelope; state: GameState; migratedFrom: number | null; repairs: string[] } | { ok: false; reason: 'missing' | 'corrupt' | 'newer' } {
  if (text === null) return { ok: false, reason: 'missing' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!raw || typeof raw !== 'object' || (raw as SaveEnvelope).format !== SAVE_FORMAT || typeof (raw as SaveEnvelope).state !== 'object') return { ok: false, reason: 'corrupt' };
  const env = raw as SaveEnvelope;
  const m = migrate(env.state as unknown as Record<string, unknown>);
  if (!m.ok) return { ok: false, reason: m.reason === 'newer' ? 'newer' : 'corrupt' };
  const v = validateGameState(m.state);
  if (!v.ok) return { ok: false, reason: 'corrupt' };
  return { ok: true, env, state: v.state, migratedFrom: m.migratedFrom, repairs: v.repairs };
}

export class SaveManager {
  /** Saves run one at a time so an autosave and a background save never share the tmp file. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private storage: SaveStorage,
    private appVersion = '1.0.0',
  ) {}

  save(slot: Slot, state: GameState, now = Date.now()): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'io' }> {
    const run = this.queue.then(() => this.saveNow(slot, state, now));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async saveNow(slot: Slot, state: GameState, now: number): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'io' }> {
    const env: SaveEnvelope = { format: SAVE_FORMAT, savedAt: now, appVersion: this.appVersion, summary: summarize(state), state };
    let text: string;
    try {
      text = JSON.stringify(env);
    } catch {
      return { ok: false, reason: 'invalid' };
    }
    // Validate a deep copy so validation's repairs never touch the live state.
    if (!parseEnvelope(text).ok) return { ok: false, reason: 'invalid' };
    try {
      await this.storage.write(tmp(slot), text);
      const check = parseEnvelope(await this.storage.read(tmp(slot)));
      if (!check.ok) {
        await this.storage.remove(tmp(slot));
        return { ok: false, reason: 'io' };
      }
      const previous = await this.storage.read(main(slot));
      if (previous !== null && parseEnvelope(previous).ok) await this.storage.write(bak(slot), previous);
      await this.storage.replace(tmp(slot), main(slot));
      return { ok: true };
    } catch {
      return { ok: false, reason: 'io' };
    }
  }

  async load(slot: Slot): Promise<LoadResult> {
    let primaryReason: 'missing' | 'corrupt' | 'newer' = 'missing';
    try {
      const primary = parseEnvelope(await this.storage.read(main(slot)));
      if (primary.ok) return { ok: true, state: primary.state, savedAt: primary.env.savedAt, fromBackup: false, migratedFrom: primary.migratedFrom, repairs: primary.repairs };
      primaryReason = primary.reason;
      if (primary.reason === 'newer') return { ok: false, reason: 'newer' };
      const backup = parseEnvelope(await this.storage.read(bak(slot)));
      if (backup.ok) return { ok: true, state: backup.state, savedAt: backup.env.savedAt, fromBackup: true, migratedFrom: backup.migratedFrom, repairs: backup.repairs };
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    return { ok: false, reason: primaryReason };
  }

  async peek(slot: Slot): Promise<{ status: 'empty' } | { status: 'corrupt' | 'newer' } | { status: 'ok'; savedAt: number; summary: SaveSummary }> {
    try {
      const text = await this.storage.read(main(slot));
      if (text === null) {
        const b = parseEnvelope(await this.storage.read(bak(slot)));
        return b.ok ? { status: 'ok', savedAt: b.env.savedAt, summary: summarize(b.state) } : { status: 'empty' };
      }
      const p = parseEnvelope(text);
      if (p.ok) return { status: 'ok', savedAt: p.env.savedAt, summary: summarize(p.state) };
      if (p.reason === 'newer') return { status: 'newer' };
      const b = parseEnvelope(await this.storage.read(bak(slot)));
      return b.ok ? { status: 'ok', savedAt: b.env.savedAt, summary: summarize(b.state) } : { status: 'corrupt' };
    } catch {
      return { status: 'corrupt' };
    }
  }

  async remove(slot: Slot) {
    await this.storage.remove(main(slot));
    await this.storage.remove(bak(slot));
    await this.storage.remove(tmp(slot));
  }
}
