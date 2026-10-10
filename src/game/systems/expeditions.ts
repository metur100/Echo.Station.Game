/**
 * Expeditions. Crew prepare a destination (expedition_prep task) to 100 % readiness, then leave
 * through an airlock. The outcome is drawn from the seeded generator against a risk that falls
 * with piloting skill, research, traits and shields.
 */
import { RESCUED_CREW, TRAITS } from '../content/crew';
import { DESTINATION_BY_ID, DESTINATIONS, EXPEDITION_BEATS, type DestinationDef } from '../content/destinations';
import { RESEARCH_EFFECTS } from '../content/research';
import { isHullEdge, moduleCells } from '../engine/grid';
import { addResource, clamp, crewById, grantXp, hasResearch, log, spend } from '../engine/helpers';
import { random } from '../engine/rng';
import type { GameState, PartialResources, ResourceId } from '../engine/types';
import { damageHull } from './condition';
import { remember } from './crew';
import { spawnAnomaly } from './anomalies';
import { decideEnding } from './progression';

export function destinationUnlocked(s: GameState, d: DestinationDef): boolean {
  return d.requiresResearch.every((r) => hasResearch(s, r)) && d.requiresCompleted.every((c) => (s.expeditions.completed[c] ?? 0) > 0);
}

export function expeditionCost(s: GameState, d: DestinationDef): PartialResources {
  const f = hasResearch(s, 'nav_efficient_burns') ? 1 - RESEARCH_EFFECTS.burnCost : 1;
  const out: PartialResources = {};
  for (const [r, v] of Object.entries(d.cost) as [ResourceId, number][]) out[r] = Math.ceil(v * f);
  return out;
}

export function expeditionDuration(s: GameState, d: DestinationDef): number {
  return Math.round(d.duration * (hasResearch(s, 'nav_efficient_burns') ? 1 - RESEARCH_EFFECTS.burnDuration : 1));
}

export function expeditionRisk(s: GameState, d: DestinationDef, crewIds: string[]): number {
  const crew = crewIds.map((id) => crewById(s, id)).filter((c) => !!c);
  let risk = d.baseRisk;
  if (crew.length) {
    const avgPiloting = crew.reduce((sum, c) => sum + c.skills.piloting, 0) / crew.length;
    risk -= 0.04 * (avgPiloting - 1);
    for (const c of crew) for (const t of c.traits) risk -= TRAITS[t]?.expeditionRisk ?? 0;
    const tired = crew.filter((c) => c.fatigue > 70 || c.health < 50).length;
    risk += 0.05 * tired;
  }
  if (hasResearch(s, 'nav_drift_charting')) risk -= RESEARCH_EFFECTS.expeditionRisk;
  if (Object.values(s.modules).some((m) => m.type === 'shield' && m.online)) risk -= 0.05;
  return clamp(Math.round(risk * 100) / 100, 0.05, 0.85);
}

export type LaunchError =
  | 'locked'
  | 'already_done'
  | 'busy'
  | 'no_airlock'
  | 'crew_count'
  | 'crew_unavailable'
  | 'not_ready'
  | 'cannot_afford';

export function launchError(s: GameState, destinationId: string, crewIds: string[]): LaunchError | null {
  const d = DESTINATION_BY_ID[destinationId];
  if (!d || !destinationUnlocked(s, d)) return 'locked';
  if (!d.repeatable && (s.expeditions.completed[d.id] ?? 0) > 0) return 'already_done';
  if (s.expeditions.active) return 'busy';
  if (!Object.values(s.modules).some((m) => m.type === 'airlock' && m.online)) return 'no_airlock';
  const unique = [...new Set(crewIds)];
  if (unique.length < d.crewMin || unique.length > d.crewMax || unique.length !== crewIds.length) return 'crew_count';
  for (const id of unique) {
    const c = crewById(s, id);
    if (!c || c.away || c.incapacitated || c.health < 30) return 'crew_unavailable';
  }
  if (unique.length >= s.crew.filter((c) => !c.away).length) return 'crew_count';
  if ((s.expeditions.readiness[d.id] ?? 0) < 100) return 'not_ready';
  const cost = expeditionCost(s, d);
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) if (s.resources[r] < v) return 'cannot_afford';
  return null;
}

export function launchExpedition(s: GameState, destinationId: string, crewIds: string[]) {
  const d = DESTINATION_BY_ID[destinationId];
  spend(s, expeditionCost(s, d));
  for (const id of crewIds) {
    const c = crewById(s, id)!;
    c.away = true;
    c.task = 'rest';
    c.targetId = null;
    c.taskProgress = 0;
  }
  s.expeditions.readiness[d.id] = 0;
  s.expeditions.active = { destinationId: d.id, crewIds: [...crewIds], elapsed: 0, duration: expeditionDuration(s, d), risk: expeditionRisk(s, d, crewIds), beats: 0 };
  log(s, { severity: 'info', category: 'expedition', key: 'log.expeditionLaunched', params: { destination: d.id } });
}

