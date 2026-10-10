/**
 * Save-state validation. Structural problems (missing sections, wrong types) reject the state;
 * value problems (NaN, out-of-range numbers, dangling references, overlapping modules) are
 * repaired and reported, so one bad number never costs the player their ship.
 */
import { MODULES } from '../content/modules';
import { SCHEMA_VERSION } from './constants';
import { cellKey, moduleCells } from './grid';
import { clamp } from './helpers';
import { EMPTY_STATS } from './newGame';
import { RESOURCE_IDS, type GameState } from './types';

export type ValidationResult = { ok: true; state: GameState; repairs: string[] } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function validateGameState(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['not an object'] };
  const required = ['schemaVersion', 'grid', 'modules', 'resources', 'crew', 'research', 'anomalies', 'echoes', 'events', 'expeditions', 'objectives'];
  for (const k of required) if (!(k in input)) errors.push(`missing ${k}`);
  if (errors.length) return { ok: false, errors };
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push(`schema ${String(input.schemaVersion)} != ${SCHEMA_VERSION}`);
  if (!isObj(input.grid) || !Array.isArray((input.grid as Record<string, unknown>).hull)) errors.push('bad grid');
  if (!isObj(input.modules)) errors.push('bad modules');
  if (!Array.isArray(input.crew) || input.crew.length === 0) errors.push('bad crew');
  if (!isObj(input.resources)) errors.push('bad resources');
  if (errors.length) return { ok: false, errors };

  const s = input as unknown as GameState;
  const repairs: string[] = [];
  const fix = (msg: string) => repairs.push(msg);

  s.time = Math.max(0, num(s.time, 0));
  s.tick = Math.max(0, Math.floor(num(s.tick, 0)));
  s.rng = num(s.rng, 1) >>> 0;
  s.nextId = Math.max(1, Math.floor(num(s.nextId, 1)));
  s.nextLogId = Math.max(1, Math.floor(num(s.nextLogId, 1)));
  s.layoutVersion = Math.max(1, Math.floor(num(s.layoutVersion, 1)));
  s.hull = clamp(num(s.hull, 50), 0, 100);
  s.temperature = num(s.temperature, 18);
  s.stats = { ...EMPTY_STATS, ...(isObj(s.stats) ? s.stats : {}) };
  s.flags = isObj(s.flags) ? s.flags : {};
  s.counters = isObj(s.counters) ? s.counters : {};
  s.achievements = isObj(s.achievements) ? s.achievements : {};
  s.disposition = { containment: 0, symbiosis: 0, resonance: 0, ...(isObj(s.disposition) ? s.disposition : {}) };
  s.captain = { xp: Math.max(0, num(s.captain?.xp, 0)), level: clamp(Math.floor(num(s.captain?.level, 1)), 1, 10) };
  s.log = Array.isArray(s.log) ? s.log.filter(isObj) as unknown as GameState['log'] : [];
  s.discoveredAnomalies = Array.isArray(s.discoveredAnomalies) ? s.discoveredAnomalies : [];
  if (!isObj(s.capacity)) s.capacity = { ...s.resources };
  if (!isObj(s.flows)) s.flows = Object.fromEntries(RESOURCE_IDS.map((r) => [r, { production: 0, consumption: 0 }])) as GameState['flows'];
  if (!isObj(s.power)) s.power = { supply: 0, demand: 0, shortage: false };

  // Modules: unknown types dropped, numbers clamped, overlaps resolved (later module dropped).
  const seen = new Set<string>();
  for (const [id, m] of Object.entries(s.modules)) {
    if (!isObj(m) || !MODULES[(m as { type: keyof typeof MODULES }).type]) {
      delete s.modules[id];
      fix(`dropped invalid module ${id}`);
      continue;
    }
    m.id = id;
    m.x = Math.floor(num(m.x, -1));
    m.y = Math.floor(num(m.y, -1));
    m.rotation = m.rotation === 1 ? 1 : 0;
    m.level = clamp(Math.floor(num(m.level, 1)), 1, MODULES[m.type].maxLevel);
    m.condition = clamp(num(m.condition, 50), 0, 100);
    m.temperature = clamp(num(m.temperature, 18), -60, 250);
    m.buildRemaining = Math.max(0, num(m.buildRemaining, 0));
    m.scars = Math.max(0, Math.floor(num(m.scars, 0)));
    m.enabled = m.enabled !== false;
    m.quarantined = m.quarantined === true;
    m.breached = m.breached === true;
    m.overheated = m.overheated === true;
    m.efficiency = num(m.efficiency, 0);
    m.powerFlow = num(m.powerFlow, 0);
    const cells = moduleCells(m);
    const outside = cells.some((c) => c.x < 0 || c.y < 0 || c.x >= s.grid.width || c.y >= s.grid.height);
    const overlap = cells.some((c) => seen.has(cellKey(c.x, c.y)));
    if (outside || overlap) {
      delete s.modules[id];
      fix(`dropped ${outside ? 'out-of-bounds' : 'overlapping'} module ${id}`);
      continue;
    }
    cells.forEach((c) => seen.add(cellKey(c.x, c.y)));
  }
  if (Object.keys(s.modules).length === 0) return { ok: false, errors: ['no modules'] };

  for (const r of RESOURCE_IDS) {
    const cap = Math.max(1, num(s.capacity[r], 100));
    s.capacity[r] = cap;
    const v = num(s.resources[r], 0);
    const c = clamp(v, 0, cap);
    if (c !== v) fix(`clamped ${r}`);
    s.resources[r] = c;
  }

  s.crew = s.crew.filter(isObj);
  for (const c of s.crew) {
    c.health = clamp(num(c.health, 50), 0, 100);
    c.morale = clamp(num(c.morale, 50), 0, 100);
    c.fatigue = clamp(num(c.fatigue, 0), 0, 100);
    c.taskProgress = clamp(num(c.taskProgress, 0), 0, 100);
    c.memories = Array.isArray(c.memories) ? c.memories : [];
    c.traits = Array.isArray(c.traits) ? c.traits : [];
    if (c.targetId && !s.modules[c.targetId] && !s.anomalies.some((a) => a.id === c.targetId) && c.task !== 'expedition_prep') {
      c.task = 'rest';
      c.targetId = null;
      fix(`reset task of ${c.id}`);
    }
  }
  if (s.crew.length === 0) return { ok: false, errors: ['no crew'] };

  const before = s.anomalies.length;
  s.anomalies = s.anomalies.filter((a) => isObj(a) && !!s.modules[a.moduleId]);
  for (const a of s.anomalies) {
    a.intensity = clamp(num(a.intensity, 0), 0, 100);
    a.pressure = clamp(num(a.pressure, 0), 0, 100);
  }
  if (s.anomalies.length !== before) fix('dropped orphan anomalies');
  s.echoes = s.echoes.filter(isObj);
  for (const e of s.echoes) e.intensity = clamp(num(e.intensity, 0), 0, 100);

  if (s.events.active && !isObj(s.events.active)) s.events.active = null;
  s.events.cooldowns = isObj(s.events.cooldowns) ? s.events.cooldowns : {};
  s.events.counts = isObj(s.events.counts) ? s.events.counts : {};
  s.events.modifiers = Array.isArray(s.events.modifiers) ? s.events.modifiers : [];
  s.events.nextCheck = num(s.events.nextCheck, s.time);

  if (s.expeditions.active) {
    const ex = s.expeditions.active;
    ex.elapsed = clamp(num(ex.elapsed, 0), 0, num(ex.duration, 60));
    if (!Array.isArray(ex.crewIds) || ex.crewIds.some((id) => !s.crew.some((c) => c.id === id))) {
      s.expeditions.active = null;
      for (const c of s.crew) c.away = false;
      fix('cancelled broken expedition');
    }
  } else {
    for (const c of s.crew) if (c.away) {
      c.away = false;
      fix(`returned stranded crew ${c.id}`);
    }
  }
  s.research.completed = Array.isArray(s.research.completed) ? s.research.completed : [];
  s.objectives.completed = Array.isArray(s.objectives.completed) ? s.objectives.completed : [];
  s.objectives.acknowledged = Array.isArray(s.objectives.acknowledged) ? s.objectives.acknowledged : [];

  return { ok: true, state: s, repairs };
}
