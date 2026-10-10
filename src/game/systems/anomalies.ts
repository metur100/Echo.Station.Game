/**
 * Anomaly growth, spread, spawning and removal. Nothing here is random: every change has a
 * reason the inspector can show (see `growthFactors`).
 *
 * Spread: above its spread threshold an unquarantined anomaly builds spread pressure at
 * (intensity − 40) × 0.3 per minute. At 100 it moves into the connected neighbour with the
 * highest susceptibility score (ties broken by module id) and the pressure resets.
 */
import { ANOMALIES } from '../content/anomalies';
import { MODULES } from '../content/modules';
import { isHullEdge, moduleCells, moduleDistance, type Topology } from '../engine/grid';
import { clamp, hasResearch, log, newId, tidy } from '../engine/helpers';
import type { AnomalyInstance, AnomalyKind, GameState, ModuleInstance } from '../engine/types';
import { addScar } from './condition';
import { addConsequence, createEcho, echoIntensity, echoOnModule } from './echo';

export interface GrowthFactor {
  key: string;
  value: number;
}

function containmentNear(s: GameState, m: ModuleInstance, topo: Topology): number {
  let n = 0;
  if (m.type === 'containment' && m.online) n++;
  for (const id of topo.neighbours.get(m.id) ?? []) if (s.modules[id].type === 'containment' && s.modules[id].online) n++;
  return n;
}

/** Growth per minute and the reasons behind it. */
export function growthFactors(s: GameState, a: AnomalyInstance, topo: Topology): { rate: number; factors: GrowthFactor[] } {
  const m = s.modules[a.moduleId];
  const factors: GrowthFactor[] = [];
  let rate = 0;
  const t = m.temperature;
  const onEdge = moduleCells(m).some((c) => isHullEdge(s, c.x, c.y));

  if (a.kind === 'bloom') {
    if (m.quarantined) {
      rate = t < 12 ? -1 : 0;
      factors.push({ key: 'quarantined', value: rate });
    } else if (t < 12 || t > 38) {
      rate = -1.5;
      factors.push({ key: t < 12 ? 'too_cold' : 'too_hot', value: rate });
    } else {
      rate = 2;
      factors.push({ key: 'warm', value: 2 });
      if (MODULES[m.type].organic) {
        rate *= 2;
        factors.push({ key: 'organic', value: 2 });
      }
      if (s.resources.water < 20) {
        rate *= 0.5;
        factors.push({ key: 'dry', value: -rate });
      }
      const e = echoIntensity(s, m, 'residual_energy');
      if (e > 0) {
        const boost = rate * (e / 50);
        rate += boost;
        factors.push({ key: 'residual_energy', value: tidy(boost) });
      }
    }
  } else if (a.kind === 'choir') {
    if (m.online && m.powered) {
      const flow = Math.abs(m.powerFlow) / 10;
      rate = flow;
      factors.push({ key: 'power_flow', value: tidy(flow) });
    } else {
      rate = -3;
      factors.push({ key: 'starved', value: -3 });
    }
    const e = echoIntensity(s, m, 'residual_energy');
    if (e > 0) {
      rate += e / 40;
      factors.push({ key: 'residual_energy', value: tidy(e / 40) });
    }
    const shields = Object.values(s.modules).filter((x) => x.type === 'shield' && x.online && moduleDistance(x, m) <= 2).length;
    if (shields) {
      rate -= 1.5 * shields;
      factors.push({ key: 'shielded', value: -1.5 * shields });
    }
  } else {
    if (t < 8) {
      rate = 2;
      factors.push({ key: 'cold', value: 2 });
    } else if (t > 18) {
      rate = -4;
      factors.push({ key: 'warm_frost', value: -4 });
    }
    if (rate > 0 && onEdge) {
      rate *= 1.5;
      factors.push({ key: 'hull_edge', value: 1.5 });
    }
  }

  const fields = containmentNear(s, m, topo);
  if (fields) {
    // A containment field stops all growth, then wears the anomaly down.
    rate = Math.min(rate, 0) - 2 * fields;
    factors.push({ key: 'containment_field', value: -2 * fields });
  }
  const cap = a.kind === 'frost' ? 50 : 60;
  if (a.exploited && a.intensity >= cap && rate > 0) {
    rate = 0;
    factors.push({ key: 'harnessed', value: 0 });
  }
  return { rate, factors };
}

