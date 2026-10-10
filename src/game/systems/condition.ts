/**
 * Wear, passive repairs, hull integrity and breaches.
 *
 * - Online modules wear at their def rate. Structural Fatigue echoes multiply wear by (1 + s/50)
 *   unless Lattice Alloys have harnessed them, in which case they regenerate the module instead.
 * - A module under crew maintenance does not wear.
 * - Workshops slowly repair everything within two cells. Shield generators restore hull integrity.
 * - A hull-edge module with strong structural fatigue and low condition breaches; so does a
 *   badly worn airlock. Breaches vent oxygen (see resources.ts) until repaired or sealed.
 */
import { MODULES, levelMultiplier } from '../content/modules';
import { RESEARCH_EFFECTS } from '../content/research';
import { isHullEdge, moduleCells, moduleDistance } from '../engine/grid';
import { clamp, hasResearch, log, tidy } from '../engine/helpers';
import type { GameState, ModuleInstance } from '../engine/types';
import { addConsequence, createEcho, echoOnModule } from './echo';

export function isMaintained(s: GameState, m: ModuleInstance): boolean {
  return s.crew.some((c) => !c.away && !c.incapacitated && c.task === 'maintenance' && c.targetId === m.id);
}

export function updateCondition(s: GameState, dtMin: number) {
  const mods = Object.values(s.modules).sort((a, b) => (a.id < b.id ? -1 : 1));
  const workshops = mods.filter((m) => m.type === 'workshop' && m.online);
  const lattice = hasResearch(s, 'eng_lattice_alloys');

  for (const m of mods) {
    if (m.buildRemaining > 0) continue;
    const def = MODULES[m.type];
    const structural = echoOnModule(s, m, 'structural');
    let delta = 0;
    if (m.online && !isMaintained(s, m)) {
      const fatigue = structural && !lattice ? 1 + structural.intensity / 50 : 1;
      delta -= def.wear * fatigue;
    }
    if (structural && lattice) delta += structural.intensity * RESEARCH_EFFECTS.latticeRegen;
    for (const w of workshops) {
      if (w.id !== m.id && moduleDistance(w, m) <= 2) delta += 0.4 * levelMultiplier(w.level) * w.efficiency;
    }
    m.condition = tidy(clamp(m.condition + delta * dtMin, 0, 100));

    // Breaches
    if (!m.breached) {
      const edge = moduleCells(m).some((c) => isHullEdge(s, c.x, c.y));
      const fatigueBreach = edge && structural && !lattice && structural.intensity >= 60 && m.condition < 30;
      const airlockBreach = m.type === 'airlock' && m.condition < 15;
      if (fatigueBreach || airlockBreach) {
        breachModule(s, m);
        if (structural) addConsequence(s, structural, 'echo.consequence.breach', { module: m.type });
      }
    } else if (m.condition >= 50) {
      m.breached = false;
      log(s, { severity: 'success', category: 'system', key: 'log.breachSealed', params: { module: m.type } });
    }
  }

  for (const sh of mods.filter((m) => m.type === 'shield' && m.online)) {
    s.hull = tidy(clamp(s.hull + 0.6 * levelMultiplier(sh.level) * sh.efficiency * dtMin, 0, 100));
  }
}

/** Opens a hull breach. The module drops to at most 35 % and stays breached until repaired to 50 %. */
export function breachModule(s: GameState, m: ModuleInstance) {
  if (m.breached) return;
  m.breached = true;
  m.condition = Math.min(m.condition, 35);
  s.flags.had_breach = true;
  log(s, { severity: 'critical', category: 'system', key: 'log.breach', params: { module: m.type } });
}

/** Incoming hull damage after shields: each online shield absorbs 40 %, capped at 70 %. */
export function shieldFactor(s: GameState): number {
  const shields = Object.values(s.modules).filter((m) => m.type === 'shield' && m.online).length;
  return 1 - Math.min(0.7, shields * 0.4);
}

/** Records a damage incident on a module. The third leaves a Structural Fatigue echo. */
export function addScar(s: GameState, m: ModuleInstance, cause: string) {
  m.scars += 1;
  if (m.scars >= 3) {
    const trace = createEcho(s, {
      kind: 'structural',
      cells: moduleCells(m),
      intensity: 40 + 15 * (m.scars - 3),
      causeKey: 'echo.cause.scars',
      causeParams: { module: m.type, count: m.scars, cause },
    });
    trace.intensity = clamp(trace.intensity, 0, 100);
  }
}

export function damageHull(s: GameState, amount: number): number {
  const real = amount * shieldFactor(s);
  s.hull = tidy(clamp(s.hull - real, 0, 100));
  return real;
}
