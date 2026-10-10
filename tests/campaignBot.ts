/**
 * Campaign bot: a simple player plays a new game through the real command API, taking
 * default incident choices, and must reach an ending in reasonable ship time. This guards
 * against soft-locks and pacing regressions.
 */
import { executeCommand } from '../src/game/engine/commands';
import { TICK_SECONDS } from '../src/game/engine/constants';
import { checkPlacement } from '../src/game/engine/grid';
import { initializeNewGame } from '../src/game/engine/newGame';
import { tick } from '../src/game/engine/step';
import type { Command, GameState, ModuleType } from '../src/game/engine/types';
import { DESTINATIONS } from '../src/game/content/destinations';
import { RESEARCH } from '../src/game/content/research';
import { EVENT_BY_ID } from '../src/game/content/events';
import { choiceBlocked } from '../src/game/systems/events';
import { destinationUnlocked, launchError } from '../src/game/systems/expeditions';
import { currentObjective } from '../src/game/systems/progression';
import { researchAvailability } from '../src/game/systems/research';

const RESEARCH_ORDER = [
  'eng_reactor_tuning', 'nav_drift_charting', 'xeno_bloom_taxonomy', 'eng_radiators', 'eng_shield_harmonics', 'echo_sensing', 'nav_long_range',
  'echo_cartography', 'nav_ark_coordinates', 'xeno_containment', 'nav_efficient_burns', 'eng_modular_upgrades',
];

function run(s: GameState, cmd: Command): GameState {
  const r = executeCommand(s, cmd);
  return r.ok ? r.state : s;
}

function tryBuild(s: GameState, type: ModuleType): GameState {
  for (let y = 0; y < s.grid.height; y++) {
    for (let x = 0; x < s.grid.width; x++) {
      for (const rotation of [0, 1] as const) {
        if (checkPlacement(s, type, x, y, rotation).valid) return run(s, { type: 'PlaceModule', moduleType: type, x, y, rotation });
      }
    }
  }
  return s;
}

const count = (s: GameState, t: ModuleType) => Object.values(s.modules).filter((m) => m.type === t).length;