export function updateExpeditions(s: GameState, dtSec: number) {
  const ex = s.expeditions.active;
  if (!ex) return;
  ex.elapsed = Math.min(ex.duration, ex.elapsed + dtSec);
  const beat = Math.floor((ex.elapsed / ex.duration) * (EXPEDITION_BEATS + 1));
  while (ex.beats < Math.min(beat, EXPEDITION_BEATS)) {
    ex.beats += 1;
    log(s, { severity: 'info', category: 'expedition', key: `expedition.${ex.destinationId}.beat${ex.beats}` });
  }
  if (ex.elapsed >= ex.duration) completeExpedition(s);
}

export function completeExpedition(s: GameState) {
  const ex = s.expeditions.active;
  if (!ex) return;
  const d = DESTINATION_BY_ID[ex.destinationId];
  const roll = random(s);
  const outcome: 'success' | 'partial' | 'failure' = roll < ex.risk * 0.5 ? 'failure' : roll < ex.risk ? 'partial' : 'success';
  const first = (s.expeditions.completed[d.id] ?? 0) === 0;
  const yieldF = (first ? 1 : d.repeatYield) * (outcome === 'success' ? 1 : outcome === 'partial' ? 0.6 : 0.25);

  const rewards: PartialResources = {};
  for (const [r, v] of Object.entries(d.rewards) as [string, number][]) {
    if (r === 'xp') continue;
    const amount = Math.round(v * yieldF);
    rewards[r as ResourceId] = amount;
    addResource(s, r as ResourceId, amount);
  }
  grantXp(s, Math.round(d.rewards.xp * (first ? 1 : 0.4)));

  for (const id of ex.crewIds) {
    const c = crewById(s, id);
    if (!c) continue;
    c.away = false;
    c.fatigue = clamp(c.fatigue + 30, 0, 100);
    if (outcome === 'partial') c.health = clamp(c.health - 15, 1, 100);
    if (outcome === 'failure') c.health = clamp(c.health - 40, 1, 100);
    remember(s, c, `memory.expedition.${outcome}`, outcome === 'success' ? 3 : outcome === 'partial' ? 0 : -4, { destination: d.id });
  }
  if (outcome === 'failure') damageHull(s, d.failureHullDamage);

  s.expeditions.completed[d.id] = (s.expeditions.completed[d.id] ?? 0) + 1;
  s.expeditions.active = null;
  s.expeditions.lastOutcome = { destinationId: d.id, outcome, time: Math.floor(s.time), rewards };
  s.stats.expeditions += 1;
  log(s, { severity: outcome === 'failure' ? 'warning' : 'success', category: 'expedition', key: `log.expedition.${outcome}`, params: { destination: d.id } });

  if (first) firstVisit(s, d);
}

function entryModule(s: GameState): string | null {
  const airlock = Object.values(s.modules).filter((m) => m.type === 'airlock').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (airlock) return airlock.id;
  const edge = Object.values(s.modules).find((m) => moduleCells(m).some((c) => isHullEdge(s, c.x, c.y)));
  return edge?.id ?? null;
}

function firstVisit(s: GameState, d: DestinationDef) {
  s.flags[d.flag] = true;
  log(s, { severity: 'info', category: 'story', key: `story.${d.id}` });
  const entry = entryModule(s);
  if (d.id === 'kessler' && !s.crew.some((c) => c.id === RESCUED_CREW.id)) {
    const { health, morale, fatigue, ...rest } = RESCUED_CREW;
    s.crew.push({ ...rest, health, morale, fatigue, task: 'rest', targetId: null, taskProgress: 0, away: false, incapacitated: false, memories: [], joinedAt: Math.floor(s.time) });
    remember(s, s.crew[s.crew.length - 1], 'memory.rescued', 4);
    log(s, { severity: 'success', category: 'crew', key: 'log.crewRescued', params: { crew: RESCUED_CREW.name } });
  }
  if (d.id === 'lantern') s.flags.choir_awake = true;
  if (d.introduces && entry) spawnAnomaly(s, d.introduces, entry, d.introduces === 'choir' ? 15 : 20, 'log.anomalyBroughtAboard');
  if (d.final) decideEnding(s);
}

export const ALL_DESTINATIONS = DESTINATIONS;