export function susceptibility(s: GameState, kind: AnomalyKind, m: ModuleInstance): number {
  if (m.buildRemaining > 0 || m.quarantined || ANOMALIES[kind].immune.includes(m.type)) return -1;
  if (s.anomalies.some((a) => a.moduleId === m.id && a.kind === kind)) return -1;
  const e = echoIntensity(s, m, 'residual_energy');
  if (kind === 'bloom') {
    const warm = m.temperature >= 12 && m.temperature <= 38;
    return (MODULES[m.type].organic ? 2 : 0.5) + e / 25 + (warm ? 1 : -2);
  }
  if (kind === 'choir') return m.online && m.powered ? Math.abs(m.powerFlow) / 10 + e / 25 : -1;
  if (m.temperature >= 15) return -1;
  return (8 - m.temperature) / 5 + (moduleCells(m).some((c) => isHullEdge(s, c.x, c.y)) ? 1 : 0);
}

/** Neighbours that the anomaly would spread to, best first. */
export function atRisk(s: GameState, a: AnomalyInstance, topo: Topology): { moduleId: string; score: number }[] {
  return (topo.neighbours.get(a.moduleId) ?? [])
    .map((id) => ({ moduleId: id, score: susceptibility(s, a.kind, s.modules[id]) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || (x.moduleId < y.moduleId ? -1 : 1));
}

export function pressureRate(a: AnomalyInstance, quarantined: boolean): number {
  if (quarantined || a.exploited || a.intensity < ANOMALIES[a.kind].spreadThreshold) return -5;
  return (a.intensity - 40) * 0.3;
}

/** Seconds until the next spread at the current rate, or null when it isn't spreading. */
export function secondsToSpread(s: GameState, a: AnomalyInstance): number | null {
  const m = s.modules[a.moduleId];
  const r = pressureRate(a, !!m?.quarantined);
  if (r <= 0) return null;
  return Math.ceil(((100 - a.pressure) / r) * 60);
}

export function spawnAnomaly(s: GameState, kind: AnomalyKind, moduleId: string, intensity: number, reasonKey: string): AnomalyInstance | null {
  const m = s.modules[moduleId];
  if (!m || s.anomalies.some((a) => a.moduleId === moduleId && a.kind === kind)) return null;
  const a: AnomalyInstance = { id: newId(s, 'a'), kind, moduleId, intensity, pressure: 0, peak: intensity, exploited: false, createdAt: Math.floor(s.time), growth: 0 };
  s.anomalies.push(a);
  log(s, { severity: 'warning', category: 'anomaly', key: reasonKey, params: { kind, module: m.type } });
  return a;
}

export function removeAnomaly(s: GameState, a: AnomalyInstance, cause: 'contained' | 'purged') {
  s.anomalies = s.anomalies.filter((x) => x.id !== a.id);
  const m = s.modules[a.moduleId];
  s.stats.anomaliesContained += 1;
  log(s, { severity: 'success', category: 'anomaly', key: cause === 'purged' ? 'log.anomalyPurged' : 'log.anomalyContained', params: { kind: a.kind, module: m?.type ?? 'corridor' } });
  if (!m) return;
  const sterile = hasResearch(s, 'xeno_sterilization');
  if (a.kind === 'bloom') {
    const intensity = a.peak * (sterile ? 0.2 : cause === 'purged' ? 0.8 : 0.6);
    if (intensity >= 5) createEcho(s, { kind: 'contamination', cells: moduleCells(m), intensity, causeKey: 'echo.cause.bloom', causeParams: { module: m.type } });
  } else if (a.kind === 'choir') {
    createEcho(s, { kind: 'residual_energy', cells: moduleCells(m), intensity: 20, causeKey: 'echo.cause.choir', causeParams: { module: m.type } });
  } else {
    addScar(s, m, 'frost');
  }
}

export function updateAnomalies(s: GameState, topo: Topology, dtMin: number) {
  for (const a of [...s.anomalies].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const m = s.modules[a.moduleId];
    if (!m) {
      s.anomalies = s.anomalies.filter((x) => x.id !== a.id);
      continue;
    }
    // Driven to zero (by crew, events or decay) before it can grow back this tick.
    if (a.intensity <= 0) {
      removeAnomaly(s, a, 'contained');
      s.disposition.containment += 1;
      continue;
    }
    const { rate, factors } = growthFactors(s, a, topo);
    a.growth = tidy(rate);
    if (a.kind === 'bloom' && factors.some((f) => f.key === 'residual_energy')) {
      const trace = echoOnModule(s, m, 'residual_energy');
      if (trace) addConsequence(s, trace, 'echo.consequence.bloomFeeds', { module: m.type });
    }
    a.intensity = tidy(clamp(a.intensity + rate * dtMin, 0, 100));
    a.peak = Math.max(a.peak, a.intensity);

    // Effects
    if (a.kind === 'frost' && !a.exploited) m.condition = tidy(clamp(m.condition - a.intensity * 0.006 * dtMin, 0, 100));
    if (a.kind === 'bloom' && a.exploited && m.type !== 'hydroponics' && m.quarantined) {
      s.resources.research = tidy(Math.min(s.capacity.research, s.resources.research + (a.intensity / 40) * dtMin));
    }

    if (a.intensity <= 0) {
      removeAnomaly(s, a, 'contained');
      s.disposition.containment += 1;
      continue;
    }

    // Spread
    a.pressure = tidy(clamp(a.pressure + pressureRate(a, m.quarantined) * dtMin, 0, 100));
    if (a.pressure >= 100) {
      const target = atRisk(s, a, topo)[0];
      if (target) {
        a.pressure = 0;
        const spawned = spawnAnomaly(s, a.kind, target.moduleId, 10, 'log.anomalySpread');
        const tm = s.modules[target.moduleId];
        if (spawned && echoIntensity(s, tm, 'residual_energy') > 0) {
          const trace = echoOnModule(s, tm, 'residual_energy');
          if (trace) addConsequence(s, trace, 'echo.consequence.drewSpread', { kind: a.kind, module: tm.type });
        }
      }
    }
  }

  spawnFromEchoes(s, dtMin);
}

/** Echo-driven spawning: contamination regrows the Bloom; residual energy wakes the Choir. */
function spawnFromEchoes(s: GameState, dtMin: number) {
  const sterile = hasResearch(s, 'xeno_sterilization');
  for (const m of Object.values(s.modules).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (m.buildRemaining > 0) continue;
    // Bloom regrowth
    const c = echoOnModule(s, m, 'contamination');
    const bloomKey = `bloom:${m.id}`;
    if (c && c.intensity >= 30 && !sterile && susceptibility(s, 'bloom', m) > 0 && m.temperature >= 12) {
      s.counters[bloomKey] = (s.counters[bloomKey] ?? 0) + (c.intensity / 30) * 10 * dtMin;
      if (s.counters[bloomKey] >= 100) {
        s.counters[bloomKey] = 0;
        if (spawnAnomaly(s, 'bloom', m.id, 8, 'log.bloomRegrew')) addConsequence(s, c, 'echo.consequence.regrew', { module: m.type });
      }
    } else if (s.counters[bloomKey]) {
      delete s.counters[bloomKey];
    }

    // Choir awakening
    const r = echoOnModule(s, m, 'residual_energy');
    const choirKey = `choir:${m.id}`;
    const awake = s.flags.choir_awake || (s.counters.overloads ?? 0) >= 2;
    if (awake && r && r.intensity >= 60 && m.online && m.powered && susceptibility(s, 'choir', m) > 0) {
      s.counters[choirKey] = (s.counters[choirKey] ?? 0) + 10 * dtMin;
      if (s.counters[choirKey] >= 100) {
        s.counters[choirKey] = 0;
        if (spawnAnomaly(s, 'choir', m.id, 12, 'log.choirWoke')) addConsequence(s, r, 'echo.consequence.wokeChoir', { module: m.type });
      }
    } else if (s.counters[choirKey]) {
      delete s.counters[choirKey];
    }
  }
}
