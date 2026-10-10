/**
 * Simplified heat model, per module, per game minute:
 *
 *   dT = heat − cooling − passiveLoss·(T − ambient) + Σ conduction·(T_neighbour − T)
 *
 * heat:     the module's own heat while online (reactor heat scales with load and damage),
 *           plus residual-energy echoes and Static Choir activity.
 * cooling:  radiators cool themselves and, at half strength, their neighbours. Void Frost chills
 *           its module (or, harnessed by Cryo Lattice, cools neighbours safely).
 *
 * Above maxTemp a module takes damage. Above maxTemp + shutdownMargin it shuts down until it has
 * cooled below maxTemp. A reactor that shuts down from heat overloads: it scars, and leaves
 * residual energy in itself and every room around it.
 */
import { THERMAL } from '../engine/constants';
import { MODULES, levelMultiplier } from '../content/modules';
import { moduleCells, type Topology } from '../engine/grid';
import { clamp, log, tidy } from '../engine/helpers';
import type { GameState, ModuleInstance } from '../engine/types';
import { createEcho, echoIntensity } from './echo';
import { reactorLoad } from './power';
import { addScar } from './condition';

const HABITABLE = new Set(['quarters', 'lab', 'hydroponics', 'corridor', 'storage', 'workshop', 'oxygen', 'recycler']);

export function heatSources(s: GameState, m: ModuleInstance, load: number): number {
  const def = MODULES[m.type];
  let heat = 0;
  if (m.online) {
    if (m.type === 'reactor') {
      const damage = 1 + Math.max(0, 60 - m.condition) / 60;
      heat += def.heat * (0.4 + 0.6 * load) * damage * Math.sqrt(levelMultiplier(m.level));
    } else {
      heat += def.heat;
    }
  }
  heat += echoIntensity(s, m, 'residual_energy') * 0.06;
  for (const a of s.anomalies) {
    if (a.moduleId !== m.id) continue;
    if (a.kind === 'choir') heat += a.intensity * 0.04;
    if (a.kind === 'frost' && !a.exploited) heat -= a.intensity * 0.08;
  }
  return heat;
}

export function updateTemperature(s: GameState, topo: Topology, dtMin: number) {
  const load = reactorLoad(s);
  const ids = Object.keys(s.modules).sort();
  const before = new Map(ids.map((id) => [id, s.modules[id].temperature]));
  const extraCooling = new Map<string, number>();

  for (const id of ids) {
    const m = s.modules[id];
    if (m.type === 'radiator' && m.online) {
      const c = MODULES.radiator.cooling * levelMultiplier(m.level);
      extraCooling.set(id, (extraCooling.get(id) ?? 0) + c);
      for (const n of topo.neighbours.get(id) ?? []) extraCooling.set(n, (extraCooling.get(n) ?? 0) + c * 0.5);
    }
    for (const a of s.anomalies) {
      if (a.moduleId === id && a.kind === 'frost' && a.exploited) {
        for (const n of topo.neighbours.get(id) ?? []) extraCooling.set(n, (extraCooling.get(n) ?? 0) + a.intensity * 0.12);
      }
    }
  }

  for (const id of ids) {
    const m = s.modules[id];
    const t = before.get(id)!;
    let dT = heatSources(s, m, load) - (extraCooling.get(id) ?? 0) - THERMAL.passiveLoss * (t - THERMAL.ambient);
    for (const n of topo.neighbours.get(id) ?? []) dT += THERMAL.conduction * (before.get(n)! - t);
    m.temperature = tidy(clamp(t + dT * dtMin, -60, 250));
  }

  for (const id of ids) {
    const m = s.modules[id];
    const def = MODULES[m.type];
    if (m.temperature > def.maxTemp) m.condition = tidy(clamp(m.condition - THERMAL.overheatDamage * dtMin, 0, 100));
    if (!m.overheated && m.temperature > def.maxTemp + THERMAL.shutdownMargin) {
      m.overheated = true;
      if (m.type === 'reactor') reactorOverload(s, m, topo);
      else log(s, { severity: 'warning', category: 'system', key: 'log.overheated', params: { module: m.type } });
    } else if (m.overheated && m.temperature < def.maxTemp) {
      m.overheated = false;
      log(s, { severity: 'info', category: 'system', key: 'log.cooledDown', params: { module: m.type } });
    }
  }

  const habitable = ids.map((id) => s.modules[id]).filter((m) => HABITABLE.has(m.type) && m.buildRemaining <= 0);
  const pool = habitable.length ? habitable : ids.map((id) => s.modules[id]);
  s.temperature = pool.length ? tidy(pool.reduce((sum, m) => sum + m.temperature, 0) / pool.length) : THERMAL.ambient;
}

/** Reactor overload: damage, a scar, and residual energy in the reactor and every room around it. */
export function reactorOverload(s: GameState, reactor: ModuleInstance, topo: Topology) {
  reactor.condition = tidy(clamp(reactor.condition - 15, 0, 100));
  s.flags.reactor_overloaded = true;
  s.counters.overloads = (s.counters.overloads ?? 0) + 1;
  log(s, { severity: 'critical', category: 'echo', key: 'log.reactorOverload' });
  addScar(s, reactor, 'overload');
  createEcho(s, { kind: 'residual_energy', cells: moduleCells(reactor), intensity: 70, causeKey: 'echo.cause.overload', causeParams: { module: 'reactor' } });
  for (const n of topo.neighbours.get(reactor.id) ?? []) {
    const nm = s.modules[n];
    createEcho(s, { kind: 'residual_energy', cells: moduleCells(nm), intensity: 35, causeKey: 'echo.cause.overloadHalo', causeParams: { module: nm.type } });
  }
}
