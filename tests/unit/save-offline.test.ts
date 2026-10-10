import { OFFLINE, SCHEMA_VERSION } from '@/game/engine/constants';
import { GameEngine } from '@/game/engine/GameEngine';
import { clampElapsed, simulateOffline } from '@/game/engine/offline';
import { validateGameState } from '@/game/engine/validate';
import { migrate } from '@/persistence/migrations';
import { SaveManager, SAVE_FORMAT } from '@/persistence/saveManager';
import { MemoryStorage } from '@/persistence/storage';
import { newGame, run } from '../helpers';

describe('save system', () => {
  it('round-trips the authoritative state', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const s = run(newGame(3), 30);
    expect(await saves.save(1, s, 1000)).toEqual({ ok: true });
    const loaded = await saves.load(1);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state).toEqual(s);
      expect(loaded.savedAt).toBe(1000);
      expect(loaded.fromBackup).toBe(false);
    }
    expect(storage.files.has('slot1.tmp')).toBe(false);
  });

  it('falls back to the backup when the main file is corrupt', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    await saves.save(1, newGame(1), 1);
    await saves.save(1, run(newGame(1), 10), 2);
    storage.files.set('slot1.json', '{"format":"echo-station-save","state":{"trunc');
    const loaded = await saves.load(1);
    expect(loaded).toMatchObject({ ok: true, fromBackup: true, savedAt: 1 });
  });

  it('reports corruption when nothing is readable', async () => {
    const storage = new MemoryStorage();
    storage.files.set('slot2.json', 'not json');
    const saves = new SaveManager(storage);
    expect(await saves.load(2)).toEqual({ ok: false, reason: 'corrupt' });
    expect(await saves.load(3)).toEqual({ ok: false, reason: 'missing' });
    expect(await saves.peek(2)).toEqual({ status: 'corrupt' });
  });

  it('never overwrites a good save with an invalid state', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    await saves.save(1, newGame(1), 1);
    const broken = { ...newGame(1), modules: {} };
    expect(await saves.save(1, broken, 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(await saves.load(1)).toMatchObject({ ok: true, savedAt: 1 });
  });

  it('migrates a version 1 save', async () => {
    const v1 = JSON.parse(JSON.stringify(newGame(5))) as Record<string, unknown>;
    v1.schemaVersion = 1;
    delete v1.disposition;
    delete v1.counters;
    (v1.events as Record<string, unknown>).modifiers = undefined;
    const storage = new MemoryStorage();
    storage.files.set('slot1.json', JSON.stringify({ format: SAVE_FORMAT, savedAt: 9, appVersion: '0.9', summary: {}, state: v1 }));
    const loaded = await new SaveManager(storage).load(1);
    expect(loaded).toMatchObject({ ok: true, migratedFrom: 1 });
    if (loaded.ok) {
      expect(loaded.state.schemaVersion).toBe(SCHEMA_VERSION);
      expect(loaded.state.disposition).toEqual({ containment: 0, symbiosis: 0, resonance: 0 });
      expect(loaded.state.events.modifiers).toEqual([]);
    }
  });

  it('refuses saves from a newer version instead of damaging them', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toEqual({ ok: false, reason: 'newer' });
    expect(migrate({})).toEqual({ ok: false, reason: 'unknown_version' });
  });

  it('validation repairs bad values and rejects broken structure', () => {
    const s = JSON.parse(JSON.stringify(newGame(1)));
    s.resources.oxygen = null;
    s.resources.food = -40;
    s.hull = 'abc';
    s.modules.m1.condition = 900;
    const v = validateGameState(s);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.state.resources.oxygen).toBe(0);
      expect(v.state.resources.food).toBe(0);
      expect(v.state.hull).toBe(50);
      expect(v.state.modules.m1.condition).toBe(100);
    }
    expect(validateGameState({ hello: 1 }).ok).toBe(false);
    expect(validateGameState(null).ok).toBe(false);
  });

  it('drops overlapping modules from a tampered save', () => {
    const s = JSON.parse(JSON.stringify(newGame(1)));
    s.modules.zz = { ...s.modules.m1, id: 'zz' };
    const v = validateGameState(s);
    expect(v.ok && v.state.modules.zz).toBeFalsy();
    expect(v.ok && v.repairs.some((r) => r.includes('overlapping'))).toBe(true);
  });
});

describe('offline progression', () => {
  it('clamps elapsed time: negative gaps (clock changes) count as zero, long gaps are capped', () => {
    expect(clampElapsed(10_000, 5_000)).toEqual({ seconds: 0, capped: 0 });
    expect(clampElapsed(0, NaN)).toEqual({ seconds: 0, capped: 0 });
    const day = clampElapsed(0, 24 * 3600 * 1000);
    expect(day.seconds).toBe(OFFLINE.maxSeconds);
    expect(day.capped).toBe(24 * 3600 - OFFLINE.maxSeconds);
  });

  it('ignores very short gaps', () => {
    const s = newGame();
    expect(simulateOffline(s, 10).summary).toBeNull();
  });

  it('a long absence never destroys the ship and runs in bounded time', () => {
    const s = newGame();
    const t0 = Date.now();
    const { state, summary } = simulateOffline(s, OFFLINE.maxSeconds);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(state.gameOver).toBeNull();
    expect(state.resources.oxygen).toBeGreaterThanOrEqual(state.capacity.oxygen * OFFLINE.floors.oxygen - 1e-6);
    expect(state.hull).toBeGreaterThanOrEqual(OFFLINE.floors.hull);
    expect(state.crew.every((c) => c.health >= OFFLINE.floors.health)).toBe(true);
    expect(state.events.active).toBeNull();
    expect(summary?.seconds).toBe(OFFLINE.maxSeconds);
    expect(state.time).toBeCloseTo(s.time + OFFLINE.maxSeconds, 0);
    // The input is not mutated.
    expect(s.time).toBe(0);
  });

  it('applies production and finishes construction while away', () => {
    const e = new GameEngine(newGame());
    e.executeCommand({ type: 'PlaceModule', moduleType: 'oxygen', x: 5, y: 2, rotation: 0 });
    const summary = e.applyOffline(600);
    expect(summary?.buildsCompleted).toBe(1);
    expect(e.getSnapshot().modules.m15?.buildRemaining ?? 0).toBe(0);
  });
});

describe('save concurrency', () => {
  it('overlapping saves to one slot are serialised and the last one wins', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const results = await Promise.all([saves.save(1, newGame(1), 1), saves.save(1, run(newGame(1), 5), 2), saves.save(1, run(newGame(1), 9), 3)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await saves.load(1)).toMatchObject({ ok: true, savedAt: 3 });
    expect(storage.files.has('slot1.tmp')).toBe(false);
  });
});
