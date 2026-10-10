import { TICK_SECONDS } from '@/game/engine/constants';
import { createModule, initializeNewGame } from '@/game/engine/newGame';
import { tick } from '@/game/engine/step';
import { computeCapacity } from '@/game/systems/resources';
import type { GameState, ModuleType, Rotation } from '@/game/engine/types';

/** A fresh campaign state. */
export const newGame = (seed = 1) => initializeNewGame({ seed });

/** A minimal ship: one healthy reactor and whatever modules are added, no anomalies. */
export function bareShip(extra: [ModuleType, number, number, Rotation?, Record<string, unknown>?][] = []): GameState {
  const s = initializeNewGame({ seed: 7 });
  s.modules = {};
  s.anomalies = [];
  s.nextId = 1;
  s.events.nextCheck = 1e9;
  const add = (type: ModuleType, x: number, y: number, rotation: Rotation = 0, props: Record<string, unknown> = {}) => {
    const id = `m${s.nextId++}`;
    s.modules[id] = createModule(id, type, x, y, rotation, props);
    return id;
  };
  add('reactor', 4, 4, 0, { temperature: 40 });
  for (const [type, x, y, r, p] of extra) add(type, x, y, r ?? 0, p ?? {});
  s.capacity = computeCapacity(s);
  return s;
}

export function run(s: GameState, seconds: number) {
  const n = Math.round(seconds / TICK_SECONDS);
  for (let i = 0; i < n; i++) tick(s, TICK_SECONDS);
  return s;
}

export const byType = (s: GameState, type: ModuleType) => Object.values(s.modules).filter((m) => m.type === type);
export const first = (s: GameState, type: ModuleType) => byType(s, type)[0];
