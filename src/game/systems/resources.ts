/**
 * Resource production, consumption and life support.
 *
 * Sources: module outputs (scaled by level, condition, anomalies, captain level).
 * Sinks: module inputs, crew breathing and eating, Lumen Bloom respiration, hull breaches and
 * low hull integrity (leaks).
 * A module whose inputs can't be paid this tick goes offline with "no_input".
 */
import { CREW_NEEDS, BASE_CAPACITY } from '../engine/constants';
import { MODULES, levelMultiplier } from '../content/modules';
import { captainBonus, clamp, hasModifier, hasResearch, tidy } from '../engine/helpers';
import { RESOURCE_IDS, type GameState, type ModuleInstance, type ResourceId, type ResourceMap } from '../engine/types';
import { echoIntensity, resonance } from './echo';

export function computeCapacity(s: GameState): ResourceMap {
  const cap: ResourceMap = { ...BASE_CAPACITY };
  for (const m of Object.values(s.modules)) {
    if (m.buildRemaining > 0) continue;
    const def = MODULES[m.type];
    for (const r of RESOURCE_IDS) {
      const add = def.capacity[r];
      if (add) cap[r] += add * levelMultiplier(m.level);
    }
  }
  return cap;
}

export function crewCapacity(s: GameState): number {
  return Object.values(s.modules)
    .filter((m) => m.type === 'quarters' && m.buildRemaining <= 0 && m.condition >= 10)
    .reduce((sum, m) => sum + (MODULES.quarters.capacity.crew ?? 0) + (m.level - 1), 0);
}

/** Output multiplier for a module this tick: level × condition × anomalies × echoes × bonuses. */
export function outputMultiplier(s: GameState, m: ModuleInstance): number {
  let f = levelMultiplier(m.level) * m.efficiency * captainBonus(s);
  for (const a of s.anomalies) {
    if (a.moduleId !== m.id) continue;
    if (a.kind === 'bloom') {
      if (a.exploited && m.type === 'hydroponics') f *= 1 + a.intensity / 200;
      else if (!a.exploited) f *= 1 - a.intensity / 200;
    }
    if (a.kind === 'frost' && !a.exploited) f *= 1 - a.intensity / 300;
  }
  if (m.type === 'hydroponics') {
    const c = echoIntensity(s, m, 'contamination');
    if (c > 0) f *= hasResearch(s, 'xeno_symbiosis') ? 1 + c / 200 : 1 - c / 200;
  }
  if (m.type === 'lab') f *= 1 + resonance(s) / 400;
  return Math.max(0, f);
}

export function updateResources(s: GameState, dtMin: number) {
  const prod: Record<ResourceId, number> = { power: 0, oxygen: 0, food: 0, water: 0, research: 0, materials: 0, credits: 0 };
  const cons: Record<ResourceId, number> = { ...prod };

  const mods = Object.values(s.modules)
    .filter((m) => m.online)
    .sort((a, b) => MODULES[a.type].priority - MODULES[b.type].priority || (a.id < b.id ? -1 : 1));

  for (const m of mods) {
    const def = MODULES[m.type];
    const scale = levelMultiplier(m.level);
    // Pay inputs first. A module that can't pay stays offline this tick.
    const inputs = Object.entries(def.inputs) as [ResourceId, number][];
    const affordable = inputs.every(([r, v]) => s.resources[r] >= v * scale * dtMin - 1e-9);
    if (!affordable) {
      m.online = false;
      m.offlineReason = 'no_input';
      m.efficiency = 0;
      continue;
    }
    for (const [r, v] of inputs) {
      s.resources[r] = Math.max(0, s.resources[r] - v * scale * dtMin);
      cons[r] += v * scale;
    }
    const mult = outputMultiplier(s, m);
    for (const [r, v] of Object.entries(def.outputs) as [ResourceId, number][]) {
      prod[r] += v * mult;
      s.resources[r] += v * mult * dtMin;
    }
  }

  // Crew aboard breathe and eat.
  const aboard = s.crew.filter((c) => !c.away).length;
  const ration = hasModifier(s, 'rationing') ? 0.7 : 1;
  let oxygenLoss = aboard * CREW_NEEDS.oxygenPerMinute * ration;
  const food = aboard * CREW_NEEDS.foodPerMinute * ration;

  // Lumen Bloom respiration
  for (const a of s.anomalies) if (a.kind === 'bloom' && !a.exploited) oxygenLoss += a.intensity * 0.02;

  // Breaches vent oxygen unless the module is sealed by quarantine.
  for (const m of Object.values(s.modules)) if (m.breached && !m.quarantined) oxygenLoss += 8;

  // Low hull integrity leaks
  if (s.hull < 30) oxygenLoss += ((30 - s.hull) / 30) * 4;

  cons.oxygen += oxygenLoss;
  cons.food += food;
  s.resources.oxygen -= oxygenLoss * dtMin;
  s.resources.food -= food * dtMin;

  for (const r of RESOURCE_IDS) {
    if (r === 'power') continue;
    s.resources[r] = tidy(clamp(s.resources[r], 0, s.capacity[r]));
    s.flows[r] = { production: tidy(prod[r]), consumption: tidy(cons[r]) };
  }
}
