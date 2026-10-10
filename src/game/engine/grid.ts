import { footprint, MODULES } from '../content/modules';
import type { GameState, ModuleInstance, ModuleType, Rotation } from './types';

export interface Cell {
  x: number;
  y: number;
}

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Default 10 × 10 hull: a rounded hull with tapered bow and stern. '#' = buildable. */
export const DEFAULT_HULL = [
  '..######..',
  '.########.',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '.########.',
  '..######..',
];

/** Builds a hull mask of any size with the same tapered corners. */
export function makeHull(width: number, height: number): string[] {
  if (width === 10 && height === 10) return [...DEFAULT_HULL];
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const dy = Math.min(y, height - 1 - y);
      const dx = Math.min(x, width - 1 - x);
      row += dx + dy < 2 ? '.' : '#';
    }
    rows.push(row);
  }
  return rows;
}

export function isHull(state: Pick<GameState, 'grid'>, x: number, y: number): boolean {
  const { width, height, hull } = state.grid;
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return hull[y]?.[x] === '#';
}

/** A hull cell that touches open space. Airlocks and radiators must sit on one. */
export function isHullEdge(state: Pick<GameState, 'grid'>, x: number, y: number): boolean {
  if (!isHull(state, x, y)) return false;
  return !isHull(state, x + 1, y) || !isHull(state, x - 1, y) || !isHull(state, x, y + 1) || !isHull(state, x, y - 1);
}

export function moduleCells(m: Pick<ModuleInstance, 'type' | 'x' | 'y' | 'rotation'>): Cell[] {
  const { w, h } = footprint(m.type, m.rotation);
  const cells: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push({ x: m.x + dx, y: m.y + dy });
  return cells;
}

export function occupancy(state: Pick<GameState, 'modules'>): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of Object.values(state.modules)) for (const c of moduleCells(m)) map.set(cellKey(c.x, c.y), m.id);
  return map;
}

export function moduleAt(state: Pick<GameState, 'modules'>, x: number, y: number): ModuleInstance | null {
  for (const m of Object.values(state.modules)) {
    const { w, h } = footprint(m.type, m.rotation);
    if (x >= m.x && x < m.x + w && y >= m.y && y < m.y + h) return m;
  }
  return null;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export interface Topology {
  occ: Map<string, string>;
  /** Module id → ids of modules sharing a wall */
  neighbours: Map<string, string[]>;
}

export function topology(state: Pick<GameState, 'modules'>): Topology {
  const occ = occupancy(state);
  const neighbours = new Map<string, string[]>();
  const ids = Object.keys(state.modules).sort();
  for (const id of ids) {
    const m = state.modules[id];
    const set = new Set<string>();
    for (const c of moduleCells(m)) {
      for (const [dx, dy] of DIRS) {
        const other = occ.get(cellKey(c.x + dx, c.y + dy));
        if (other && other !== id) set.add(other);
      }
    }
    neighbours.set(id, [...set].sort());
  }
  return { occ, neighbours };
}

/** Connected components over modules, optionally skipping some (e.g. broken ones). */
export function components(state: Pick<GameState, 'modules'>, topo: Topology, include: (m: ModuleInstance) => boolean = () => true): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];
  for (const id of Object.keys(state.modules).sort()) {
    if (seen.has(id) || !include(state.modules[id])) continue;
    const comp: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of topo.neighbours.get(cur) ?? []) {
        if (!seen.has(n) && include(state.modules[n])) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    result.push(comp.sort());
  }
  return result;
}

/** Chebyshev distance between module footprints, in cells. */
export function moduleDistance(a: ModuleInstance, b: ModuleInstance): number {
  const fa = footprint(a.type, a.rotation);
  const fb = footprint(b.type, b.rotation);
  const dx = Math.max(0, a.x - (b.x + fb.w - 1), b.x - (a.x + fa.w - 1));
  const dy = Math.max(0, a.y - (b.y + fb.h - 1), b.y - (a.y + fa.h - 1));
  return Math.max(dx, dy);
}

export type PlacementError =
  | 'out_of_hull'
  | 'occupied'
  | 'not_connected'
  | 'needs_hull_edge'
  | 'needs_research'
  | 'max_count'
  | 'cannot_afford';

export interface PlacementCheck {
  valid: boolean;
  error: PlacementError | null;
  cells: (Cell & { ok: boolean })[];
}

export function checkPlacement(state: GameState, type: ModuleType, x: number, y: number, rotation: Rotation, ignoreCost = false): PlacementCheck {
  const def = MODULES[type];
  const cells = moduleCells({ type, x, y, rotation });
  const occ = occupancy(state);
  const marked = cells.map((c) => ({ ...c, ok: isHull(state, c.x, c.y) && !occ.has(cellKey(c.x, c.y)) }));
  const fail = (error: PlacementError): PlacementCheck => ({ valid: false, error, cells: marked });

  if (cells.some((c) => !isHull(state, c.x, c.y))) return fail('out_of_hull');
  if (cells.some((c) => occ.has(cellKey(c.x, c.y)))) return fail('occupied');
  if (def.research && !state.research.completed.includes(def.research)) return fail('needs_research');
  const existing = Object.values(state.modules).filter((m) => m.type === type).length;
  if (existing >= def.maxCount) return fail('max_count');
  if (def.placement === 'hullEdge' && !cells.some((c) => isHullEdge(state, c.x, c.y))) return fail('needs_hull_edge');
  if (Object.keys(state.modules).length > 0) {
    const touches = cells.some((c) => DIRS.some(([dx, dy]) => occ.has(cellKey(c.x + dx, c.y + dy))));
    if (!touches) return fail('not_connected');
  }
  if (!ignoreCost && (state.resources.materials < def.cost.materials || state.resources.credits < def.cost.credits)) return fail('cannot_afford');
  return { valid: true, error: null, cells: marked };
}

/** Removing this module would split the ship into separate pieces. */
export function wouldDisconnect(state: GameState, moduleId: string): boolean {
  const remaining = { modules: { ...state.modules } };
  delete remaining.modules[moduleId];
  if (Object.keys(remaining.modules).length <= 1) return false;
  return components(remaining, topology(remaining)).length > 1;
}
