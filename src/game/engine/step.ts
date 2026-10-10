/**
 * One fixed simulation tick. Systems run in a fixed order on a mutable draft; the caller clones
 * the state once per batch of ticks (see GameEngine.updateSimulation).
 */
import { TICKS_PER_SECOND } from './constants';
import { topology } from './grid';
import { log, tidy } from './helpers';
import type { GameState } from './types';
import { updateAnomalies } from '../systems/anomalies';
import { updateCondition } from '../systems/condition';
import { updateCrew } from '../systems/crew';
import { updateCondensers, updateEchoes } from '../systems/echo';
import { updateEvents } from '../systems/events';
import { updateExpeditions } from '../systems/expeditions';
import { updatePower } from '../systems/power';
import { checkGameOver, updateAchievements, updateObjectives } from '../systems/progression';
import { updateResearch } from '../systems/research';
import { computeCapacity, updateResources } from '../systems/resources';
import { updateTemperature } from '../systems/thermal';

export interface TickOptions {
  /** Offline progression: incidents resolve at once with safe defaults, hazards are skipped. */
  offline?: boolean;
}

function updateConstruction(s: GameState, dtSec: number) {
  for (const m of Object.values(s.modules)) {
    if (m.buildRemaining <= 0) continue;
    m.buildRemaining = tidy(Math.max(0, m.buildRemaining - dtSec));
    if (m.buildRemaining === 0) {
      s.layoutVersion += 1;
      log(s, { severity: 'success', category: 'build', key: m.level > 1 ? 'log.upgradeDone' : 'log.buildDone', params: { module: m.type, level: m.level } });
    }
  }
}

export function tick(s: GameState, dtSec: number, opts: TickOptions = {}) {
  if (s.gameOver) return;
  const dtMin = dtSec / 60;
  s.tick += 1;
  s.time = tidy(s.time + dtSec);

  updateConstruction(s, dtSec);
  s.capacity = computeCapacity(s);
  const topo = topology(s);
  updatePower(s, topo, dtMin);
  updateResources(s, dtMin);
  updateTemperature(s, topo, dtMin);
  updateCondition(s, dtMin);
  updateCrew(s, dtMin);
  updateAnomalies(s, topo, dtMin);
  updateCondensers(s, topo.neighbours, dtMin);
  updateEchoes(s, dtMin);
  updateResearch(s, dtSec);
  updateExpeditions(s, dtSec);
  updateEvents(s, dtSec, !!opts.offline);

  // Bookkeeping that doesn't need to run every tick
  if (opts.offline || s.tick % TICKS_PER_SECOND === 0) {
    updateObjectives(s);
    updateAchievements(s);
  }
  if (s.resources.oxygen < s.capacity.oxygen * 0.2) s.stats.oxygenLowSeconds = tidy(s.stats.oxygenLowSeconds + dtSec);
  s.events.modifiers = s.events.modifiers.filter((m) => m.until > s.time);
  if (!opts.offline) checkGameOver(s);
}
