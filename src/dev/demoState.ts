/**
 * Development only: builds a mid-campaign state with the real engine (commands + ticks) for
 * store screenshots and manual QA. Reached through the /dev-demo route, which does nothing in
 * release builds.
 */
import { executeCommand } from '../game/engine/commands';
import { TICK_SECONDS } from '../game/engine/constants';
import { moduleCells } from '../game/engine/grid';
import { initializeNewGame } from '../game/engine/newGame';
import { tick } from '../game/engine/step';
import type { Command, GameState } from '../game/engine/types';
import { spawnAnomaly } from '../game/systems/anomalies';
import { createEcho } from '../game/systems/echo';

function run(s: GameState, cmd: Command): GameState {
  const r = executeCommand(s, cmd);
  return r.ok ? r.state : s;
}

function advance(s: GameState, seconds: number) {
  for (let i = 0; i < seconds / TICK_SECONDS; i++) tick(s, TICK_SECONDS);
}

export function buildDemoState(): GameState {
  let s = initializeNewGame({ seed: 'store' });
  s.resources.materials = 900;
  s.resources.credits = 600;
  s.resources.research = 400;
  s.events.nextCheck = 1e9; // no random incidents while capturing
  s = run(s, { type: 'AcknowledgeObjective', objectiveId: 'inspect_reactor' });
  s = run(s, { type: 'PlaceModule', moduleType: 'oxygen', x: 5, y: 2, rotation: 0 });
  advance(s, 15);
  const reactor = Object.values(s.modules).find((m) => m.type === 'reactor')!;
  reactor.condition = 82;
  s.research.completed.push('eng_reactor_tuning', 'nav_drift_charting', 'eng_radiators', 'xeno_bloom_taxonomy', 'echo_sensing', 'eng_shield_harmonics', 'xeno_containment');
  s.discoveredAnomalies.push('bloom', 'frost');
  s.flags.first_echo = true;
  s.flags.bloom_reveal = true;
  s = run(s, { type: 'PlaceModule', moduleType: 'radiator', x: 9, y: 4, rotation: 0 });
  s = run(s, { type: 'PlaceModule', moduleType: 'workshop', x: 2, y: 6, rotation: 0 });
  s = run(s, { type: 'PlaceModule', moduleType: 'quarters', x: 7, y: 7, rotation: 0 });
  s = run(s, { type: 'PlaceModule', moduleType: 'corridor', x: 6, y: 7, rotation: 0 });
  s = run(s, { type: 'PlaceModule', moduleType: 'shield', x: 1, y: 3, rotation: 0 });
  s = run(s, { type: 'PlaceModule', moduleType: 'corridor', x: 3, y: 4, rotation: 0 });
  advance(s, 40);

  // The ship's history: an overload around the reactor, the Bloom in hydroponics, frost in the airlock
  const hydro = Object.values(s.modules).find((m) => m.type === 'hydroponics')!;
  const airlock = Object.values(s.modules).find((m) => m.type === 'airlock')!;
  const lab = Object.values(s.modules).find((m) => m.type === 'lab')!;
  createEcho(s, { kind: 'residual_energy', cells: moduleCells(reactor), intensity: 58, causeKey: 'echo.cause.overload', causeParams: { module: 'reactor' } });
  createEcho(s, { kind: 'residual_energy', cells: moduleCells(hydro), intensity: 34, causeKey: 'echo.cause.overloadHalo', causeParams: { module: 'hydroponics' } });
  createEcho(s, { kind: 'structural', cells: moduleCells(airlock), intensity: 45, causeKey: 'echo.cause.scars', causeParams: { module: 'airlock', count: 3 } });
  createEcho(s, { kind: 'resonance', cells: [], intensity: 20, causeKey: 'echo.cause.decision', causeParams: { event: 'anomaly_discovery' } });
  spawnAnomaly(s, 'bloom', hydro.id, 46, 'log.anomalySpread');
  spawnAnomaly(s, 'frost', airlock.id, 28, 'log.anomalyBroughtAboard');
  s.expeditions.completed.kessler = 1;
  s.flags.kessler_done = true;
  s.objectives.completed.push('repair_reactor', 'build_oxygen', 'start_research', 'contain_bloom', 'first_expedition', 'research_charting', 'build_radiator');
  s.captain = { xp: 420, level: 3 };
  s.stats.echoesCreated = 6;

  s = run(s, { type: 'AssignCrewTask', crewId: 'tomas', task: 'research', targetId: lab.id });
  s = run(s, { type: 'AssignCrewTask', crewId: 'ines', task: 'maintenance', targetId: airlock.id });
  s = run(s, { type: 'AssignCrewTask', crewId: 'mira', task: 'expedition_prep', targetId: 'glacier' });
  s = run(s, { type: 'StartResearch', researchId: 'eng_modular_upgrades' });
  advance(s, 30);
  s.resources.oxygen = Math.min(s.capacity.oxygen, 140);
  s.resources.food = 96;
  s.resources.water = 112;
  s.time = 2580;
  return s;
}

/** A pending incident for the incident screenshot. */
export function withIncident(s: GameState): GameState {
  const a = s.anomalies.find((x) => x.kind === 'bloom');
  if (a) s.events.active = { defId: 'contamination_warning', targetId: a.id, secondaryId: null, startedAt: s.time };
  return s;
}