/** One decision step of the bot. */
function decide(s: GameState): GameState {
  // Incidents: default choice (or the first one available)
  if (s.events.active) {
    const def = EVENT_BY_ID[s.events.active.defId];
    const ev = s.events.active;
    const choice = [def.choices.find((c) => c.id === def.defaultChoice), ...def.choices].find((c) => c && !choiceBlocked(s, ev, c));
    s = run(s, { type: 'ResolveEvent', choiceId: choice!.id });
  }
  if (s.gameOver) return run(s, { type: 'EmergencyRecovery' });

  const obj = currentObjective(s);
  if (obj?.id === 'inspect_reactor') s = run(s, { type: 'AcknowledgeObjective', objectiveId: 'inspect_reactor' });

  // Keep everything switched on
  for (const m of Object.values(s.modules)) if (!m.enabled) s = run(s, { type: 'ToggleModule', moduleId: m.id, enabled: true });

  // Basic economy
  if (count(s, 'oxygen') === 0) s = tryBuild(s, 'oxygen');
  if (count(s, 'oxygen') < 2 && s.crew.length >= 4) s = tryBuild(s, 'oxygen');
  if (count(s, 'recycler') < 2 && s.resources.water < 40) s = tryBuild(s, 'recycler');
  if (count(s, 'hydroponics') < 2 && s.resources.food < 30) s = tryBuild(s, 'hydroponics');
  if (count(s, 'quarters') < 2 && s.crew.length >= 4) s = tryBuild(s, 'quarters');
  if (s.research.completed.includes('eng_radiators') && count(s, 'radiator') === 0) s = tryBuild(s, 'radiator');
  if (count(s, 'workshop') === 0 && s.objectives.completed.includes('build_oxygen')) s = tryBuild(s, 'workshop');
  if (s.research.completed.includes('eng_shield_harmonics') && count(s, 'shield') === 0) s = tryBuild(s, 'shield');

  // Power: upgrade the reactor, then add a second one
  if (s.power.shortage || s.power.demand > s.power.supply * 0.9) {
    const reactor = Object.values(s.modules).find((m) => m.type === 'reactor' && m.buildRemaining <= 0 && m.level < 2);
    if (reactor) s = run(s, { type: 'UpgradeModule', moduleId: reactor.id });
    else if (count(s, 'reactor') < 2) s = tryBuild(s, 'reactor');
  }

  // Lift quarantines that no longer hold anything (breach sealed by an incident, anomaly gone)
  for (const m of Object.values(s.modules)) {
    if (m.quarantined && !m.breached && !s.anomalies.some((a) => a.moduleId === m.id) && m.type !== 'storage') s = run(s, { type: 'SetQuarantine', moduleId: m.id, quarantined: false });
  }

  // Anomalies: quarantine anything growing
  for (const a of s.anomalies) {
    const m = s.modules[a.moduleId];
    if (m && !m.quarantined && a.intensity > 30 && m.type !== 'reactor') s = run(s, { type: 'ContainAnomaly', anomalyId: a.id, method: 'quarantine' });
  }

  // Research
  if (!s.research.active) {
    for (const id of RESEARCH_ORDER) {
      const def = RESEARCH.find((r) => r.id === id)!;
      const a = researchAvailability(s, def);
      if (a.status === 'available' && a.affordable) {
        s = run(s, { type: 'StartResearch', researchId: id });
        break;
      }
    }
  }

  // Crew
  const lab = Object.values(s.modules).find((m) => m.type === 'lab');
  const damaged = Object.values(s.modules)
    .filter((m) => m.buildRemaining <= 0 && m.condition < 70)
    .sort((a, b) => a.condition - b.condition)[0];
  const aboard = s.crew.filter((c) => !c.away && !c.incapacitated);
  const next = DESTINATIONS.find((d) => destinationUnlocked(s, d) && !(s.expeditions.completed[d.id] ?? 0));
  for (const c of aboard) {
    if (c.task !== 'rest' || c.fatigue > 60) continue;
    const threat = s.anomalies.filter((a) => a.intensity > 25 && !a.exploited && s.modules[a.moduleId]?.type !== 'storage').sort((a, b) => b.intensity - a.intensity)[0];
    const breach = Object.values(s.modules).find((m) => m.breached);
    if ((c.id === 'elias' || c.id === 'tomas') && threat) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'emergency', targetId: threat.id });
    else if (c.id === 'ines' && breach) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'repair', targetId: breach.id });
    else if (c.id === 'ines' && damaged) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'repair', targetId: damaged.id });
    else if (c.id === 'tomas' && lab) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'research', targetId: lab.id });
    else if (c.id === 'mira' && !next && s.resources.materials < 60 && (s.expeditions.readiness.kessler ?? 0) < 100) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'expedition_prep', targetId: 'kessler' });
    else if (c.id === 'mira' && next && (s.expeditions.readiness[next.id] ?? 0) < 100) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'expedition_prep', targetId: next.id });
    else if (c.id === 'elias' && damaged) s = run(s, { type: 'AssignCrewTask', crewId: c.id, task: 'repair', targetId: damaged.id });
  }

  // Expeditions: send Mira (and Ines for two-person trips) once ready
  if (next && !s.expeditions.active && (s.expeditions.readiness[next.id] ?? 0) >= 100) {
    const team = next.crewMin >= 2 ? ['mira', 'ines'] : ['mira'];
    if (!launchError(s, next.id, team)) s = run(s, { type: 'StartExpedition', destinationId: next.id, crewIds: team });
  } else if (!s.expeditions.active && (s.expeditions.readiness.kessler ?? 0) >= 100 && s.resources.materials < 60 && !launchError(s, 'kessler', ['mira'])) {
    s = run(s, { type: 'StartExpedition', destinationId: 'kessler', crewIds: ['mira'] });
  }
  return s;
}

export function playCampaign(seed: number, maxSeconds = 4 * 3600) {
  let s = initializeNewGame({ seed });
  let decisions = 0;
  while (!s.ending && s.time < maxSeconds) {
    s = decide(s);
    decisions++;
    for (let i = 0; i < 40; i++) tick(s, TICK_SECONDS); // 10 s of ship time between decisions
  }
  return { s, decisions };
}

