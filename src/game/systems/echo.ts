/**
 * Echo Memory. The ship remembers significant incidents as Echo traces anchored to grid cells.
 * Traces outlive the modules that were there and feed back into the other systems:
 *
 *  residual_energy  – left by reactor overloads and absorbed surges. Adds heat, accelerates the
 *                     Lumen Bloom, and at high intensity in a powered module wakes the Static Choir.
 *                     Echo Condensers harvest it into research.
 *  contamination    – left where a Lumen Bloom died or was purged. Slows hydroponics (or boosts it
 *                     with Symbiotic Cultures) and lets the Bloom regrow there.
 *  structural       – left by repeated damage to the same module. Doubles wear, can open hull
 *                     breaches; Lattice Alloys make it regenerate the module instead.
 *  resonance        – ship-wide memory of major decisions. Speeds Echo research and shapes endings.
 */
import { ECHO_CONSEQUENCE_LIMIT, ECHO_LIMIT } from '../engine/constants';
import { cellKey, moduleCells } from '../engine/grid';
import { clamp, hasResearch, log, newId, tidy } from '../engine/helpers';
import type { EchoKind, EchoTrace, GameState, ModuleInstance } from '../engine/types';

/** Decay per game minute */
export const ECHO_DECAY: Record<EchoKind, number> = {
  residual_energy: 1,
  contamination: 0.5,
  structural: 0,
  resonance: 0,
};

export interface CreateEchoOptions {
  kind: EchoKind;
  cells: { x: number; y: number }[];
  intensity: number;
  causeKey: string;
  causeParams?: Record<string, string | number>;
}

/**
 * Creates a trace, or reinforces an existing active trace of the same kind on the same cells.
 * Returns the trace.
 */
export function createEcho(s: GameState, opts: CreateEchoOptions): EchoTrace {
  const key = opts.cells.map((c) => cellKey(c.x, c.y)).sort().join('|');
  const existing = s.echoes.find((e) => !e.archived && e.kind === opts.kind && e.cells.map((c) => cellKey(c.x, c.y)).sort().join('|') === key);
  if (existing) {
    existing.intensity = clamp(existing.intensity + opts.intensity * 0.6, 0, 100);
    existing.peak = Math.max(existing.peak, existing.intensity);
    addConsequence(s, existing, 'echo.reinforced', { cause: opts.causeKey });
    return existing;
  }
  const trace: EchoTrace = {
    id: newId(s, 'e'),
    kind: opts.kind,
    cells: opts.cells.map((c) => ({ x: c.x, y: c.y })),
    intensity: clamp(opts.intensity, 0, 100),
    peak: clamp(opts.intensity, 0, 100),
    createdAt: Math.floor(s.time),
    causeKey: opts.causeKey,
    causeParams: opts.causeParams,
    consequences: [],
    harnessed: false,
    archived: false,
  };
  s.echoes.push(trace);
  s.stats.echoesCreated += 1;
  if (!s.flags.first_echo) s.flags.first_echo = true;
  log(s, { severity: 'warning', category: 'echo', key: 'log.echoCreated', params: { kind: opts.kind } });
  trimEchoes(s);
  return trace;
}

function trimEchoes(s: GameState) {
  if (s.echoes.length <= ECHO_LIMIT) return;
  // Drop the oldest archived traces first, then the faintest active ones.
  const archived = s.echoes.filter((e) => e.archived).sort((a, b) => a.createdAt - b.createdAt);
  while (s.echoes.length > ECHO_LIMIT && archived.length) {
    const drop = archived.shift()!;
    s.echoes = s.echoes.filter((e) => e !== drop);
  }
  if (s.echoes.length > ECHO_LIMIT) {
    s.echoes.sort((a, b) => b.intensity - a.intensity);
    s.echoes.length = ECHO_LIMIT;
  }
}

export function addConsequence(s: GameState, trace: EchoTrace, key: string, params?: Record<string, string | number>) {
  const last = trace.consequences[trace.consequences.length - 1];
  // The same consequence within a minute is one consequence, not spam.
  if (last && last.key === key && s.time - last.time < 60) return;
  trace.consequences.push({ time: Math.floor(s.time), key, params });
  if (trace.consequences.length > ECHO_CONSEQUENCE_LIMIT) trace.consequences.splice(0, trace.consequences.length - ECHO_CONSEQUENCE_LIMIT);
}

/** Strongest active trace of a kind that overlaps a module. */
export function echoOnModule(s: GameState, m: ModuleInstance, kind: EchoKind): EchoTrace | null {
  const cells = new Set(moduleCells(m).map((c) => cellKey(c.x, c.y)));
  let best: EchoTrace | null = null;
  for (const e of s.echoes) {
    if (e.archived || e.kind !== kind || e.cells.length === 0) continue;
    if (!e.cells.some((c) => cells.has(cellKey(c.x, c.y)))) continue;
    if (!best || e.intensity > best.intensity) best = e;
  }
  return best;
}

export const echoIntensity = (s: GameState, m: ModuleInstance, kind: EchoKind) => echoOnModule(s, m, kind)?.intensity ?? 0;

/** Ship-wide resonance from major decisions. */
export function resonance(s: GameState): number {
  return s.echoes.filter((e) => !e.archived && e.kind === 'resonance').reduce((sum, e) => sum + e.intensity, 0);
}

export function updateEchoes(s: GameState, dtMin: number) {
  const sterile = hasResearch(s, 'xeno_sterilization');
  for (const e of s.echoes) {
    if (e.archived) continue;
    let decay = ECHO_DECAY[e.kind];
    if (e.kind === 'contamination' && sterile) decay *= 3;
    if (e.kind === 'structural' && hasResearch(s, 'eng_lattice_alloys')) e.harnessed = true;
    if (e.kind === 'contamination' && hasResearch(s, 'xeno_symbiosis')) e.harnessed = true;
    if (decay > 0) e.intensity = tidy(clamp(e.intensity - decay * dtMin, 0, 100));
    if (e.intensity <= 0.01) {
      e.intensity = 0;
      e.archived = true;
      log(s, { severity: 'info', category: 'echo', key: 'log.echoFaded', params: { kind: e.kind } });
    }
  }
}

/** Reduce a trace (maintenance, condensers). Returns the amount removed. */
export function drainEcho(s: GameState, trace: EchoTrace, amount: number): number {
  const removed = Math.min(trace.intensity, amount);
  trace.intensity = tidy(trace.intensity - removed);
  if (trace.intensity <= 0.01) {
    trace.intensity = 0;
    trace.archived = true;
    log(s, { severity: 'success', category: 'echo', key: 'log.echoCleared', params: { kind: trace.kind } });
  }
  return removed;
}

/**
 * Echo Condensers drain residual energy from themselves and their neighbours and turn it into
 * research. A drained trace counts as harnessed while a condenser works on it.
 */
export function updateCondensers(s: GameState, neighbours: Map<string, string[]>, dtMin: number) {
  for (const c of Object.values(s.modules).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (c.type !== 'condenser' || !c.online) continue;
    const targets = [c.id, ...(neighbours.get(c.id) ?? [])];
    for (const id of targets) {
      const trace = echoOnModule(s, s.modules[id], 'residual_energy');
      if (!trace) continue;
      trace.harnessed = true;
      const removed = drainEcho(s, trace, 1.5 * c.efficiency * dtMin);
      s.resources.research = tidy(Math.min(s.capacity.research, s.resources.research + removed * 1.2));
      addConsequence(s, trace, 'echo.consequence.condensed', { module: s.modules[id].type });
    }
  }
}
