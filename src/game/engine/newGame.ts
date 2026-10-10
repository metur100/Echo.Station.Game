import { STARTING_CREW } from '../content/crew';
import { DEFAULT_GRID, SCHEMA_VERSION } from './constants';
import { makeHull } from './grid';
import { hashSeed } from './rng';
import { RESOURCE_IDS, type GameState, type ModuleInstance, type ModuleType, type Rotation, type Stats } from './types';
import { computeCapacity } from '../systems/resources';

export const EMPTY_STATS: Stats = {
  modulesBuilt: 0,
  modulesRemoved: 0,
  upgrades: 0,
  repairsDone: 0,
  anomaliesContained: 0,
  anomaliesExploited: 0,
  echoesCreated: 0,
  expeditions: 0,
  eventsResolved: 0,
  researchCompleted: 0,
  recoveries: 0,
  oxygenLowSeconds: 0,
  peakPower: 0,
};

type Seed = [ModuleType, number, number, Rotation, Partial<ModuleInstance>?];

/**
 * The ESV Meridian as the player finds it: a damaged reactor running hot, no oxygen generator,
 * and a sealed storage bay with something growing inside.
 */
export const STARTING_LAYOUT: Seed[] = [
  ['reactor', 4, 4, 0, { condition: 38, temperature: 64 }],
  ['recycler', 4, 2, 0, { condition: 70 }],
  ['corridor', 6, 4, 0],
  ['corridor', 6, 5, 0],
  ['corridor', 3, 5, 0],
  ['corridor', 4, 6, 0],
  ['corridor', 5, 6, 0, { condition: 62 }],
  ['corridor', 1, 5, 0],
  ['quarters', 7, 4, 0, { condition: 80 }],
  ['lab', 7, 5, 0, { condition: 70 }],
  ['storage', 2, 5, 0, { condition: 60, quarantined: true }],
  ['airlock', 0, 5, 0, { condition: 45 }],
  ['hydroponics', 4, 7, 0, { condition: 55 }],
];

export function createModule(id: string, type: ModuleType, x: number, y: number, rotation: Rotation, extra: Partial<ModuleInstance> = {}): ModuleInstance {
  return {
    id,
    type,
    x,
    y,
    rotation,
    level: 1,
    condition: 100,
    temperature: 18,
    enabled: true,
    buildRemaining: 0,
    quarantined: false,
    breached: false,
    scars: 0,
    overheated: false,
    powered: false,
    online: false,
    offlineReason: null,
    efficiency: 0,
    powerFlow: 0,
    ...extra,
  };
}

export interface NewGameOptions {
  seed?: number | string;
  width?: number;
  height?: number;
}

export function initializeNewGame(opts: NewGameOptions = {}): GameState {
  const seed = typeof opts.seed === 'string' ? hashSeed(opts.seed) : (opts.seed ?? 20261010) >>> 0;
  const width = opts.width ?? DEFAULT_GRID.width;
  const height = opts.height ?? DEFAULT_GRID.height;
  const zero = Object.fromEntries(RESOURCE_IDS.map((r) => [r, 0])) as GameState['resources'];
  const flows = Object.fromEntries(RESOURCE_IDS.map((r) => [r, { production: 0, consumption: 0 }])) as GameState['flows'];

  const s: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rng: seed,
    tick: 0,
    time: 0,
    grid: { width, height, hull: makeHull(width, height) },
    modules: {},
    layoutVersion: 1,
    nextId: 1,
    resources: { ...zero, power: 50, oxygen: 95, food: 45, water: 60, research: 10, materials: 120, credits: 50 },
    capacity: { ...zero },
    flows,
    hull: 72,
    temperature: 18,
    power: { supply: 0, demand: 0, shortage: false },
    crew: STARTING_CREW.map(({ health, morale, fatigue, ...c }) => ({
      ...c,
      health,
      morale,
      fatigue,
      task: 'rest' as const,
      targetId: null,
      taskProgress: 0,
      away: false,
      incapacitated: false,
      memories: [{ time: 0, key: 'memory.woke', morale: 0 }],
      joinedAt: 0,
    })),
    research: { completed: [], active: null },
    anomalies: [],
    discoveredAnomalies: [],
    echoes: [],
    events: { active: null, cooldowns: {}, counts: {}, nextCheck: 20, modifiers: [] },
    expeditions: { readiness: {}, active: null, completed: {}, lastOutcome: null },
    objectives: { completed: [], acknowledged: [] },
    captain: { xp: 0, level: 1 },
    achievements: {},
    disposition: { containment: 0, symbiosis: 0, resonance: 0 },
    flags: {},
    counters: {},
    log: [],
    nextLogId: 1,
    stats: { ...EMPTY_STATS },
    gameOver: null,
    ending: null,
  };

  const fits = (x: number, y: number) => x < width && y < height;
  for (const [type, x, y, rotation, extra] of STARTING_LAYOUT) {
    if (!fits(x, y)) continue;
    const id = `m${s.nextId++}`;
    s.modules[id] = createModule(id, type, x, y, rotation, extra);
  }
  const storage = Object.values(s.modules).find((m) => m.type === 'storage');
  if (storage) {
    s.anomalies.push({ id: `a${s.nextId++}`, kind: 'bloom', moduleId: storage.id, intensity: 18, pressure: 0, peak: 18, exploited: false, createdAt: 0, growth: 0 });
  }
  s.capacity = computeCapacity(s);
  s.log.push({ id: s.nextLogId++, time: 0, severity: 'info', category: 'story', key: 'story.chapter1' });
  return s;
}
