import type { ModuleType, PartialResources, ResourceId } from '../engine/types';

export type ModuleCategory = 'power' | 'life' | 'production' | 'research' | 'utility' | 'structure' | 'defense' | 'echo';
export type Placement = 'interior' | 'hullEdge';

export interface ModuleDef {
  type: ModuleType;
  category: ModuleCategory;
  size: { w: number; h: number };
  /** Power per minute: positive = produced, negative = consumed */
  power: number;
  /** 1 = life support (served first) … 4 = luxury (shed first) */
  priority: 1 | 2 | 3 | 4;
  inputs: PartialResources;
  outputs: PartialResources;
  /** Heat generated while operating, °C per minute */
  heat: number;
  /** Active cooling while operating, °C per minute (applied to self, half to neighbours) */
  cooling: number;
  capacity: PartialResources & { crew?: number };
  cost: { materials: number; credits: number };
  buildSeconds: number;
  research: string | null;
  maxLevel: number;
  maxCount: number;
  placement: Placement;
  /** Normal operating range. Outside it the module shuts down. */
  minTemp: number;
  maxTemp: number;
  /** Wear per minute while operating */
  wear: number;
  /** Organic modules feed the Lumen Bloom */
  organic: boolean;
  /** Visual accent: which palette colour the module's lights use */
  accent: 'cyan' | 'teal' | 'amber' | 'violet' | 'green' | 'steel';
}

const def = (d: Omit<ModuleDef, 'maxLevel' | 'minTemp' | 'maxTemp' | 'wear' | 'organic' | 'placement' | 'capacity' | 'inputs' | 'outputs' | 'cooling' | 'research' | 'maxCount'> & Partial<ModuleDef>): ModuleDef => ({
  maxLevel: 3,
  minTemp: -40,
  maxTemp: 55,
  wear: 0.05,
  organic: false,
  placement: 'interior',
  capacity: {},
  inputs: {},
  outputs: {},
  cooling: 0,
  research: null,
  maxCount: 99,
  ...d,
});

export const MODULES: Record<ModuleType, ModuleDef> = {
  reactor: def({
    type: 'reactor', category: 'power', size: { w: 2, h: 2 }, power: 60, priority: 1, heat: 30,
    capacity: { power: 40 }, cost: { materials: 120, credits: 60 }, buildSeconds: 30, maxTemp: 90, wear: 0.12, maxCount: 2, accent: 'amber',
  }),
  oxygen: def({
    type: 'oxygen', category: 'life', size: { w: 1, h: 2 }, power: -12, priority: 1, heat: 6,
    inputs: { water: 2 }, outputs: { oxygen: 10 }, capacity: { oxygen: 50 }, cost: { materials: 30, credits: 0 }, buildSeconds: 12, accent: 'cyan',
  }),
  hydroponics: def({
    type: 'hydroponics', category: 'production', size: { w: 2, h: 2 }, power: -8, priority: 2, heat: 5,
    inputs: { water: 3 }, outputs: { food: 6, oxygen: 2 }, capacity: { food: 30 }, cost: { materials: 45, credits: 10 }, buildSeconds: 16,
    minTemp: 12, maxTemp: 40, organic: true, accent: 'green',
  }),
  quarters: def({
    type: 'quarters', category: 'life', size: { w: 2, h: 1 }, power: -4, priority: 2, heat: 7,
    capacity: { crew: 2 }, cost: { materials: 35, credits: 0 }, buildSeconds: 12, organic: true, accent: 'amber',
  }),
  lab: def({
    type: 'lab', category: 'research', size: { w: 2, h: 2 }, power: -14, priority: 3, heat: 7,
    outputs: { research: 3 }, cost: { materials: 60, credits: 30 }, buildSeconds: 20, organic: true, accent: 'violet',
  }),
  storage: def({
    type: 'storage', category: 'utility', size: { w: 1, h: 1 }, power: -1, priority: 4, heat: 4,
    capacity: { materials: 100, food: 60, water: 60, power: 60 }, cost: { materials: 20, credits: 0 }, buildSeconds: 8, organic: true, accent: 'steel',
  }),
  airlock: def({
    type: 'airlock', category: 'structure', size: { w: 1, h: 1 }, power: -3, priority: 2, heat: 2,
    cost: { materials: 40, credits: 10 }, buildSeconds: 14, placement: 'hullEdge', maxCount: 2, wear: 0.08, accent: 'cyan',
  }),
  corridor: def({
    type: 'corridor', category: 'structure', size: { w: 1, h: 1 }, power: 0, priority: 4, heat: 4,
    cost: { materials: 5, credits: 0 }, buildSeconds: 3, maxLevel: 1, wear: 0.01, accent: 'teal',
  }),
  workshop: def({
    type: 'workshop', category: 'utility', size: { w: 2, h: 1 }, power: -10, priority: 3, heat: 8,
    outputs: { materials: 1.5 }, cost: { materials: 50, credits: 20 }, buildSeconds: 18, accent: 'amber',
  }),
  shield: def({
    type: 'shield', category: 'defense', size: { w: 2, h: 2 }, power: -16, priority: 2, heat: 9,
    cost: { materials: 90, credits: 60 }, buildSeconds: 26, research: 'eng_shield_harmonics', maxCount: 2, accent: 'cyan',
  }),
  recycler: def({
    type: 'recycler', category: 'life', size: { w: 1, h: 2 }, power: -8, priority: 1, heat: 6,
    outputs: { water: 5 }, capacity: { water: 40 }, cost: { materials: 35, credits: 0 }, buildSeconds: 12, accent: 'teal',
  }),
  radiator: def({
    type: 'radiator', category: 'utility', size: { w: 1, h: 1 }, power: -2, priority: 1, heat: 0, cooling: 14,
    cost: { materials: 25, credits: 0 }, buildSeconds: 8, placement: 'hullEdge', research: 'eng_radiators', maxTemp: 80, accent: 'teal',
  }),
  containment: def({
    type: 'containment', category: 'defense', size: { w: 1, h: 1 }, power: -10, priority: 2, heat: 6,
    cost: { materials: 55, credits: 40 }, buildSeconds: 16, research: 'xeno_containment', accent: 'violet',
  }),
  condenser: def({
    type: 'condenser', category: 'echo', size: { w: 1, h: 1 }, power: -6, priority: 3, heat: 5,
    cost: { materials: 60, credits: 50 }, buildSeconds: 18, research: 'echo_condenser', accent: 'violet',
  }),
};

export const MODULE_TYPES = Object.keys(MODULES) as ModuleType[];

/** Build-menu order */
export const BUILD_ORDER: ModuleType[] = [
  'corridor', 'oxygen', 'recycler', 'hydroponics', 'quarters', 'storage', 'lab', 'workshop',
  'reactor', 'airlock', 'radiator', 'shield', 'containment', 'condenser',
];

/** Output and power multiplier per upgrade level. */
export const levelMultiplier = (level: number) => 1 + 0.35 * (level - 1);

export function upgradeCost(type: ModuleType, currentLevel: number): { materials: number; credits: number } {
  const base = MODULES[type].cost;
  const f = currentLevel === 1 ? 0.8 : 1.4;
  return { materials: Math.round(base.materials * f), credits: Math.round(base.credits * f + 20 * currentLevel) };
}

/** Level 3 needs Modular Upgrades research. */
export const UPGRADE_RESEARCH: Record<number, string | null> = { 2: null, 3: 'eng_modular_upgrades' };

export function footprint(type: ModuleType, rotation: 0 | 1): { w: number; h: number } {
  const { w, h } = MODULES[type].size;
  return rotation === 1 ? { w: h, h: w } : { w, h };
}

export const DISMANTLE_REFUND = 0.5;

export function isResourceOutput(type: ModuleType, r: ResourceId): boolean {
  return (MODULES[type].outputs[r] ?? 0) > 0;
}
